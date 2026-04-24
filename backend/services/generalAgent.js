import { GENERAL_PROMPT } from "./agentPrompts.js";
import { runJsonAgent } from "./legalAgentUtils.js";

function fallbackGeneral({ domain, retrieved }) {
  return {
    selected_domain: domain,
    simple_answer:
      retrieved[0]?.text || "No sufficient retrieved legal basis found.",
    key_points: retrieved
      .slice(0, 3)
      .map((item) => item.section || item.source || "Retrieved context"),
    cited_sections: retrieved.map((item) => item.section).filter(Boolean),
    uncertainty:
      retrieved.length > 0
        ? ""
        : "No sufficient retrieved legal basis found.",
  };
}

export async function respond({ query, domain, retrieved, history = [] }) {
  const base = fallbackGeneral({ domain, retrieved });
  const structured = await runJsonAgent({
    prompt: GENERAL_PROMPT,
    query,
    retrieved,
    history,
    fallback: () => base,
  });

  const result = {
    ...base,
    ...structured,
    selected_domain: domain,
  };

  const answer = [
    result.simple_answer,
    "",
    ...(Array.isArray(result.key_points) && result.key_points.length > 0
      ? ["Key points:", ...result.key_points.map((item) => `- ${item}`)]
      : []),
    ...(Array.isArray(result.cited_sections) && result.cited_sections.length > 0
      ? ["", "Cited sections:", ...result.cited_sections.map((item) => `- ${item}`)]
      : []),
    ...(result.uncertainty ? ["", `Uncertainty: ${result.uncertainty}`] : []),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    answer,
    report: {
      domain,
      explanation: result,
    },
    sources: retrieved,
  };
}

export default { respond };
