import { runJsonAgent } from './legalAgentUtils.js';

export const runComparisonAgent = async (clientReport, allConflicts) => {
  if (!allConflicts || allConflicts.length === 0) return allConflicts;

  const prompt = `
    You are a Senior Legal Cross-Domain Auditor with STRICT quality control authority.

    INPUT:
    1. Client Report: "${clientReport}"
    2. Detected Conflicts from all 4 domain agents: ${JSON.stringify(allConflicts)}

    YOUR JOB HAS TWO PARTS:

    ═══════════════════════════════════════════
    PART 1: STRICT RELEVANCE FILTER (CRITICAL)
    ═══════════════════════════════════════════

    Go through EVERY conflict and ask yourself:
    "Does the client report contain ACTUAL FACTS that directly relate to this legal section?"

    REMOVE a conflict if ANY of the following is true:
    - The client report does NOT mention any facts related to this legal section
    - The connection between the reported facts and this section is vague, speculative, or a stretch
    - The domain agent seems to have forced a match just because a keyword appeared, without real factual basis
    - The conflict is generic legal advice that could apply to anyone, not specific to THIS client report
    - The section was flagged based on assumptions about facts NOT stated in the report

    KEEP a conflict ONLY if:
    - The client report contains SPECIFIC FACTS that directly map to the legal provision
    - A reasonable lawyer reading the report would agree this section is clearly relevant
    - The "why_flagged" reason is grounded in actual statements from the client report

    BE AGGRESSIVE IN FILTERING. It is better to show 2 highly relevant conflicts than 8 loosely related ones.

    ═══════════════════════════════════════════
    PART 2: CROSS-DOMAIN IMPACT TAGGING
    ═══════════════════════════════════════════

    For each conflict that SURVIVES the filter, add a "cross_domain_impact" field:
    - If there is a genuine relationship with another domain, describe it in 1 sentence.
      Example: "This criminal fraud directly triggers a Tax Audit under the Income Tax Act."
    - If there is no cross-domain link, write: "Standard domain-specific issue."

    ═══════════════════════════════════════════
    OUTPUT FORMAT (STRICT JSON)
    ═══════════════════════════════════════════

    {
      "updated_conflicts": [
        ... ONLY the conflicts that passed the relevance filter, each with the added "cross_domain_impact" field
      ],
      "removed_count": <number of conflicts you removed>,
      "removal_reasons": [
        { "section": "...", "domain": "...", "reason": "Why this was removed" }
      ]
    }

    If ALL conflicts are irrelevant, return: { "updated_conflicts": [], "removed_count": <total>, "removal_reasons": [...] }
  `;

  try {
    const result = await runJsonAgent({
      prompt,
      query: clientReport,
      retrieved: [],
      history: [],
      fallback: () => ({ updated_conflicts: allConflicts }),
    });

    const filtered = result.updated_conflicts || allConflicts;

    if (result.removed_count > 0) {
      console.log(
        `Comparison Agent: Removed ${result.removed_count} irrelevant conflict(s).`,
        (result.removal_reasons || []).map((r) => `${r.domain}/${r.section}: ${r.reason}`),
      );
    }

    return filtered;
  } catch (error) {
    console.error('Comparison Agent Error:', error);
    return allConflicts;
  }
};
