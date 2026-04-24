import { CORPORATE_PROMPT } from "./agentPrompts.js";
import { collectRelevantSections, runJsonAgent } from "./legalAgentUtils.js";

export async function analyze({ query, retrieved, history = [] }) {
  return runJsonAgent({
    prompt: CORPORATE_PROMPT,
    query,
    retrieved,
    history,
    fallback: () => ({
      domain: "corporate",
      applicable_sections: collectRelevantSections(retrieved),
      compliance_issues: [],
      matched_facts: [],
      missing_information: [
        "Insufficient compliance, filing, or governance facts were provided.",
      ],
      reasoning: "Fallback corporate analysis used retrieved provisions only.",
    }),
  });
}

export default { analyze };
