import { CIVIL_PROMPT } from "./agentPrompts.js";
import { collectRelevantSections, runJsonAgent } from "./legalAgentUtils.js";

export async function analyze({ query, retrieved, history = [] }) {
  return runJsonAgent({
    prompt: CIVIL_PROMPT,
    query,
    retrieved,
    history,
    fallback: () => ({
      domain: "civil",
      applicable_sections: collectRelevantSections(retrieved),
      possible_claims_or_issues: [],
      matched_facts: [],
      gaps: ["Insufficient contractual or dispute facts were provided."],
      reasoning: "Fallback civil analysis used retrieved provisions only.",
    }),
  });
}

export default { analyze };
