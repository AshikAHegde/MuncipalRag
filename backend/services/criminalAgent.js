import { CRIMINAL_PROMPT } from "./agentPrompts.js";
import { collectRelevantSections, runJsonAgent } from "./legalAgentUtils.js";

export async function analyze({ query, retrieved, history = [] }) {
  return runJsonAgent({
    prompt: CRIMINAL_PROMPT,
    query,
    retrieved,
    history,
    fallback: () => ({
      domain: "criminal",
      applicable_sections: collectRelevantSections(retrieved),
      matched_facts: [],
      non_matched_facts: [],
      uncertainty: [
        "Insufficient facts to confidently map the report to criminal provisions.",
      ],
      reasoning:
        "Fallback criminal analysis used only the retrieved sections without additional structured output.",
    }),
  });
}

export default { analyze };
