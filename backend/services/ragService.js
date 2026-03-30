import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  EMBEDDING_DIMENSION,
  GEMINI_EMBEDDING_MODEL,
  GROQ_MODEL,
  UPLOAD_DIR,
} from "../config/appConfig.js";

const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

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

async function embedQuery(text) {
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
      },
    );

    return response.data.embedding?.values ?? [];
  } catch (error) {
    throw new Error(
      `Embedding API failed: ${error.response?.status} ${JSON.stringify(error.response?.data)}`,
    );
  }
}

async function embedDocuments(texts) {
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
      },
    );

    return (response.data.embeddings ?? []).map(
      (embedding) => embedding.values ?? [],
    );
  } catch (error) {
    throw new Error(
      `Embedding API failed: ${error.response?.status} ${JSON.stringify(error.response?.data)}`,
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

export async function listUploadedDocuments() {
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
    (first, second) =>
      new Date(second.uploadedAt).getTime() -
      new Date(first.uploadedAt).getTime(),
  );
}

export async function answerQuestion(question, history = []) {
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

export async function findUploadedDocument(docId) {
  const files = await fs.readdir(UPLOAD_DIR);
  const fileName = files.find((file) => file.startsWith(`${docId}__`));
  return fileName ? path.join(UPLOAD_DIR, fileName) : null;
}

export async function processDocument(filePath, docId) {
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
