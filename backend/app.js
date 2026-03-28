import axios from "axios";
import cors from "cors";
import * as dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import pdfParse from "pdf-parse";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 5000);
const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const UPLOAD_DIR = path.join(__dirname, "uploads");

function validateEnvironment() {
  const requiredVars = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
  ];
  const missingVars = requiredVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
  }
}

validateEnvironment();

const app = express();
const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

await fs.mkdir(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const docId = randomUUID();
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${docId}__${safeOriginalName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF files are allowed."));
  },
  limits: {
    fileSize: 20 * 1024 * 1024, //in bytes (20MB)
  },
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "model") &&
        typeof item.text === "string" &&
        item.text.trim(),
    )
    .map((item) => ({
      role: item.role,
      parts: [{ text: item.text.trim() }],
    }));
}

function groqHistoryMessages(history = []) {
  return normalizeHistory(history).map((item) => ({
    role: item.role === "model" ? "assistant" : "user",
    content: item.parts[0]?.text ?? "",
  }));
}

async function generateGroqText(systemInstruction, history = [], userPrompt) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemInstruction },
        ...groqHistoryMessages(history),
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    },
  );

  return response.data?.choices?.[0]?.message?.content?.trim() ?? "";
}

async function listUploadedDocuments() {
  const files = await fs.readdir(UPLOAD_DIR);

  const documents = await Promise.all(
    files
      .filter((fileName) => fileName.includes("__"))
      .map(async (fileName) => {
        const [docId, ...nameParts] = fileName.split("__");
        const originalName = nameParts.join("__");
        const filePath = path.join(UPLOAD_DIR, fileName);
        const stats = await fs.stat(filePath);

        return {
          docId,
          fileName: originalName,
          uploadedAt: stats.mtime.toISOString(),
          size: stats.size,
        };
      }),
  );

  return documents.sort(
    (first, second) => new Date(second.uploadedAt).getTime() - new Date(first.uploadedAt).getTime(),
  );
}

async function embedQuery(text) {  // means converting the (rewritten) search query into a vector representation using Gemini embedding API
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent`,
      {
        model: GEMINI_EMBEDDING_MODEL,
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMENSION,
        content: {
          parts: [{ text }],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    const data = response.data;
    return data.embedding?.values ?? [];
  } catch (error) {
    throw new Error(
      `Embedding API failed: ${error.response?.status} ${JSON.stringify(error.response?.data)}`
    );
  }
}

async function embedDocuments(texts) { // means converting all PDF text chunks into vector embeddings before storing them in Pinecone
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
      {
        requests: texts.map((text) => ({
          model: GEMINI_EMBEDDING_MODEL,
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: EMBEDDING_DIMENSION,
          content: {
            parts: [{ text }],
          },
        })),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    const data = response.data;
    return (data.embeddings ?? []).map((embedding) => embedding.values ?? []);
  } catch (error) {
    throw new Error(
      `Embedding API failed: ${error.response?.status} ${JSON.stringify(error.response?.data)}`
    );
  }
}

async function rewriteQuery(question, history = []) {
  try {
    const rewritten = await generateGroqText(
      "Rewrite the latest user question into a clear standalone search query. Return only the rewritten question.",
      history,
      question,
    );
    return rewritten || question;
  } catch (error) {
    console.warn(
      "Query rewrite failed, using original question.",
      error.response?.data || error.message,
    );
    return question;
  }
}

function buildFallbackAnswer(context, rewrittenQuery) {
  if (!context.trim()) {
    return "I could not find the answer in the provided document.";
  }

  const lines = context
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const queryWords = rewrittenQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const matchedLines = lines.filter((line) =>
    queryWords.some((word) => line.toLowerCase().includes(word)),
  );

  return (matchedLines.length > 0 ? matchedLines : lines)
    .slice(0, 6)
    .join("\n");
} 

async function answerQuestion(question, history = []) {
  const rewrittenQuery = await rewriteQuery(question, history);
  const queryVector = await embedQuery(rewrittenQuery);

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error("Embedding generation failed for the search query.");
  }

  const searchResults = await pineconeIndex.query({
    topK: 5,
    vector: queryVector,
    includeMetadata: true,
  });

  const matches = searchResults.matches ?? [];
  const context = matches
    .map((match) => match.metadata?.text)
    .filter(Boolean)
    .join("\n\n---\n\n");

  let answer = "";

  try {
    answer = await generateGroqText(
      `You are a helpful assistant that answers only from the provided PDF context.
If the answer is not available in the context, reply exactly with: I could not find the answer in the provided document.

Context:
${context}`,
      history,
      question,
    );

    if (!answer) {
      throw new Error("Groq returned an empty answer.");
    }
  } catch (error) {
    console.warn(
      "Groq answer generation failed, using fallback.",
      error.response?.data || error.message,
    );
    answer = buildFallbackAnswer(context, rewrittenQuery);
  }

  return {
    answer,
    sources: matches.map((match, index) => ({
      page: match.metadata?.pageNumber ?? "N/A",
      section: `Match ${index + 1}`,
      text: match.metadata?.text ?? "",
      score: match.score ?? null,
      source: match.metadata?.source ?? "",
    })),
  };
}

async function findUploadedDocument(docId) {
  const files = await fs.readdir(UPLOAD_DIR);
  const fileName = files.find((file) => file.startsWith(`${docId}__`));
  return fileName ? path.join(UPLOAD_DIR, fileName) : null;
}

async function processDocument(filePath, docId) {
  const pdfLoader = new PDFLoader(filePath);
  const rawDocs = await pdfLoader.load();
  const readableDocs = rawDocs.filter(
    (doc) =>
      typeof doc.pageContent === "string" && doc.pageContent.trim().length > 0,
  );

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  if (readableDocs.length === 0) {
    throw new Error(
      "The uploaded PDF does not contain readable text. Try a text-based PDF instead of an image/scanned PDF.",
    );
  }

  const chunkedDocs = await textSplitter.splitDocuments(readableDocs);
  const cleanedChunkedDocs = chunkedDocs.filter(
    (doc) =>
      typeof doc.pageContent === "string" && doc.pageContent.trim().length > 0,
  );

  if (cleanedChunkedDocs.length === 0) {
    throw new Error("No readable content was found in this PDF.");
  }

  const chunkTexts = cleanedChunkedDocs.map((doc) => doc.pageContent.trim());
  const vectors = await embedDocuments(chunkTexts);

  const records = cleanedChunkedDocs
    .map((doc, index) => ({
      id: `${docId}-${doc.metadata.loc?.pageNumber ?? "page"}-${index}`,
      values: vectors[index],
      metadata: {
        text: doc.pageContent.trim(),
        source: path.basename(filePath),
        pageNumber: doc.metadata.loc?.pageNumber ?? null,
        docId,
      },
    }))
    .filter(
      (record) => Array.isArray(record.values) && record.values.length > 0,
    );

  if (records.length === 0) {
    throw new Error(
      "Embeddings could not be created from this PDF content. Check the PDF text and Gemini embedding API quota.",
    );
  }

  await pineconeIndex.upsert({
    records,
  });

  return {
    chunkCount: records.length,
    pageCount: readableDocs.length,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Backend is running." });
});

app.get("/api/admin/documents", async (_req, res) => {
  try {
    const documents = await listUploadedDocuments();
    return res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("List documents route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while fetching uploaded documents.",
    });
  }
});

app.get("/api/admin/documents/:docId/download", async (req, res) => {
  try {
    const docId = req.params.docId?.trim();
    const filePath = await findUploadedDocument(docId);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    return res.download(filePath, path.basename(filePath).split("__").slice(1).join("__"));
  } catch (error) {
    console.error("Download document route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while downloading the PDF.",
    });
  }
});

app.post("/api/query", async (req, res) => {
  try {
    const query = req.body?.query?.trim();
    const history = req.body?.history ?? [];

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required.",
      });
    }

    const result = await answerQuestion(query, history);

    return res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
    });
  } catch (error) {
    console.error("Query route failed:", error);
    return res.status(500).json({
      success: false,
      error:
        error.message || "Something went wrong while answering the question.",
    });
  }
});

app.post("/api/admin/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a PDF file.",
      });
    }

    const [docId] = req.file.filename.split("__");
    let pages = 0;

    try {
      const fileBuffer = await fs.readFile(req.file.path);
      const pdfInfo = await pdfParse(fileBuffer);
      pages = pdfInfo.numpages || 0;
    } catch (error) {
      console.warn(
        "Could not read PDF page count during upload:",
        error.message,
      );
    }

    return res.json({
      success: true,
      docId,
      fileName: req.file.originalname,
      pages,
      message: "PDF uploaded successfully.",
    });
  } catch (error) {
    console.error("Upload route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while uploading the PDF.",
    });
  }
});

app.post("/api/admin/process", async (req, res) => {
  try {
    const docId = req.body?.docId?.trim();

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: "docId is required.",
      });
    }

    const filePath = await findUploadedDocument(docId);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    const result = await processDocument(filePath, docId);

    return res.json({
      success: true,
      message: `Document processed successfully. ${result.chunkCount} chunks stored in Pinecone.`,
      chunkCount: result.chunkCount,
      pageCount: result.pageCount,
    });
  } catch (error) {
    console.error("Process route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while processing the PDF.",
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Request failed.",
    });
  }

  return res.status(500).json({
    success: false,
    error: "Unexpected server error.",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
