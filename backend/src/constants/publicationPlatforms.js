const PUBLISH_PLATFORMS = Object.freeze({
  JOURNAL_PUBLISHER: "journal_publisher",
  IEEE_XPLORE: "ieee_xplore",
  ACM_DIGITAL_LIBRARY: "acm_digital_library",
  SPRINGER: "springer",
  SCIENCEDIRECT: "sciencedirect",
  WILEY: "wiley",
  TAYLOR_FRANCIS: "taylor_francis",
  PUBMED: "pubmed",
  ARXIV: "arxiv",
  CONFERENCE_PROCEEDINGS: "conference_proceedings",
  INSTITUTIONAL_REPOSITORY: "institutional_repository",
  UNIVERSITY_THESIS: "university_thesis",
  PATENT_OFFICE: "patent_office",
  RESEARCHGATE: "researchgate",
  GOOGLE_SCHOLAR: "google_scholar",
  OTHER: "other",
});

const PUBLISH_PLATFORM_LABELS = Object.freeze({
  journal_publisher: "Journal / publisher website",
  ieee_xplore: "IEEE Xplore",
  acm_digital_library: "ACM Digital Library",
  springer: "SpringerLink",
  sciencedirect: "ScienceDirect (Elsevier)",
  wiley: "Wiley Online Library",
  taylor_francis: "Taylor & Francis Online",
  pubmed: "PubMed / PubMed Central",
  arxiv: "arXiv",
  conference_proceedings: "Conference proceedings portal",
  institutional_repository: "Institutional repository",
  university_thesis: "University thesis archive",
  patent_office: "Patent office (USPTO, WIPO, etc.)",
  researchgate: "ResearchGate",
  google_scholar: "Google Scholar",
  other: "Other website / platform",
});

const ALLOWED_PUBLISH_PLATFORMS = new Set(Object.keys(PUBLISH_PLATFORM_LABELS));

function normalizePublishPlatform(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return ALLOWED_PUBLISH_PLATFORMS.has(v) ? v : PUBLISH_PLATFORMS.OTHER;
}

function publishPlatformLabel(value) {
  return PUBLISH_PLATFORM_LABELS[value] || (value ? String(value).replace(/_/g, " ") : "");
}

module.exports = {
  PUBLISH_PLATFORMS,
  PUBLISH_PLATFORM_LABELS,
  ALLOWED_PUBLISH_PLATFORMS,
  normalizePublishPlatform,
  publishPlatformLabel,
};
