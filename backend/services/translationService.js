import axios from "axios";
import { GROQ_MODEL } from "../config/appConfig.js";
import { DEFAULT_LANGUAGE, getLanguageConfig } from "../config/languages.js";

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeJsonParse(text) {
  const cleaned = sanitizeText(text).replace(/^```(?:json)?\s*|\s*```$/g, "");

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

function chunkArrayByLimits(items, maxItems = 4, maxChars = 6000) {
  const chunks = [];
  let currentChunk = [];
  let currentChars = 0;

  items.forEach((item) => {
    const itemText = typeof item?.text === "string" ? item.text : String(item ?? "");
    const itemChars = itemText.length;

    if (
      currentChunk.length > 0
      && (currentChunk.length >= maxItems || currentChars + itemChars > maxChars)
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(item);
    currentChars += itemChars;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function translateTextBatch(texts, targetLanguage) {
  const languageConfig = getLanguageConfig(targetLanguage);
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Translate each input string into ${languageConfig.label}.
Preserve meaning, markdown, line breaks, numbering, and factual content.
Do not summarize.
If a string is already in ${languageConfig.label}, return it unchanged.
Return valid JSON only in this shape: {"translations":["..."]}`,
        },
        {
          role: "user",
          content: JSON.stringify({ texts }),
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    },
  );

  const content = response.data?.choices?.[0]?.message?.content?.trim() || "";
  const parsed = safeJsonParse(content);
  const translations = Array.isArray(parsed?.translations) ? parsed.translations : [];

  if (translations.length !== texts.length) {
    throw new Error("Translation service returned an unexpected number of items.");
  }

  return translations.map((item, index) => sanitizeText(item) || texts[index]);
}

export async function translateTextsAtReadTime(texts = [], targetLanguage = DEFAULT_LANGUAGE) {
  const normalizedTexts = texts.map((text) => (typeof text === "string" ? text : ""));

  if (targetLanguage === DEFAULT_LANGUAGE) {
    return normalizedTexts;
  }

  const nonEmptyEntries = normalizedTexts
    .map((text, index) => ({ index, text: sanitizeText(text) }))
    .filter((entry) => entry.text);

  if (nonEmptyEntries.length === 0) {
    return normalizedTexts;
  }

  const translated = [...normalizedTexts];
  const batches = chunkArrayByLimits(nonEmptyEntries, 3, 3500);

  for (const batch of batches) {
    try {
      const results = await translateTextBatch(
        batch.map((entry) => entry.text),
        targetLanguage,
      );

      batch.forEach((entry, batchIndex) => {
        translated[entry.index] = results[batchIndex] || entry.text;
      });
    } catch (_batchError) {
      for (const entry of batch) {
        try {
          const [singleResult] = await translateTextBatch([entry.text], targetLanguage);
          translated[entry.index] = singleResult || entry.text;
        } catch (_singleError) {
          translated[entry.index] = entry.text;
        }
      }
    }
  }

  return translated;
}

export async function translateChatSessionsAtReadTime(
  chatSessions = [],
  targetLanguage = DEFAULT_LANGUAGE,
) {
  if (!Array.isArray(chatSessions) || chatSessions.length === 0) {
    return [];
  }

  const sessionBlueprint = [];
  const textsToTranslate = [];

  chatSessions.forEach((session) => {
    const nextSession = {
      ...session,
      language: targetLanguage,
      conversations: [],
    };

    sessionBlueprint.push(nextSession);

    (session.conversations || []).forEach((conversation) => {
      const translatedConversation = {
        ...conversation,
        language: targetLanguage,
        sources: [],
      };

      nextSession.conversations.push(translatedConversation);

      translatedConversation.question = conversation.question || "";
      translatedConversation.answer = conversation.answer || "";

      textsToTranslate.push({
        apply: (value) => {
          translatedConversation.question = value;
        },
        text: conversation.question || "",
      });
      textsToTranslate.push({
        apply: (value) => {
          translatedConversation.answer = value;
        },
        text: conversation.answer || "",
      });

      (conversation.sources || []).forEach((source) => {
        const translatedSource = { ...source };
        translatedConversation.sources.push(translatedSource);
      });
    });

    const latestConversation =
      nextSession.conversations[nextSession.conversations.length - 1] || null;
    nextSession.previewQuestion = latestConversation?.question || "";
    nextSession.previewAnswer = latestConversation?.answer || "";
  });

  if (textsToTranslate.length > 0) {
    const translatedValues = await translateTextsAtReadTime(
      textsToTranslate.map((entry) => entry.text),
      targetLanguage,
    );

    textsToTranslate.forEach((entry, index) => {
      entry.apply(translatedValues[index]);
    });
  }

  sessionBlueprint.forEach((session) => {
    const latestConversation =
      session.conversations[session.conversations.length - 1] || null;
    session.previewQuestion = latestConversation?.question || "";
    session.previewAnswer = latestConversation?.answer || "";
  });

  return sessionBlueprint;
}
