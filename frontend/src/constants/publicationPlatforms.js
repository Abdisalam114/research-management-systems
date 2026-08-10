/** Where the output is published online (publisher portal, repository, etc.). */
export const PUBLISH_PLATFORM_OPTIONS = [
  { value: "", label: "Select publishing platform / website…" },
  { value: "journal_publisher", label: "Journal / publisher website" },
  { value: "ieee_xplore", label: "IEEE Xplore" },
  { value: "acm_digital_library", label: "ACM Digital Library" },
  { value: "springer", label: "SpringerLink" },
  { value: "sciencedirect", label: "ScienceDirect (Elsevier)" },
  { value: "wiley", label: "Wiley Online Library" },
  { value: "taylor_francis", label: "Taylor & Francis Online" },
  { value: "pubmed", label: "PubMed / PubMed Central" },
  { value: "arxiv", label: "arXiv" },
  { value: "conference_proceedings", label: "Conference proceedings portal" },
  { value: "institutional_repository", label: "Institutional repository" },
  { value: "university_thesis", label: "University thesis archive" },
  { value: "patent_office", label: "Patent office (USPTO, WIPO, etc.)" },
  { value: "researchgate", label: "ResearchGate" },
  { value: "google_scholar", label: "Google Scholar" },
  { value: "other", label: "Other website / platform" },
];

const PLATFORM_LABELS = Object.fromEntries(
  PUBLISH_PLATFORM_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

export function publishPlatformLabel(value) {
  return PLATFORM_LABELS[value] || value?.replace(/_/g, " ") || "—";
}

export function publishPlatformUrlPlaceholder(platform) {
  const map = {
    journal_publisher: "https://journal.example.com/article/…",
    ieee_xplore: "https://ieeexplore.ieee.org/document/…",
    acm_digital_library: "https://dl.acm.org/doi/…",
    springer: "https://link.springer.com/article/…",
    sciencedirect: "https://www.sciencedirect.com/science/article/…",
    wiley: "https://onlinelibrary.wiley.com/doi/…",
    taylor_francis: "https://www.tandfonline.com/doi/…",
    pubmed: "https://pubmed.ncbi.nlm.nih.gov/…",
    arxiv: "https://arxiv.org/abs/…",
    conference_proceedings: "https://proceedings.example.org/paper/…",
    institutional_repository: "https://repository.university.edu/handle/…",
    university_thesis: "https://library.university.edu/thesis/…",
    patent_office: "https://patents.google.com/patent/…",
    researchgate: "https://www.researchgate.net/publication/…",
    google_scholar: "https://scholar.google.com/…",
    other: "https://…",
  };
  return map[platform] || "https://… link to the published version";
}

/** Suggest platform from output type (researcher can override). */
export function suggestPublishPlatform(outputType) {
  const map = {
    paper: "journal_publisher",
    journal_article: "journal_publisher",
    conference: "conference_proceedings",
    review: "journal_publisher",
    case_study: "journal_publisher",
    letter_to_editor: "journal_publisher",
    book: "springer",
    book_chapter: "springer",
    patent: "patent_office",
    thesis: "university_thesis",
    community_research_impact: "institutional_repository",
  };
  return map[outputType] || "";
}
