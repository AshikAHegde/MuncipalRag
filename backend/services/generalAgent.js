const PLACEHOLDER_SECTION_PATTERN = /^match\s+\d+$/i;
const REQUESTED_SECTION_PATTERN = /\b(?:section|sec\.?|ipc|article|rule|order)\s+([0-9]+[A-Za-z-]*)\b/gi;
const ANY_SECTION_PATTERN = /\b(?:Section|IPC|Article|Rule|Order)\s+([0-9]+[A-Za-z-]*)\b/g;
const SECTION_LABEL_PATTERN =
  /\b(?:section|sec\.?|ipc|crpc|cpc|article|rule|order)\s+[0-9]+[A-Za-z-]*/i;

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(items = []) {
  return [...new Set(items.map(textValue).filter(Boolean))];
}

function editDistance(left = "", right = "") {
  const a = String(left);
  const b = String(right);
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function isSummaryQuery(query = "") {
  const normalized = String(query || "").toLowerCase();
  if (/\b(summary|summarize|summarise|overview|brief|gist|abstract|what is this about)\b/i.test(normalized)) {
    return true;
  }

  const summaryWords = ["summary", "summarize", "summarise"];
  return normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .some((token) =>
      summaryWords.some((word) =>
        Math.abs(token.length - word.length) <= 2 && editDistance(token, word) <= 2,
      ),
  );
}

function normalizeTitle(value = "") {
  return textValue(value)
    .replace(/\.(pdf|docx?|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRequestedSectionCodes(query = "") {
  return unique([...String(query || "").matchAll(REQUESTED_SECTION_PATTERN)]
    .map((match) => match[1]?.toUpperCase()));
}

function extractFirstSectionCode(text = "") {
  const match = textValue(text).match(SECTION_LABEL_PATTERN);
  return match?.[0]?.match(/[0-9]+[A-Za-z-]*/)?.[0]?.toUpperCase() || "";
}

function inferSectionLabel(item = {}, index = 0) {
  const explicitSection = textValue(item.section);

  if (explicitSection && !PLACEHOLDER_SECTION_PATTERN.test(explicitSection)) {
    const code = extractFirstSectionCode(explicitSection);
    return code ? `Section ${code}` : explicitSection;
  }

  const textCode = extractFirstSectionCode(item.text);
  if (textCode) {
    return `Section ${textCode}`;
  }

  const source = textValue(item.source);
  const page = item.page === 0 || item.page ? `page ${item.page}` : "";
  return [source, page].filter(Boolean).join(", ") || `Retrieved source ${index + 1}`;
}

function sourceLine(item = {}) {
  const source = textValue(item.source);
  const page = item.page === 0 || item.page ? `page ${item.page}` : "";
  const domain = textValue(item.domain);
  return [source, page, domain ? `domain: ${domain}` : ""].filter(Boolean).join("; ");
}

function primarySourceName(retrieved = []) {
  const counts = retrieved.reduce((acc, item) => {
    const source = textValue(item.source);
    if (!source) return acc;
    acc.set(source, (acc.get(source) || 0) + 1);
    return acc;
  }, new Map());

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
}

function filterToPrimarySource(retrieved = []) {
  const primarySource = primarySourceName(retrieved);
  return primarySource
    ? retrieved.filter((item) => textValue(item.source) === primarySource)
    : retrieved;
}

function findNextSectionStart(text, fromIndex) {
  ANY_SECTION_PATTERN.lastIndex = fromIndex;

  let match = ANY_SECTION_PATTERN.exec(text);
  while (match) {
    if (match.index > fromIndex) {
      return match.index;
    }

    match = ANY_SECTION_PATTERN.exec(text);
  }

  return -1;
}

function extractSectionText(text = "", requestedCode = "") {
  const cleaned = textValue(text).replace(/\s+/g, " ");

  if (!cleaned) {
    return "";
  }

  if (!requestedCode) {
    return cleaned;
  }

  const sectionPattern = new RegExp(`\\bSection\\s+${requestedCode}\\b`, "i");
  const match = sectionPattern.exec(cleaned);

  if (!match) {
    return cleaned;
  }

  const start = match.index;
  const nextStart = findNextSectionStart(cleaned, start + match[0].length);
  return cleaned.slice(start, nextStart === -1 ? undefined : nextStart).trim();
}

function cleanSectionText(text = "", code = "") {
  let cleaned = textValue(text)
    .replace(/\bKey points?\s*:.*/i, "")
    .replace(/\bCited sections?\s*:.*/i, "")
    .replace(/\bMatch\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (code) {
    cleaned = cleaned.replace(
      new RegExp(`^.*?\\bSection\\s+${code}\\b\\s*(?:Statutory\\s+Text)?\\s*:?\\s*`, "i"),
      "",
    );
  }

  return cleaned.trim();
}

function splitUsefulSentences(text = "") {
  return unique(
    (textValue(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 12),
  );
}

function mergeBrokenActNumberSentences(sentences = []) {
  return sentences.reduce((acc, sentence) => {
    const previous = acc[acc.length - 1] || "";

    if (/Act No\.$/i.test(previous) || /^\d+\s+of\s+\d{4}\)/i.test(sentence)) {
      acc[acc.length - 1] = `${previous} ${sentence}`.trim();
      return acc;
    }

    acc.push(sentence);
    return acc;
  }, []);
}

function documentTitleFromRetrieved(retrieved = []) {
  const sourceTitle = normalizeTitle(primarySourceName(retrieved) || retrieved.find((item) => item.source)?.source);
  if (sourceTitle) {
    return sourceTitle;
  }

  const firstLine = textValue(retrieved[0]?.text).split(/[.\n]/)[0];
  return normalizeTitle(firstLine) || "Retrieved Document";
}

function queryTokens(query = "") {
  return unique(
    String(query || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter((token) => !["give", "summary", "summarize", "summarise", "this", "the"].includes(token)),
  );
}

function scoreSummaryItem(item = {}, query = "") {
  const text = `${item.source || ""} ${item.text || ""}`.toLowerCase();
  const tokens = queryTokens(query);
  const tokenScore = tokens.reduce(
    (score, token) => score + (text.includes(token) ? 2 : 0),
    0,
  );
  const titleScore = /\b(act no\.?|an act to|code of|procedure|preamble)\b/i.test(item.text || "")
    ? 8
    : 0;
  const sectionPenalty = /\bsection\s+\d+/i.test(item.section || item.text || "")
    ? 4
    : 0;

  return tokenScore + titleScore - sectionPenalty;
}

function buildSummaryAnswer({ query, retrieved = [] }) {
  const scopedRetrieved = filterToPrimarySource(retrieved);
  const sorted = [...scopedRetrieved].sort(
    (left, right) => scoreSummaryItem(right, query) - scoreSummaryItem(left, query),
  );
  const title = documentTitleFromRetrieved(sorted.length ? sorted : scopedRetrieved);
  const source = sourceLine(sorted[0] || scopedRetrieved[0] || {});
  const sectionCards = buildSectionCards({ retrieved: scopedRetrieved, requestedCodes: [] })
    .filter((card) => /^Section\s+[0-9]/i.test(card.sectionLabel));
  const preambleSentences = sorted
    .filter((item) => !extractFirstSectionCode(item.section) && !extractFirstSectionCode(item.text))
    .flatMap((item) =>
      mergeBrokenActNumberSentences(splitUsefulSentences(cleanSectionText(item?.text || "")))
      .filter((sentence) => !/^section\s+\d+\b/i.test(sentence))
      .filter((sentence) => /\b(act|code|law|procedure|court|offence|punish|liable|fine|imprisonment|penalty)\b/i.test(sentence)),
    );
  const sectionLabels = unique(sectionCards.map((card) => card.sectionLabel)).slice(0, 8);
  const domain = textValue(sorted[0]?.domain || scopedRetrieved[0]?.domain);
  const overview = sectionLabels.length
    ? `This document contains ${domain ? `${domain} ` : ""}legal provisions including ${sectionLabels.join(", ")}.`
    : "";
  const summarySentences = preambleSentences.length
    ? unique(preambleSentences).slice(0, 4)
    : unique([overview]).slice(0, 1);
  const sectionSummaries = sectionCards.slice(0, 5).map((card) => {
    const firstPoint = card.points[0] || "";
    return firstPoint
      ? `${card.sectionLabel}: ${firstPoint}`
      : card.sectionLabel;
  });
  const bullets = unique([
    ...summarySentences,
    ...(preambleSentences.length ? [] : sectionSummaries),
  ]).slice(0, 6);

  if (!bullets.length) {
    return "No sufficient retrieved legal basis found.";
  }

  return [
    `### ${title}`,
    "",
    "**Summary:**",
    ...bullets.map((sentence) => `- ${sentence}`),
    ...(source ? ["", `**Source:** ${source}`] : []),
  ].join("\n");
}

function matchesRequestedCode(item = {}, requestedCode = "") {
  if (!requestedCode) {
    return true;
  }

  return [item.section, item.text]
    .map(textValue)
    .some((value) =>
      new RegExp(`\\b(?:Section|section|IPC|Article|Rule|Order)\\s+${requestedCode}\\b`).test(value),
    );
}

function buildSectionCards({ retrieved = [], requestedCodes = [] }) {
  const requestedSet = new Set(requestedCodes);
  const candidates = requestedCodes.length
    ? retrieved.filter((item) => requestedCodes.some((code) => matchesRequestedCode(item, code)))
    : retrieved;
  const seen = new Set();

  return candidates.flatMap((item, index) => {
    const itemCode = requestedCodes.find((code) => matchesRequestedCode(item, code))
      || extractFirstSectionCode(item.section)
      || extractFirstSectionCode(item.text);
    const sectionLabel = itemCode ? `Section ${itemCode}` : inferSectionLabel(item, index);
    const rawSectionText = extractSectionText(item.text, itemCode);
    const sectionText = cleanSectionText(rawSectionText, itemCode);
    const points = splitUsefulSentences(sectionText).slice(0, requestedSet.size ? 4 : 2);
    const dedupeKey = sectionLabel;

    if (!points.length || seen.has(dedupeKey)) {
      return [];
    }

    seen.add(dedupeKey);

    return [{
      sectionLabel,
      points,
      source: sourceLine(item),
    }];
  }).slice(0, requestedCodes.length ? requestedCodes.length : 5);
}

function buildFormattedAnswer({ query, retrieved = [] }) {
  const requestedCodes = extractRequestedSectionCodes(query);

  if (!requestedCodes.length && isSummaryQuery(query)) {
    return buildSummaryAnswer({ query, retrieved });
  }

  const cards = buildSectionCards({ retrieved, requestedCodes });

  if (!cards.length) {
    return "No sufficient retrieved legal basis found.";
  }

  const lines = [];

  if (requestedCodes.length) {
    const card = cards[0];
    lines.push(`### ${card.sectionLabel}`);
    lines.push("");
    lines.push("**What the law says:**");
    card.points.forEach((point) => lines.push(`- ${point}`));
    if (card.source) {
      lines.push("");
      lines.push(`**Source:** ${card.source}`);
    }
    return lines.join("\n");
  }

  lines.push("### Relevant Laws");
  cards.forEach((card) => {
    lines.push("");
    lines.push(`**${card.sectionLabel}**`);
    card.points.forEach((point) => lines.push(`- ${point}`));
    if (card.source) {
      lines.push(`- Source: ${card.source}`);
    }
  });

  return lines.join("\n");
}

export async function respond({ query, domain, retrieved, history = [] }) {
  const fallbackAnswer = buildFormattedAnswer({ query, retrieved });

  return {
    answer: fallbackAnswer,
    report: {
      domain,
      explanation: {
        selected_domain: domain,
        source_count: Array.isArray(retrieved) ? retrieved.length : 0,
      },
    },
    sources: retrieved,
  };
}

export const __test__ = {
  buildFormattedAnswer,
  isSummaryQuery,
};

export default { respond };
