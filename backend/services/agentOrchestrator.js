import {
  parseStructuredJson,
  listUploadedDocuments,
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

function buildConflictSolution(conflict = {}) {
  const explicitSolution =
    conflict.solution
    || conflict.recommended_solution
    || conflict.response
    || conflict.recommended_response
    || conflict.action_or_punishment;

  if (explicitSolution) {
    return explicitSolution;
  }

  const domain = String(conflict.domain || "").toLowerCase();
  const consequence = conflict.consequence
    ? ` Possible consequence: ${conflict.consequence}`
    : "";

  if (domain === "civil") {
    return `Prepare a civil remedy strategy for this issue, such as damages, injunction, or specific performance where supported by the retrieved provision.${consequence}`;
  }

  if (domain === "corporate") {
    return `Review governance/compliance records and prepare corrective filings, board action, or compliance remediation tied to this provision.${consequence}`;
  }

  if (domain === "tax") {
    return `Verify the tax records, quantify exposure, and prepare a response or compliance correction under the retrieved tax provision.${consequence}`;
  }

  if (domain === "criminal") {
    return `Preserve evidence, map the reported facts to each legal ingredient, and prepare complaint/defence steps for this provision.${consequence}`;
  }

  return `Review the facts against this provision and prepare the next legal response for this specific conflict.${consequence}`;
}

function normalizeConflict(item = {}, domain) {
  const normalized = {
    ...item,
    domain: item.domain || domain,
  };

  return {
    ...normalized,
    solution: buildConflictSolution(normalized),
  };
}

function fallbackDomainDetection(query) {
  const normalized = String(query || "").toLowerCase();
  const keywordMap = {
    criminal: ["crime", "criminal", "fraud", "theft", "assault", "police", "forgery", "cheating", "murder", "ipc"],
    civil: ["civil", "contract", "property", "compensation", "damages", "breach", "injunction", "procedure", "court"],
    corporate: ["corporate", "company", "board", "director", "shareholder", "compliance", "incorporation"],
    tax: ["tax", "gst", "income tax", "filing", "return", "deduction", "evasion", "penalty", "assessment"],
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

function isLawInventoryQuery(query = "") {
  const normalized = String(query || "").toLowerCase();
  const asksForCollection = /\b(all|every|list|show|display|catalogue|catalog|inventory)\b/.test(normalized);
  const mentionsLawSource = /\b(laws?|sections?|acts?|rules?|provisions?|pdfs?|documents?)\b/.test(normalized);
  const mentionsStorage = /\b(uploaded|library|database|stored|indexed|available|pdfs?|documents?|files?)\b/.test(normalized);
  const asksAllInPdf = /\b(all|every)\b.*\b(laws?|sections?|acts?|rules?|provisions?)\b.*\b(pdfs?|documents?|files?)\b/.test(normalized)
    || /\b(pdfs?|documents?|files?)\b.*\b(all|every)\b.*\b(laws?|sections?|acts?|rules?|provisions?)\b/.test(normalized);

  return mentionsLawSource && (asksAllInPdf || (asksForCollection && mentionsStorage));
}

function isDatabaseAvailabilityQuery(query = "") {
  const normalized = String(query || "").toLowerCase();
  const asksAvailability = /\b(do you have|available|any data|data about|in your database|stored|indexed)\b/.test(normalized);
  const mentionsLawSource = /\b(laws?|sections?|acts?|rules?|provisions?|pdfs?|documents?)\b/.test(normalized);

  return asksAvailability && mentionsLawSource;
}

function isSummaryStyleQuery(query = "") {
  return /\b(summary|summarize|summarise|sumarize|sumarise|overview|brief|gist|abstract)\b/i.test(
    String(query || ""),
  );
}

function formatDocumentLawLabel(document = {}, index = 0) {
  const section = String(document.section || "").trim();
  const fileName = String(document.fileName || document.originalName || "").trim();

  if (section) {
    return section;
  }

  return fileName
    ? `Unlabelled law document: ${fileName}`
    : `Uploaded law document ${index + 1}`;
}

function dedupeBy(items = [], getKey = (item) => item) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sourceLawLabel(item = {}, index = 0) {
  const section = String(item.section || "").trim();
  const source = String(item.source || "").trim();
  const page = item.page === 0 || item.page ? `page ${item.page}` : "";

  if (section && !/^match\s+\d+$/i.test(section)) {
    return section;
  }

  return [source, page].filter(Boolean).join(", ") || `Retrieved law ${index + 1}`;
}

async function retrieveLawInventoryFromIndex() {
  const { items } = await retrievalAgent.retrieve({
    query: "all laws sections acts rules legal provisions in uploaded pdf documents",
    topK: 25,
  });

  return dedupeBy(
    items.map((item, index) => ({
      ...item,
      lawLabel: sourceLawLabel(item, index),
    })),
    (item) => `${item.lawLabel}|${item.source}|${item.page}`,
  );
}

function buildIndexedLawResponse(items = [], { availabilityOnly = false } = {}) {
  if (!items.length) {
    return {
      mode: "general",
      status: "no_laws_found",
      domain: null,
      answer:
        "I could not find any processed PDF laws in the uploaded document library or vector index.",
      review: {
        missing_information: [
          "Upload and process at least one legal PDF before asking about laws.",
        ],
      },
      sources: [],
    };
  }

  const lines = availabilityOnly
    ? [`Yes. I found indexed legal data. The strongest available law entries are:`]
    : [`I found these indexed law entries from the uploaded PDF content:`];

  items.forEach((item, index) => {
    const details = [
      item.source ? `PDF: ${item.source}` : "",
      item.page === 0 || item.page ? `page: ${item.page}` : "",
      item.domain ? `domain: ${item.domain}` : "",
    ].filter(Boolean);

    lines.push(
      `${index + 1}. ${item.lawLabel}${details.length ? ` (${details.join("; ")})` : ""}`,
    );
  });

  return {
    mode: "general",
    status: "ok",
    domain: null,
    answer: lines.join("\n"),
    review: {
      note:
        "This list is based on retrieved vector-index content because processed document metadata was not available.",
    },
    sources: items.map((item) => ({
      page: item.page ?? "N/A",
      section: item.lawLabel,
      text: item.text || "",
      score: item.score ?? null,
      source: item.source || "",
      domain: item.domain || "",
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
    })),
  };
}

async function buildLawInventoryResponse({ user }) {
  const documents = (await listUploadedDocuments(user))
    .filter((document) => document.status === "processed")
    .sort((left, right) =>
      `${left.domain || ""}|${formatDocumentLawLabel(left)}`.localeCompare(
        `${right.domain || ""}|${formatDocumentLawLabel(right)}`,
      ),
    );

  if (!documents.length) {
    const indexedItems = await retrieveLawInventoryFromIndex();
    return buildIndexedLawResponse(indexedItems);
  }

  const grouped = documents.reduce((acc, document, index) => {
    const domain = document.domain || "general";
    const item = {
      ...document,
      lawLabel: formatDocumentLawLabel(document, index),
    };

    acc.set(domain, [...(acc.get(domain) || []), item]);
    return acc;
  }, new Map());

  const lines = [
    `I found ${documents.length} processed law PDF${documents.length === 1 ? "" : "s"} in the uploaded library:`,
  ];

  grouped.forEach((items, domain) => {
    lines.push("");
    lines.push(`${domain.toUpperCase()}:`);
    items.forEach((document, index) => {
      const details = [
        document.fileName ? `PDF: ${document.fileName}` : "",
        document.pages ? `pages: ${document.pages}` : "",
        Array.isArray(document.keywords) && document.keywords.length
          ? `keywords: ${document.keywords.join(", ")}`
          : "",
      ].filter(Boolean);

      lines.push(
        `${index + 1}. ${document.lawLabel}${details.length ? ` (${details.join("; ")})` : ""}`,
      );
    });
  });

  return {
    mode: "general",
    status: "ok",
    domain: null,
    answer: lines.join("\n"),
    review: {
      inventory: documents,
      note:
        "This list is based on the processed PDF metadata stored during upload.",
    },
    sources: documents.map((document, index) => ({
      page: document.pages || "N/A",
      section: formatDocumentLawLabel(document, index),
      text: [
        document.fileName ? `PDF: ${document.fileName}` : "",
        document.domain ? `Domain: ${document.domain}` : "",
        Array.isArray(document.keywords) && document.keywords.length
          ? `Keywords: ${document.keywords.join(", ")}`
          : "",
      ].filter(Boolean).join("\n"),
      score: null,
      source: document.fileName || "",
      domain: document.domain || "",
      keywords: Array.isArray(document.keywords) ? document.keywords : [],
    })),
  };
}

async function buildLawAvailabilityResponse({ user }) {
  const documents = (await listUploadedDocuments(user))
    .filter((document) => document.status === "processed");

  if (documents.length) {
    return {
      ...(await buildLawInventoryResponse({ user })),
      answer: `Yes. I found ${documents.length} processed law PDF${documents.length === 1 ? "" : "s"} in the uploaded document library.`,
    };
  }

  const indexedItems = await retrieveLawInventoryFromIndex();
  return buildIndexedLawResponse(indexedItems.slice(0, 10), { availabilityOnly: true });
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
      const fallback = fallbackDomainDetection(query);
      const parsedIsUnclear = !parsed.selected_domain || parsed.status === "ambiguous_domain";

      if (parsedIsUnclear && fallback.selected_domain) {
        return {
          mode,
          ...fallback,
          reasoning: `${fallback.reasoning} LLM routing was ambiguous: ${parsed.reasoning || "no reason provided"}`,
        };
      }

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
    items.map((item) => normalizeConflict(item, domain)),
  );

  return { conflicts, allRetrieved, allDomainAnalyses };
}

export async function handleQuery({ query, mode, user = null, history = [] }) {
  if (mode === "general" && isLawInventoryQuery(query)) {
    return buildLawInventoryResponse({ user });
  }

  if (mode === "general" && isDatabaseAvailabilityQuery(query)) {
    return buildLawAvailabilityResponse({ user });
  }

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
      topK: isSummaryStyleQuery(query) ? 12 : 5,
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

  // Step 2: Run the "Master Linker" Audit — filters irrelevant conflicts + tags cross-domain impact
  const comparisonConflicts = await runComparisonAgent(query, conflicts);
  const auditedConflicts = (
    Array.isArray(comparisonConflicts) ? comparisonConflicts : conflicts
  ).map((item) => normalizeConflict(item, item.domain));

  console.log(
    `Lawyer pipeline: ${conflicts.length} raw conflicts → ${auditedConflicts.length} after relevance filter`,
  );

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

export const __test__ = {
  fallbackDomainDetection,
  isDatabaseAvailabilityQuery,
  isLawInventoryQuery,
  isSummaryStyleQuery,
};

export default { handleQuery };
