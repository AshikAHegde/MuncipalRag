import { TAX_PROMPT } from "./agentPrompts.js";
import { collectRelevantSections, runJsonAgent } from "./legalAgentUtils.js";

export async function analyze({ query, retrieved, history = [] }) {
  return runJsonAgent({
    prompt: TAX_PROMPT,
    query,
    retrieved,
    history,
    fallback: () => ({
      domain: "tax",
      applicable_sections: collectRelevantSections(retrieved),
      possible_tax_issues: [],
      matched_facts: [],
      missing_information: [
        "Insufficient filing, amount, or financial facts were provided.",
      ],
      reasoning: "Fallback tax analysis used retrieved provisions only.",
    }),
  });
}

export default { analyze };
