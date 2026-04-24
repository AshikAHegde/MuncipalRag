import { GROUNDING_RULES } from "./agentPrompts.js";
import { parseStructuredJson, runGroundedGroqPrompt } from "./ragService.js";

export const LEGAL_DOMAINS = ["criminal", "civil", "corporate", "tax"];

export function isValidLegalDomain(domain) {
  return LEGAL_DOMAINS.includes(domain);
}

export function buildRetrievedContext(retrieved = []) {
  return retrieved
    .map(
      (item, index) => [
        `Retrieved Item ${index + 1}:`,
        `domain=${item.domain || ""}`,
        `section=${item.section || ""}`,
        `source=${item.source || ""}`,
        `page=${item.page ?? "N/A"}`,
        `keywords=${Array.isArray(item.keywords) ? item.keywords.join(", ") : ""}`,
        `text=${item.text || ""}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function collectRelevantSections(retrieved = []) {
  return retrieved.map((item) => item.section).filter(Boolean);
}

export async function runJsonAgent({
  prompt,
  query,
  retrieved = [],
  history = [],
  fallback,
}) {
  try {
    const raw = await runGroundedGroqPrompt({
      systemInstruction: `${GROUNDING_RULES}\n${prompt}`,
      history,
      prompt: `User query/report:\n${query}\n\nRetrieved legal context:\n${buildRetrievedContext(retrieved)}`,
    });
    const parsed = parseStructuredJson(raw);

    if (parsed) {
      return parsed;
    }
  } catch (error) {
    console.warn("Legal agent JSON generation fell back:", error.message);
  }

  return fallback();
}
