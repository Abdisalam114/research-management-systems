const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { IDENTIFIER_PREFIX } = require("../utils/oaiPmh");

const SET_REPO = "repo:institution";
const SET_PUBLICATIONS = "publications:validated";

async function loadAllOaiRecords() {
  const [repoItems, publications] = await Promise.all([
    RepositoryItem.find({ access: REPOSITORY_ACCESS.INSTITUTION }).sort({ updatedAt: -1 }).limit(2000),
    Publication.find({ status: PUBLICATION_STATUSES.VALIDATED }).sort({ updatedAt: -1 }).limit(2000),
  ]);

  const records = [];

  repoItems.forEach((it) => {
    records.push({
      identifier: `${IDENTIFIER_PREFIX}:repo:${it._id}`,
      datestamp: it.updatedAt || it.createdAt,
      title: it.title,
      type: it.type,
      description: it.description,
      tags: it.tags || [],
      filePath: it.filePath,
      url: "",
      setSpec: SET_REPO,
      source: "repo",
      sourceId: String(it._id),
    });
  });

  publications.forEach((p) => {
    records.push({
      identifier: `${IDENTIFIER_PREFIX}:publication:${p._id}`,
      datestamp: p.updatedAt || p.createdAt,
      title: p.title,
      type: p.type,
      description: p.communityImpact || p.venue || "",
      tags: p.authors || [],
      filePath: "",
      url: p.url || (p.doi ? `https://doi.org/${p.doi}` : ""),
      setSpec: SET_PUBLICATIONS,
      source: "publication",
      sourceId: String(p._id),
    });
  });

  records.sort((a, b) => new Date(b.datestamp) - new Date(a.datestamp));
  return records;
}

function filterRecords(records, { set, from, until, identifier }) {
  let filtered = records;

  if (set) {
    filtered = filtered.filter((r) => r.setSpec === set);
  }

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      filtered = filtered.filter((r) => new Date(r.datestamp) >= fromDate);
    }
  }

  if (until) {
    const untilDate = new Date(until);
    if (!Number.isNaN(untilDate.getTime())) {
      filtered = filtered.filter((r) => new Date(r.datestamp) <= untilDate);
    }
  }

  if (identifier) {
    filtered = filtered.filter((r) => r.identifier === identifier);
  }

  return filtered;
}

async function findRecordByIdentifier(identifier) {
  const records = await loadAllOaiRecords();
  return records.find((r) => r.identifier === identifier) || null;
}

async function earliestDatestamp() {
  const records = await loadAllOaiRecords();
  if (!records.length) return new Date(0).toISOString();
  const oldest = records.reduce((min, r) => {
    const t = new Date(r.datestamp).getTime();
    return t < min ? t : min;
  }, Date.now());
  return new Date(oldest).toISOString();
}

module.exports = {
  SET_REPO,
  SET_PUBLICATIONS,
  loadAllOaiRecords,
  filterRecords,
  findRecordByIdentifier,
  earliestDatestamp,
};
