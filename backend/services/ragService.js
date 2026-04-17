import axios from "axios";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  EMBEDDING_DIMENSION,
  GEMINI_EMBEDDING_MODEL,
  GROQ_MODEL,
} from "../config/appConfig.js";
import { getLanguageConfig } from "../config/languages.js";
import Document from "../models/Document.js";
import { downloadPdfBuffer } from "./storageService.js";

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

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dedupeBy(items = [], getKey = (item) => item) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function safeJsonParse(text) {
  const cleaned = sanitizeText(text);

  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const startIndex = cleaned.indexOf("{");
    const endIndex = cleaned.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(startIndex, endIndex + 1));
    } catch (_nestedError) {
      return null;
    }
  }
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryDelayMs(error) {
  const retryInfo = error.response?.data?.error?.details?.find(
    (detail) => detail?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
  );
  const retryDelay = retryInfo?.retryDelay;

  if (typeof retryDelay !== "string") {
    return null;
  }

  const seconds = Number.parseFloat(retryDelay.replace("s", ""));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.ceil(seconds * 1000);
}

async function postGeminiEmbeddingWithRetry(url, body, maxRetries = 5) {
  let attempt = 0;

  while (true) {
    try {
      return await axios.post(url, body, {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      });
    } catch (error) {
      const status = error.response?.status;
      if (status !== 429 || attempt >= maxRetries) {
        throw error;
      }

      const retryDelayMs = parseRetryDelayMs(error) ?? 60_000;
      console.warn(
        `Gemini embedding quota hit (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.ceil(retryDelayMs / 1000)}s...`,
      );
      attempt += 1;
      await sleep(retryDelayMs);
    }
  }
}

async function embedQuery(text) {
  try {
    const response = await postGeminiEmbeddingWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent`,
      {
        model: GEMINI_EMBEDDING_MODEL,
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMENSION,
        content: {
          parts: [{ text }],
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

async function batchEmbedQueries(texts) {
  const sanitizedTexts = texts.map(sanitizeText).filter(Boolean);

  if (sanitizedTexts.length === 0) {
    return [];
  }

  try {
    const MAX_BATCH_SIZE = 100;
    const textBatches = chunkArray(sanitizedTexts, MAX_BATCH_SIZE);
    const allEmbeddings = [];

    for (const batch of textBatches) {
      const response = await postGeminiEmbeddingWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
        {
          requests: batch.map((text) => ({
            model: GEMINI_EMBEDDING_MODEL,
            taskType: "RETRIEVAL_QUERY",
            outputDimensionality: EMBEDDING_DIMENSION,
            content: {
              parts: [{ text }],
            },
          })),
        },
      );

      allEmbeddings.push(
        ...(response.data.embeddings ?? []).map(
          (embedding) => embedding.values ?? [],
        ),
      );
    }

    return allEmbeddings;
  } catch (error) {
    throw new Error(
      `Embedding API failed: ${error.response?.status} ${JSON.stringify(error.response?.data)}`,
    );
  }
}

async function embedDocuments(texts) {
  try {
    const MAX_BATCH_SIZE = 100;
    const sanitizedTexts = texts.map(sanitizeText).filter(Boolean);
    const textBatches = chunkArray(sanitizedTexts, MAX_BATCH_SIZE);
    const allEmbeddings = [];

    for (const batch of textBatches) {
      const response = await postGeminiEmbeddingWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
        {
          requests: batch.map((text) => ({
            model: GEMINI_EMBEDDING_MODEL,
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: EMBEDDING_DIMENSION,
            content: {
              parts: [{ text }],
            },
          })),
        },
      );

      allEmbeddings.push(
        ...(response.data.embeddings ?? []).map(
          (embedding) => embedding.values ?? [],
        ),
      );
    }

    return allEmbeddings;
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

function buildFallbackAnswer(context, rewrittenQuery, language = "en") {
  const languageConfig = getLanguageConfig(language);

  if (!context.trim()) {
    return languageConfig.answerMissing;
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

function normalizeMatch(match, index) {
  return {
    page: match.metadata?.pageNumber ?? "N/A",
    section: `Match ${index + 1}`,
    text: match.metadata?.text ?? "",
    score: match.score ?? null,
    source: match.metadata?.source ?? "",
  };
}

function formatComplianceReview(review, language = "en") {
  const languageConfig = getLanguageConfig(language);
  const overallPercentage = Number.isFinite(review?.overallPercentage)
    ? Math.max(0, Math.min(100, Math.round(review.overallPercentage)))
    : 0;
  const summary = sanitizeText(review?.summary)
    || (
      languageConfig.code === "hi"
        ? "कोई सारांश तैयार नहीं हुआ।"
        : languageConfig.code === "mr"
          ? "कोणताही सारांश तयार झाला नाही."
          : "No summary was generated."
    );
  const correctItems = Array.isArray(review?.correctItems)
    ? review.correctItems.map(sanitizeText).filter(Boolean)
    : [];
  const wrongItems = Array.isArray(review?.wrongItems)
    ? review.wrongItems.map(sanitizeText).filter(Boolean)
    : [];
  const lineReviews = Array.isArray(review?.lineReviews)
    ? review.lineReviews
    : [];

  const copy =
    languageConfig.code === "hi"
      ? {
          overall: "कुल अनुपालन",
          summary: "सारांश",
          correct: "क्या सही है:",
          wrong: "क्या गलत है या सुधार की आवश्यकता है:",
          lineReview: "लाइन-दर-लाइन समीक्षा:",
          noCorrect: "- दी गई सामग्री से कोई स्पष्ट सही बिंदु नहीं मिला।",
          noWrong: "- दी गई सामग्री से कोई बड़ी समस्या नहीं मिली।",
          noLineReview: "- कोई लाइन-दर-लाइन समीक्षा तैयार नहीं हो सकी।",
          why: "क्यों",
          ruleReference: "नियम संदर्भ",
          source: "स्रोत",
        }
      : languageConfig.code === "mr"
        ? {
            overall: "एकूण अनुपालन",
            summary: "सारांश",
            correct: "काय बरोबर आहे:",
            wrong: "काय चुकीचे आहे किंवा दुरुस्ती हवी आहे:",
            lineReview: "ओळीनुसार परीक्षण:",
            noCorrect: "- दिलेल्या मजकुरातून कोणतेही स्पष्ट बरोबर मुद्दे आढळले नाहीत.",
            noWrong: "- दिलेल्या मजकुरातून कोणतीही मोठी समस्या आढळली नाही.",
            noLineReview: "- ओळीनुसार परीक्षण तयार होऊ शकले नाही.",
            why: "का",
            ruleReference: "नियम संदर्भ",
            source: "स्रोत",
          }
        : {
            overall: "Overall compliance",
            summary: "Summary",
            correct: "What is correct:",
            wrong: "What is wrong or needs correction:",
            lineReview: "Line-by-line review:",
            noCorrect:
              "- No clearly correct items were identified from the provided text.",
            noWrong: "- No major issues were highlighted from the provided text.",
            noLineReview: "- No line-by-line review could be generated.",
            why: "Why",
            ruleReference: "Rule reference",
            source: "Source",
          };

  const lines = [
    `${copy.overall}: ${overallPercentage}%`,
    `${copy.summary}: ${summary}`,
    "",
    copy.correct,
    ...(correctItems.length > 0
      ? correctItems.map((item) => `- ${item}`)
      : [copy.noCorrect]),
    "",
    copy.wrong,
    ...(wrongItems.length > 0
      ? wrongItems.map((item) => `- ${item}`)
      : [copy.noWrong]),
    "",
    copy.lineReview,
  ];

  if (lineReviews.length === 0) {
    lines.push(copy.noLineReview);
    return lines.join("\n");
  }

  lineReviews.forEach((item, index) => {
    const lineNumber = Number.isFinite(item?.lineNumber)
      ? item.lineNumber
      : index + 1;
    const status = sanitizeText(item?.status || "not_found")
      .replace(/_/g, " ")
      .toUpperCase();
    const percentage = Number.isFinite(item?.percentage)
      ? Math.max(0, Math.min(100, Math.round(item.percentage)))
      : 0;
    const lineText = sanitizeText(item?.lineText) || "(empty line)";
    const explanation =
      sanitizeText(item?.explanation) || "No explanation was generated.";
    const supportingRule =
      sanitizeText(item?.supportingRule) || "No exact supporting rule was cited.";
    const sourceParts = [
      sanitizeText(item?.source),
      item?.page === 0 || item?.page ? `page ${item.page}` : "",
    ].filter(Boolean);

    lines.push(`${lineNumber}. [${status} - ${percentage}%] ${lineText}`);
    lines.push(`${copy.why}: ${explanation}`);
    lines.push(`${copy.ruleReference}: ${supportingRule}`);
    if (sourceParts.length > 0) {
      lines.push(`${copy.source}: ${sourceParts.join(", ")}`);
    }
    lines.push("");
  });

  return lines.join("\n").trim();
}

function buildFallbackComplianceReview(submission, lineAnalyses = [], language = "en") {
  const languageConfig = getLanguageConfig(language);
  const totalLines = lineAnalyses.length;
  const matchedLines = lineAnalyses.filter((line) => line.matches.length > 0);
  const overallPercentage =
    totalLines === 0 ? 0 : Math.round((matchedLines.length / totalLines) * 100);

  const correctItems = matchedLines
    .slice(0, 5)
    .map(
      (line) =>
        languageConfig.code === "hi"
          ? `लाइन ${line.lineNumber} दस्तावेज़ों से समर्थित लगती है: "${line.lineText}"`
          : languageConfig.code === "mr"
            ? `ओळ ${line.lineNumber} दस्तऐवजांद्वारे समर्थित दिसते: "${line.lineText}"`
            : `Line ${line.lineNumber} appears supported by the documents: "${line.lineText}"`,
    );

  const wrongItems = lineAnalyses
    .filter((line) => line.matches.length === 0)
    .slice(0, 5)
    .map(
      (line) =>
        languageConfig.code === "hi"
          ? `लाइन ${line.lineNumber} को इंडेक्स किए गए नियमों से सत्यापित नहीं किया जा सका: "${line.lineText}"`
          : languageConfig.code === "mr"
            ? `ओळ ${line.lineNumber} इंडेक्स केलेल्या नियमांतून पडताळता आली नाही: "${line.lineText}"`
            : `Line ${line.lineNumber} could not be verified from the indexed rules: "${line.lineText}"`,
    );

  return {
    overallPercentage,
    summary:
      overallPercentage === 0
        ? languageConfig.code === "hi"
          ? "यह सबमिशन इंडेक्स किए गए नियम दस्तावेज़ों के विरुद्ध सत्यापित नहीं किया जा सका।"
          : languageConfig.code === "mr"
            ? "ही सबमिशन इंडेक्स केलेल्या नियम दस्तऐवजांशी पडताळता आली नाही."
            : "The submission could not be verified against the indexed rule documents."
        : languageConfig.code === "hi"
          ? "यह फॉलबैक समीक्षा केवल रिट्रीवल मैच पर आधारित है क्योंकि संरचित विश्लेषण उपलब्ध नहीं था।"
          : languageConfig.code === "mr"
            ? "ही फॉलबॅक समीक्षा फक्त रिट्रीव्हल मॅचवर आधारित आहे कारण संरचित विश्लेषण उपलब्ध नव्हते."
            : "This fallback review is based on retrieval matches only because structured analysis generation was unavailable.",
    correctItems,
    wrongItems,
    lineReviews: lineAnalyses.map((line) => ({
      lineNumber: line.lineNumber,
      lineText: line.lineText,
      status: line.matches.length > 0 ? "partially_correct" : "not_found",
      percentage: line.matches.length > 0 ? 60 : 0,
      explanation:
        line.matches.length > 0
          ? languageConfig.code === "hi"
            ? "संबंधित नियम पाठ मिला, लेकिन सटीक दावे के लिए अभी भी अधिक मजबूत मॉडल-आधारित अनुपालन समीक्षा की आवश्यकता है।"
            : languageConfig.code === "mr"
              ? "संबंधित नियम मजकूर सापडला, पण अचूक दाव्यासाठी अजून मजबूत मॉडेल-आधारित अनुपालन परीक्षणाची गरज आहे."
              : "Relevant rule text was found, but the exact claim still needs a stronger model-based compliance review."
          : languageConfig.code === "hi"
            ? "इस लाइन के लिए इंडेक्स किए गए दस्तावेज़ों में कोई संबंधित नियम पाठ नहीं मिला।"
            : languageConfig.code === "mr"
              ? "या ओळीसाठी इंडेक्स केलेल्या दस्तऐवजांत कोणताही संबंधित नियम मजकूर सापडला नाही."
              : "No relevant rule text was found for this line in the indexed documents.",
      supportingRule: sanitizeText(line.matches[0]?.metadata?.text) || "",
      source: sanitizeText(line.matches[0]?.metadata?.source) || "",
      page: line.matches[0]?.metadata?.pageNumber ?? "N/A",
    })),
  };
}

async function retrieveMatches(queryVector, topK = 5) {
  const searchResults = await pineconeIndex.query({
    topK,
    vector: queryVector,
    includeMetadata: true,
  });

  return searchResults.matches ?? [];
}

export async function listUploadedDocuments(user) {
  const filter = user?.role === "admin" ? {} : { ownerId: user?._id };
  const documents = await Document.find(filter).sort({ createdAt: -1 }).lean();

  return documents.map((document) => ({
    docId: document.docId,
    fileName: document.originalName,
    uploadedAt: document.createdAt?.toISOString?.() || new Date().toISOString(),
    size: document.size,
    pages: document.pages || 0,
    status: document.status,
    storageKey: document.storageKey,
  }));
}

export async function answerQuestion(question, history = [], language = "en") {
  const languageConfig = getLanguageConfig(language);
  const rewrittenQuery = await rewriteQuery(question, history);
  const queryVector = await embedQuery(rewrittenQuery);

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error("Embedding generation failed for the search query.");
  }

  const matches = await retrieveMatches(queryVector, 5);
  const context = matches
    .map((match) => match.metadata?.text)
    .filter(Boolean)
    .join("\n\n---\n\n");

  let answer = "";

  try {
    answer = await generateGroqText(
      `You are a helpful assistant that answers only from the provided PDF context.
Respond entirely in ${languageConfig.label}.
If the answer is not available in the context, reply exactly with: ${languageConfig.answerMissing}
Keep citations grounded in the provided context and do not introduce facts from outside it.

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
    answer = buildFallbackAnswer(context, rewrittenQuery, language);
  }

  return {
    answer,
    sources: matches.map(normalizeMatch),
  };
}

export async function analyzeSubmissionAgainstRules(
  submission,
  history = [],
  language = "en",
) {
  const languageConfig = getLanguageConfig(language);
  const normalizedSubmission = sanitizeText(submission);

  if (!normalizedSubmission) {
    throw new Error("Submission text is required for compliance review.");
  }

  const submissionLines = normalizedSubmission
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 25)
    .map((lineText, index) => ({
      lineNumber: index + 1,
      lineText,
    }));

  if (submissionLines.length === 0) {
    throw new Error("Submission text must contain at least one non-empty line.");
  }

  const queryVectors = await batchEmbedQueries(
    submissionLines.map((line) => line.lineText),
  );

  const lineAnalyses = await Promise.all(
    submissionLines.map(async (line, index) => {
      const queryVector = queryVectors[index] ?? [];

      if (!Array.isArray(queryVector) || queryVector.length === 0) {
        return {
          ...line,
          matches: [],
        };
      }

      const matches = await retrieveMatches(queryVector, 2);

      return {
        ...line,
        matches,
      };
    }),
  );

  const reviewContext = lineAnalyses
    .map((line) => {
      const evidence = line.matches
        .map((match, index) => {
          const page =
            match.metadata?.pageNumber === 0 || match.metadata?.pageNumber
              ? `page ${match.metadata.pageNumber}`
              : "page N/A";

          return [
            `Evidence ${index + 1}:`,
            `source=${sanitizeText(match.metadata?.source) || "unknown"}`,
            `${page}`,
            `score=${typeof match.score === "number" ? match.score.toFixed(4) : "N/A"}`,
            `text=${sanitizeText(match.metadata?.text) || "No text"}`,
          ].join(" | ");
        })
        .join("\n");

      return `Line ${line.lineNumber}: ${line.lineText}\n${evidence || "Evidence: none"}`;
    })
    .join("\n\n");

  let parsedReview = null;

  try {
    const rawReview = await generateGroqText(
      `You are a strict compliance reviewer.
Review the user's submission against the supplied rule evidence only.
Do not invent rules that are not in the evidence.
If a claim cannot be verified from the evidence, mark it as "not_found" or "incorrect".
Return all natural-language field values in ${languageConfig.label}.
Return valid JSON only with this shape:
{
  "overallPercentage": number,
  "summary": "short paragraph",
  "correctItems": ["bullet text"],
  "wrongItems": ["bullet text"],
  "lineReviews": [
    {
      "lineNumber": number,
      "lineText": "original line",
      "status": "correct|partially_correct|incorrect|not_found",
      "percentage": number,
      "explanation": "what is right or wrong",
      "supportingRule": "quote or paraphrase from the evidence",
      "source": "document file name",
      "page": "page number or N/A"
    }
  ]
}`,
      history,
      `Submission to review:
${normalizedSubmission}

Evidence by line:
${reviewContext}`,
    );

    parsedReview = safeJsonParse(rawReview);
  } catch (error) {
    console.warn(
      "Structured compliance review failed, using fallback.",
      error.response?.data || error.message,
    );
  }

  const review =
    parsedReview || buildFallbackComplianceReview(normalizedSubmission, lineAnalyses, language);
  const sources = dedupeBy(
    lineAnalyses.flatMap((line) => line.matches.map(normalizeMatch)),
    (item) => `${item.source}|${item.page}|${item.text}`,
  );

  return {
    answer: formatComplianceReview(review, language),
    review,
    sources,
  };
}

export async function findUploadedDocument(docId, user) {
  const filter = { docId };

  if (user?.role !== "admin") {
    filter.ownerId = user?._id;
  }

  return Document.findOne(filter);
}

export async function deleteDocumentVectors(docId) {
  await pineconeIndex.deleteMany({
    filter: {
      docId: { $eq: docId },
    },
  });
}

async function extractTextUsingOCR(filePath) {
  console.log("Extracting text from scanned PDF using OCR...");
  
  // Use Google Gemini Vision API for document text detection
  const fileBuffer = await fs.readFile(filePath);
  const base64Image = fileBuffer.toString("base64");

  // Call Google Gemini Vision API (which has document OCR capabilities)
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
    {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Image,
              },
            },
            {
              text: "Extract all text from this PDF document. Return only the extracted text content without any commentary or formatting changes.",
            },
          ],
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
    },
  );

  const extractedText =
    response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!extractedText || extractedText.length === 0) {
    throw new Error("Gemini Vision API returned no text from the PDF.");
  }

  console.log(`OCR extraction successful. Extracted ${extractedText.length} characters.`);
  return extractedText;
}

export async function processDocument(document, sourceBuffer = null) {
  const fileBuffer =
    sourceBuffer && Buffer.isBuffer(sourceBuffer)
      ? sourceBuffer
      : await downloadPdfBuffer(document.storageKey);
  const tempFilePath = path.join(os.tmpdir(), `${document.docId}-${randomUUID()}.pdf`);

  await fs.writeFile(tempFilePath, fileBuffer);

  try {
    const pdfLoader = new PDFLoader(tempFilePath);
    const rawDocs = await pdfLoader.load();
    const readableDocs = rawDocs.filter(
      (doc) =>
        typeof doc.pageContent === "string" && doc.pageContent.trim().length > 0,
    );

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    let chunkedDocs;
    let pageCount = readableDocs.length;
    let extractionMode = "text";

    if (readableDocs.length === 0) {
      console.log("No readable text found. Attempting OCR extraction...");
      try {
        const ocrText = await extractTextUsingOCR(tempFilePath);
        extractionMode = "ocr";

        const ocrDoc = {
          pageContent: ocrText,
          metadata: {
            source: document.originalName,
            loc: { pageNumber: 1 },
          },
        };

        chunkedDocs = await textSplitter.splitDocuments([ocrDoc]);
        pageCount = 1;
      } catch (ocrError) {
        throw new Error(
          `The uploaded PDF does not contain readable text and OCR extraction failed: ${ocrError.message}. Please try a clearer PDF or a text-based PDF.`,
        );
      }
    } else {
      chunkedDocs = await textSplitter.splitDocuments(readableDocs);
    }

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
        id: `${document.docId}-${doc.metadata.loc?.pageNumber ?? "page"}-${index}`,
        values: vectors[index],
        metadata: {
          text: doc.pageContent.trim(),
          source: document.originalName,
          pageNumber: doc.metadata.loc?.pageNumber ?? null,
          docId: document.docId,
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
      pageCount,
      extractionMode,
    };
  } finally {
    await fs.rm(tempFilePath, { force: true });
  }
}
