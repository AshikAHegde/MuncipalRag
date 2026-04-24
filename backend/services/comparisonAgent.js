import { COMPARISON_PROMPT } from "./agentPrompts.js";
import { runJsonAgent } from "./legalAgentUtils.js";

export async function compare({
  query,
  retrieved,
  domainAnalysis,
  history = [],
}) {
  return runJsonAgent({
    prompt: `${COMPARISON_PROMPT}\n\nDomain analysis:\n${JSON.stringify(domainAnalysis, null, 2)}`,
    query,
    retrieved,
    history,
    fallback: () => ({
      comparisons: retrieved.map((item) => ({
        section: item.section || "",
        source: item.source || "",
        note: "Retrieved provision available for manual comparison.",
      })),
      likely_matches: [],
      weak_matches: [],
      missing_facts: [
        "The report may need more factual detail for a stronger comparison.",
      ],
      confidence_notes: [
        "Fallback comparison used because structured comparison generation was unavailable.",
      ],
    }),
  });
}

export default { compare };
