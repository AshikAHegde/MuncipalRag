import { runJsonAgent } from './legalAgentUtils.js';

/**
 * Comparison Agent: Audits conflicts from all domains to find cross-domain relations.
 */
export const runComparisonAgent = async (clientReport, allConflicts) => {
  if (!allConflicts || allConflicts.length === 0) return allConflicts;

  const prompt = `
    You are a Senior Legal Cross-Domain Auditor.
    
    INPUT:
    1. Client Report: "${clientReport}"
    2. Detected Conflicts: ${JSON.stringify(allConflicts)}
    
    TASK:
    Analyze the detected conflicts and identify if any conflict from one domain has a significant impact or relationship with another domain.
    
    For each conflict in the list, you MUST add exactly one new field: "cross_domain_impact".
    - If there is a relationship (e.g., a Criminal fraud leads to a Tax violation), describe it briefly in 1 sentence. 
      Mention the domain. Example: "Impact: This criminal fraud directly triggers a Tax Audit under the Income Tax Act."
    - If there is no clear relation, write: "Standard domain-specific issue."
    
    OUTPUT FORMAT:
    Return the EXACT same array of objects, but with the added "cross_domain_impact" string field in each object.
    
    JSON STRUCTURE:
    {
      "updated_conflicts": [
        {
          "domain": "...",
          "section": "...",
          "cross_domain_impact": "..."
        }
      ]
    }
  `;

  try {
    const result = await runJsonAgent({
      prompt,
      query: clientReport,
      retrieved: [],
      history: [],
      fallback: () => ({ updated_conflicts: allConflicts })
    });
    return result.updated_conflicts || allConflicts;
  } catch (error) {
    console.error('Comparison Agent Error:', error);
    return allConflicts; // Fallback to raw results
  }
};
