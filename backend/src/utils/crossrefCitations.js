const CROSSREF_USER_AGENT = "JustRMS/1.0 (mailto:research@just.edu.so)";

/** Re-fetch citation counts from CrossRef after this interval (7 days). */
const CITATION_REFRESH_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeDoi(doi) {
  if (!doi) return "";
  return String(doi).replace(/^https?:\/\/doi.org\//i, "").trim();
}

function isCitationRefreshStale(pub, now = Date.now()) {
  if (!normalizeDoi(pub?.doi)) return false;
  if (!pub.citationsRefreshedAt) return true;
  return now - new Date(pub.citationsRefreshedAt).getTime() > CITATION_REFRESH_STALE_MS;
}

async function fetchCitationCountFromDoi(doi) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return { count: null, source: "none" };

  try {
    const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
    const r = await fetch(apiUrl, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
    });
    if (!r.ok) return { count: null, source: "unavailable" };
    const data = await r.json();
    const count = data?.message?.["is-referenced-by-count"];
    if (typeof count === "number") return { count, source: "crossref" };
    return { count: null, source: "unavailable" };
  } catch {
    return { count: null, source: "unavailable" };
  }
}

/**
 * Refresh citationCount on a publication from CrossRef (best-effort).
 * @returns {{ updated: boolean, source: string, citationCount: number }}
 */
async function refreshPublicationCitations(pub, { force = false } = {}) {
  if (!pub?.doi || !normalizeDoi(pub.doi)) {
    return { updated: false, source: "none", citationCount: pub?.citationCount || 0 };
  }
  if (!force && !isCitationRefreshStale(pub)) {
    return { updated: false, source: "cached", citationCount: pub.citationCount || 0 };
  }

  const { count, source } = await fetchCitationCountFromDoi(pub.doi);
  if (source === "crossref" && typeof count === "number") {
    pub.citationCount = count;
    pub.citationsRefreshedAt = new Date();
    pub.citationsSource = "crossref";
    await pub.save();
    return { updated: true, source: "crossref", citationCount: count };
  }

  if (force || !pub.citationsRefreshedAt) {
    pub.citationsRefreshedAt = new Date();
    await pub.save();
  }
  return { updated: false, source, citationCount: pub.citationCount || 0 };
}

/** Refresh stale DOI-linked publications (cap per request to limit CrossRef load). */
async function refreshStalePublicationCitations(pubs, { limit = 5, force = false } = {}) {
  const candidates = (pubs || [])
    .filter((p) => normalizeDoi(p?.doi) && (force || isCitationRefreshStale(p)))
    .slice(0, limit);
  if (!candidates.length) return;
  await Promise.all(candidates.map((p) => refreshPublicationCitations(p, { force })));
}

module.exports = {
  CITATION_REFRESH_STALE_MS,
  normalizeDoi,
  isCitationRefreshStale,
  fetchCitationCountFromDoi,
  refreshPublicationCitations,
  refreshStalePublicationCitations,
};
