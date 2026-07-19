import {
  normalizeRetrievedMatch,
  searchLegalMatches,
} from "./ragService.js";

export async function retrieve({ query, domain, history = [], topK = 5 }) {
  const { rewrittenQuery, matches } = await searchLegalMatches({
    query,
    history,
    topK,
    domain,
  });

  return {
    rewrittenQuery,
    items: matches.map(normalizeRetrievedMatch),
  };
}

export default { retrieve };
