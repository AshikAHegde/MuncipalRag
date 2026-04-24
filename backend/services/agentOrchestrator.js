import {
  parseStructuredJson,
  runGroundedGroqPrompt,
} from "./ragService.js";
import { ORCHESTRATOR_PROMPT } from "./agentPrompts.js";
import {
  LEGAL_DOMAINS,
  isValidLegalDomain,
} from "./legalAgentUtils.js";
import retrievalAgent from "./retrievalAgent.js";
import criminalAgent from "./criminalAgent.js";
import civilAgent from "./civilAgent.js";
import corporateAgent from "./corporateAgent.js";
import taxAgent from "./taxAgent.js";
import { runComparisonAgent } from "./comparisonAgent.js";
import reportAgent from "./reportAgent.js";
import generalAgent from "./generalAgent.js";

const domainAgentMap = {
  criminal: criminalAgent,
  civil: civilAgent,
  corporate: corporateAgent,
  tax: taxAgent,
};

function fallbackDomainDetection(query) {
  const normalized = String(query || "").toLowerCase();
  const keywordMap = {
    criminal: ["crime", "fraud", "theft", "assault", "police", "forgery", "cheating"],
    civil: ["contract", "property", "compensation", "damages", "breach", "injunction"],
    corporate: ["company", "board", "director", "shareholder", "compliance", "incorporation"],
    tax: ["tax", "gst", "income tax", "filing", "deduction", "evasion"],
  };

  const scoredDomains = LEGAL_DOMAINS.map((domain) => ({
    domain,
    score: keywordMap[domain].reduce(
      (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
      0,
    ),
  })).sort((left, right) => right.score - left.score);

  if (
    scoredDomains[0]?.score > 0
    && scoredDomains[0].score > (scoredDomains[1]?.score || 0)
  ) {
    return {
      status: "ok",
      selected_domain: scoredDomains[0].domain,
      candidate_domains: scoredDomains
        .filter((item) => item.score > 0)
        .map((item) => item.domain),
      reasoning:
        "Keyword-based fallback domain detection selected the strongest matching legal domain.",
    };
  }

  return {
    status: "ambiguous_domain",
    selected_domain: null,
    candidate_domains: scoredDomains
      .filter((item) => item.score > 0)
      .map((item) => item.domain),
    reasoning:
      "The query appears to span multiple domains or lacks enough domain-specific indicators.",
  };
}

async function detectDomain({ query, mode, userDomain }) {
  if (mode === "lawyer" && isValidLegalDomain(userDomain)) {
    return {
      mode,
      status: "ok",
      selected_domain: userDomain,
      candidate_domains: [userDomain],
      reasoning:
        "Lawyer mode uses the domain stored with the authenticated account.",
    };
  }

  try {
    const raw = await runGroundedGroqPrompt({
      systemInstruction: ORCHESTRATOR_PROMPT,
      prompt: `Mode: ${mode}\nStored user domain: ${userDomain || "none"}\n\nUser query:\n${query}`,
    });
    const parsed = parseStructuredJson(raw);

    if (
      parsed
      && (parsed.selected_domain === null || isValidLegalDomain(parsed.selected_domain))
    ) {
      return {
        mode,
        status:
          parsed.status || (parsed.selected_domain ? "ok" : "ambiguous_domain"),
        selected_domain: parsed.selected_domain,
        candidate_domains: Array.isArray(parsed.candidate_domains)
          ? parsed.candidate_domains.filter(isValidLegalDomain)
          : [],
        reasoning: parsed.reasoning || "",
      };
    }
  } catch (error) {
    console.warn("Orchestrator domain detection fell back:", error.message);
  }

  return {
    mode,
    ...fallbackDomainDetection(query),
  };
}

/**
 * Run all 4 domain agents in parallel for lawyer mode.
 * Each agent retrieves from its own domain vectors and analyses the client report.
 * Returns a merged flat conflicts[] array across all domains.
 */
async function runAllDomainAgents({ query, history }) {
  const domainResults = await Promise.allSettled(
    LEGAL_DOMAINS.map(async (domain) => {
      let retrieved = [];
      try {
        const { items } = await retrievalAgent.retrieve({
          query,
          domain,
          history,
          topK: 5,
        });
        retrieved = items;
      } catch (err) {
        console.warn(`Retrieval failed for domain ${domain}:`, err.message);
      }

      if (!retrieved.length) {
        return { domain, conflicts: [], retrieved: [] };
      }

      const agent = domainAgentMap[domain];
      let analysis = { domain, conflicts: [] };
      try {
        analysis = await agent.analyze({ query, retrieved, history });
      } catch (err) {
        console.warn(`Agent analysis failed for domain ${domain}:`, err.message);
      }

      return {
        domain,
        conflicts: Array.isArray(analysis?.conflicts) ? analysis.conflicts : [],
        retrieved,
      };
    }),
  );

  // Collect all retrieved items and all conflicts from settled promises
  const allRetrieved = [];
  const allDomainAnalyses = [];

  domainResults.forEach((result) => {
    if (result.status === "fulfilled") {
      allRetrieved.push(...result.value.retrieved);
      allDomainAnalyses.push({
        domain: result.value.domain,
        conflicts: result.value.conflicts,
      });
    }
  });

  // Flatten conflicts, tagging each with its domain
  const conflicts = allDomainAnalyses.flatMap(({ domain, conflicts: items }) =>
    items.map((item) => ({ ...item, domain })),
  );

  return { conflicts, allRetrieved, allDomainAnalyses };
}

export async function handleQuery({ query, mode, user = null, history = [] }) {
  const orchestration = await detectDomain({
    query,
    mode,
    userDomain: user?.domain || null,
  });

  if (!orchestration.selected_domain && mode !== "lawyer") {
    return {
      mode,
      status: "ambiguous_domain",
      domain: null,
      answer:
        orchestration.candidate_domains.length > 0
          ? `This query may involve multiple legal domains: ${orchestration.candidate_domains.join(", ")}.`
          : "The legal domain could not be determined from the query.",
      review: {
        domainRouting: orchestration,
        missing_information: [
          "Clarify whether the issue belongs to criminal, civil, corporate, or tax law.",
        ],
      },
      sources: [],
    };
  }

  // ── GENERAL MODE ────────────────────────────────────────────────────────────
  if (mode === "general") {
    const { items: retrieved, rewrittenQuery } = await retrievalAgent.retrieve({
      query,
      domain: orchestration.selected_domain,
      history,
      topK: 5,
    });

    if (!retrieved.length) {
      return {
        mode,
        status: "no_laws_found",
        domain: orchestration.selected_domain,
        answer: "No sufficient retrieved legal basis found.",
        review: {
          domain: orchestration.selected_domain,
          domainRouting: orchestration,
          missing_information: [
            "No retrieved laws were found for the selected legal domain.",
          ],
        },
        sources: [],
      };
    }

    const generalResult = await generalAgent.respond({
      query,
      domain: orchestration.selected_domain,
      retrieved,
      history,
    });

    return {
      mode,
      status: "ok",
      domain: orchestration.selected_domain,
      rewrittenQuery,
      answer: generalResult.answer,
      review: {
        ...generalResult.report,
        domainRouting: orchestration,
      },
      sources: generalResult.sources,
    };
  }

  // ── LAWYER MODE — run ALL 4 domain agents in parallel ───────────────────────
  const { conflicts, allRetrieved, allDomainAnalyses } = await runAllDomainAgents({
    query,
    history,
  });

  if (!allRetrieved.length) {
    return {
      mode,
      status: "no_laws_found",
      domain: orchestration.selected_domain,
      answer: "No sufficient retrieved legal basis found.",
      review: {
        domain: orchestration.selected_domain,
        domainRouting: orchestration,
        conflicts: [],
        missing_information: [
          "No retrieved laws were found across any legal domain.",
        ],
      },
      sources: [],
    };
  }

  // Use primary domain for backward-compatible report generation
  const primaryDomain = orchestration.selected_domain || LEGAL_DOMAINS[0];
  const primaryDomainAnalysis = allDomainAnalyses.find((a) => a.domain === primaryDomain)
    || allDomainAnalyses[0]
    || { domain: primaryDomain, conflicts: [] };

  // Step 2: Run the "Master Linker" Audit on merged conflicts
  const auditedConflicts = await runComparisonAgent(query, conflicts);

  const lawyerReport = await reportAgent.generate({
    query,
    domain: primaryDomain,
    retrieved: allRetrieved,
    domainAnalysis: primaryDomainAnalysis,
    comparison: {}, // Unused in new multi-agent flow
    allDomainAnalyses,
    conflicts: auditedConflicts, 
    history,
  });

  return {
    mode,
    status: "ok",
    domain: primaryDomain,
    answer: lawyerReport.answer,
    review: {
      ...lawyerReport.report,
      conflicts: lawyerReport.conflicts,
      domainRouting: orchestration,
      domainAnalysis: primaryDomainAnalysis,
      allDomainAnalyses,
      comparison: {},
    },
    sources: lawyerReport.sources,
  };
}

export default { handleQuery };
