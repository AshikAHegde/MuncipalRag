import { REPORT_PROMPT } from "./agentPrompts.js";
import { runJsonAgent } from "./legalAgentUtils.js";

function toList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => textValue(item)).filter(Boolean).join(" | ");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => textValue(item)).filter(Boolean).join(" | ");
  }
  return "";
}

function parseSectionCode(section = "") {
  const match = textValue(section).match(/\b(\d{3,4})\b/);
  return match?.[1] || "";
}

function parseSectionName(section = "") {
  const raw = textValue(section);
  if (!raw) return "";
  const parts = raw.split(/[-–:]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(1).join(" - ");
  }
  return raw.replace(/\bIPC\b|\bSection\b|\b\d{3,4}\b/gi, "").replace(/[-–:]/g, "").trim();
}

function normalizeSectionLabel(section = "") {
  const code = parseSectionCode(section);
  const name = parseSectionName(section);
  if (!code) return textValue(section) || "Insufficient data";
  return `IPC ${code}${name ? ` - ${name}` : ""}`;
}

function formatSectionHeading(section = "") {
  const code = parseSectionCode(section);
  const name = parseSectionName(section);
  if (!code) return textValue(section) || "Insufficient data";
  return `IPC ${code}${name ? ` – ${name}` : ""}`;
}

function getPunishment(section) {
  const code = parseSectionCode(section);

  if (code === "420") {
    return "Up to 7 years imprisonment + fine";
  }

  if (code === "503") {
    return "Imprisonment and/or fine";
  }

  return "Imprisonment and/or fine (as per IPC)";
}

function getFactTextList(query = "") {
  return String(query || "")
    .toLowerCase()
    .split(/[.?!]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasPublication(facts = [], query = "") {
  const haystack = `${facts.join(" ")} ${String(query).toLowerCase()}`;
  return /(published|publication|circulated|shared with others|publicly stated|made public|told others|posted)/i.test(haystack);
}

function hasPhysicalEntry(facts = [], query = "") {
  const haystack = `${facts.join(" ")} ${String(query).toLowerCase()}`;
  return /(entered|entry|came into the house|came into the property|trespassed|broke in|physically entered)/i.test(haystack);
}

function hasAssaultGesture(facts = [], query = "") {
  const haystack = `${facts.join(" ")} ${String(query).toLowerCase()}`;
  return /(raised hand|gesture|lunged|moved to hit|prepared to strike|brandished|attempt to use force|physical threat|apprehension of force)/i.test(haystack);
}

function hasCheatingFacts(facts = [], query = "") {
  const haystack = `${facts.join(" ")} ${String(query).toLowerCase()}`;
  const falsePromise = /(false promise|promised|misrepresentation|deceived|induced|dishonest)/i.test(haystack);
  const moneyTransfer = /(money|paid|payment|transferred|sent.*money|delivery of property|amount)/i.test(haystack);
  const nonDelivery = /(did not fulfil|did not deliver|stopped responding|refund|failed to perform|no delivery)/i.test(haystack);
  return [falsePromise, moneyTransfer, nonDelivery].filter(Boolean).length >= 2;
}

function scoreMatches(sectionItem) {
  const keyMatches = toList(sectionItem?.key_match).map((item) => textValue(item)).filter(Boolean);
  const whyApplicable = textValue(sectionItem?.why_applicable);
  let score = 0;

  keyMatches.forEach((item) => {
    const normalized = item.toLowerCase();
    if (/[✔✓]/.test(normalized)) {
      score += 1;
    } else if (!/[❌✘]/.test(normalized)) {
      score += 1;
    }
  });

  if (whyApplicable) {
    score += 1;
  }

  return score;
}

function isLawApplicable(law, query, facts = []) {
  const code = parseSectionCode(law?.section);
  const matchedElements = scoreMatches(law);

  if (matchedElements < 2) {
    return false;
  }

  if (code === "415") {
    return false;
  }

  if (code === "420") {
    return hasCheatingFacts(facts, query);
  }

  if (code === "499") {
    return hasPublication(facts, query);
  }

  if (code === "441") {
    return hasPhysicalEntry(facts, query);
  }

  if (code === "351") {
    return hasAssaultGesture(facts, query);
  }

  return true;
}

function buildReason(query, item, comparison = {}, domainAnalysis = {}) {
  const likelyMatches = toList(comparison?.likely_matches)
    .map((entry) => textValue(entry))
    .filter(Boolean);
  const matchedFacts = toList(domainAnalysis?.matched_facts)
    .map((entry) => textValue(entry))
    .filter(Boolean);

  return (
    likelyMatches.find((entry) =>
      entry.toLowerCase().includes(parseSectionCode(item.section || "")),
    )
    || matchedFacts[0]
    || `The reported facts in "${query}" align with the core ingredients of ${normalizeSectionLabel(item.section)}.`
  );
}

function buildDescription(item) {
  const code = parseSectionCode(item.section);
  const name = parseSectionName(item.section);

  if (code === "420") {
    return "Cheating involves deceiving a person to dishonestly obtain money or property.";
  }

  if (code === "503") {
    return "Criminal intimidation involves threatening a person to cause fear, injury, or reputational harm.";
  }

  return name
    ? `${name} is addressed under ${normalizeSectionLabel(item.section)} based on the retrieved legal text.`
    : `This provision is addressed under ${normalizeSectionLabel(item.section)} based on the retrieved legal text.`;
}

function collectCandidateSections({ query, retrieved = [], domainAnalysis = {}, comparison = {} }) {
  const facts = [
    ...toList(domainAnalysis?.matched_facts),
    ...toList(comparison?.likely_matches),
    ...getFactTextList(query),
  ]
    .map((item) => textValue(item))
    .filter(Boolean);

  const applicableSections = new Set(
    toList(domainAnalysis?.applicable_sections)
      .map((item) => parseSectionCode(item))
      .filter(Boolean),
  );

  let candidates = retrieved
    .filter((item) => {
      const code = parseSectionCode(item.section);
      return code && (applicableSections.has(code) || applicableSections.size === 0);
    })
    .map((item) => ({
      section: normalizeSectionLabel(item.section),
      description: buildDescription(item),
      why_applicable: buildReason(query, item, comparison, domainAnalysis),
      key_match: getFactTextList(query).slice(0, 3),
      result: getPunishment(item.section),
      rawText: item.text || "",
    }))
    .filter((item) => isLawApplicable(item, query, facts));

  const has420 = candidates.some((item) => parseSectionCode(item.section) === "420");
  if (has420) {
    candidates = candidates.filter((item) => parseSectionCode(item.section) !== "415");
  }

  const deduped = [];
  const seen = new Set();
  candidates.forEach((item) => {
    const code = parseSectionCode(item.section);
    if (!seen.has(code)) {
      seen.add(code);
      deduped.push(item);
    }
  });

  return {
    facts,
    sections: deduped.slice(0, 3),
  };
}

function buildRejectedSections({ query, retrieved = [], facts = [], includedCodes = new Set() }) {
  const rejected = [];

  retrieved.forEach((item) => {
    const label = normalizeSectionLabel(item.section);
    const code = parseSectionCode(label);
    if (!code || includedCodes.has(code)) {
      return;
    }

    if (code === "499" && !hasPublication(facts, query)) {
      rejected.push(label);
      return;
    }

    if (code === "441" && !hasPhysicalEntry(facts, query)) {
      rejected.push(label);
      return;
    }

    if (code === "351" && !hasAssaultGesture(facts, query)) {
      rejected.push(label);
    }
  });

  return [...new Set(rejected)].slice(0, 2);
}

function buildFallbackReport({ query, domain, retrieved, domainAnalysis, comparison }) {
  const { facts, sections } = collectCandidateSections({
    query,
    retrieved,
    domainAnalysis,
    comparison,
  });

  const rejected = buildRejectedSections({
    query,
    retrieved,
    facts,
    includedCodes: new Set(sections.map((item) => parseSectionCode(item.section))),
  });

  const summary =
    sections.length > 0
      ? `The facts suggest possible ${domain} law issues. The listed sections are the strongest matches based on the retrieved legal text.`
      : "Insufficient data to confirm a clearly applicable IPC section from the retrieved legal material.";

  return {
    domain,
    facts,
    sections,
    summary,
    not_applicable: rejected,
    disclaimer:
      "This is an AI-assisted legal research output based only on retrieved laws and is not a final legal opinion.",
    sources: retrieved,
  };
}

function pickUpToTwoSentences(value, fallback = "Insufficient data") {
  const text = textValue(value) || fallback;
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length === 0) return fallback;
  return sentences.slice(0, 2).join(" ");
}

function formatResultLine(value, sectionLabel) {
  const raw = (textValue(value) || getPunishment(sectionLabel)).toLowerCase();
  const hasFine = /fine/.test(raw);
  const hasJail = /(jail|imprisonment)/.test(raw);

  if (hasFine && hasJail) {
    return `Both: ${textValue(value) || getPunishment(sectionLabel)}`;
  }

  if (hasJail) {
    return `Jail: ${textValue(value) || getPunishment(sectionLabel)}`;
  }

  if (hasFine) {
    return `Fine: ${textValue(value) || getPunishment(sectionLabel)}`;
  }

  return `Result unclear: ${textValue(value) || getPunishment(sectionLabel)}`;
}

function buildSummaryLines(summaryText, sections = []) {
  const cleaned = textValue(summaryText).replace(/\s+/g, " ").trim();
  const lines = cleaned
    ? cleaned
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
    : [];

  if (lines.length === 0) {
    if (sections.length === 0) {
      return [
        "Insufficient data to confirm a clearly applicable section.",
        "Provide more specific facts to map legal ingredients precisely.",
      ];
    }

    const labels = sections.map((item) => formatSectionHeading(item.section));
    return [
      `Affected sections based on the reported facts: ${labels.join(", ")}.`,
      "These matches are grounded in retrieved legal text only.",
    ];
  }

  if (lines.length === 1) {
    const labels = sections.map((item) => formatSectionHeading(item.section));
    lines.push(
      labels.length > 0
        ? `Affected sections: ${labels.join(", ")}.`
        : "Conclusion is based on retrieved legal text only.",
    );
  }

  return lines.slice(0, 3);
}

function normalizeFinalSections({ sections = [], fallbackSections = [], query = "", facts = [] }) {
  const fallbackByCode = new Map(
    toList(fallbackSections)
      .map((item) => [parseSectionCode(item?.section), item])
      .filter(([code]) => Boolean(code)),
  );

  const normalized = toList(sections)
    .map((item) => {
      const code = parseSectionCode(item?.section);
      const rawSection = textValue(item?.section);
      const isPlaceholder = /^\s*match\s*\d+\s*$/i.test(rawSection);
      if (isPlaceholder || (!code && !rawSection)) return null;

      const fallbackItem = fallbackByCode.get(code);
      const sectionLabel = code
        ? normalizeSectionLabel(item?.section || fallbackItem?.section || `IPC ${code}`)
        : rawSection;

      return {
        section: sectionLabel,
        description: textValue(item?.description) || textValue(fallbackItem?.description) || buildDescription({ section: sectionLabel }),
        why_applicable: textValue(item?.why_applicable) || textValue(fallbackItem?.why_applicable) || "Insufficient data",
        key_match: toList(item?.key_match).length > 0 ? toList(item?.key_match) : toList(fallbackItem?.key_match),
        result: textValue(item?.result) || textValue(fallbackItem?.result) || getPunishment(sectionLabel),
      };
    })
    .filter(Boolean)
    .filter((item) => isLawApplicable(item, query, facts));

  const deduped = [];
  const seen = new Set();
  normalized.forEach((item) => {
    const code = parseSectionCode(item.section);
    const sectionKey = code || textValue(item.section).toLowerCase();
    if (!sectionKey || seen.has(sectionKey)) return;
    seen.add(sectionKey);
    deduped.push(item);
  });

  return deduped.slice(0, 3);
}

export async function generate({
  query,
  domain,
  retrieved,
  domainAnalysis,
  comparison,
  allDomainAnalyses = [],
  conflicts = [],
  history = [],
}) {
  const fallback = buildFallbackReport({
    query,
    domain,
    retrieved,
    domainAnalysis,
    comparison,
  });

  const structured = await runJsonAgent({
    prompt: `${REPORT_PROMPT}

Comparison result:
${JSON.stringify(comparison, null, 2)}

Domain analysis:
${JSON.stringify(domainAnalysis, null, 2)}`,
    query,
    retrieved,
    history,
    fallback: () => fallback,
  });

  const report = {
    ...fallback,
    ...structured,
    domain,
  };

  // Supplement sections with items from conflicts if sections are lacking
  const rawSections = toList(report.sections);
  if (rawSections.length === 0 && conflicts.length > 0) {
    conflicts.slice(0, 3).forEach(c => {
      rawSections.push({
        section: c.section,
        description: c.issue_meaning || buildDescription(c),
        why_applicable: c.why_flagged || "Detected across domain scan.",
        result: c.consequence || getPunishment(c.section),
        key_match: [c.domain]
      });
    });
  }

  const finalSections = normalizeFinalSections({
    sections: rawSections,
    fallbackSections: fallback.sections,
    query,
    facts: fallback.facts,
  });
  const sectionsToRender = finalSections.length > 0 ? finalSections : fallback.sections;

  // Use conflicts to improve summary if needed
  let finalSummary = textValue(report.summary) || fallback.summary;
  if ((!finalSummary || finalSummary.includes("Insufficient data")) && conflicts.length > 0) {
    const conflictDomains = [...new Set(conflicts.map(c => c.domain))];
    finalSummary = `An audit of ${conflictDomains.join(", ")} legal domains identified ${conflicts.length} potential issues. The following sections were flagged as most relevant to the reported facts.`;
  }
  const summaryLines = buildSummaryLines(finalSummary, sectionsToRender);

  const answerLines = [];

  sectionsToRender.forEach((item, index) => {
    const sectionLabel = formatSectionHeading(item.section);
    answerLines.push(`Section: ${sectionLabel}`);
    answerLines.push("");
    answerLines.push("Description:");
    answerLines.push(`- ${pickUpToTwoSentences(textValue(item.description) || buildDescription(item))}`);
    answerLines.push("");
    answerLines.push("Reason:");
    answerLines.push(`- ${pickUpToTwoSentences(textValue(item.why_applicable) || "Insufficient data")}`);
    answerLines.push("");
    answerLines.push("Result:");
    answerLines.push(`- ${formatResultLine(item.result, sectionLabel)}`);

    if (index < sectionsToRender.length - 1) {
      answerLines.push("");
      answerLines.push("---");
      answerLines.push("");
    }
  });

  answerLines.push("");
  answerLines.push("Summary:");
  summaryLines.forEach((line) => {
    answerLines.push(`- ${line}`);
  });

  return {
    answer: answerLines.join("\n"),
    report,
    conflicts,
    sources: report.sources || retrieved,
  };
}

export default { generate };
