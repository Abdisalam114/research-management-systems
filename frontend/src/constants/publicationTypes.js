/** Core publication categories shown on tracking tiles (match director analytics). */
export const OUTPUT_TRACKING_CATEGORIES = [
  { id: "paper", label: "Papers", icon: "📄", types: ["paper"] },
  { id: "conference", label: "Conference", icon: "🎤", types: ["conference"] },
  { id: "review", label: "Review", icon: "📑", types: ["review"] },
  { id: "case_study", label: "Case studies", icon: "🔬", types: ["case_study"] },
  { id: "letter_to_editor", label: "Letter to editor", icon: "✉️", types: ["letter_to_editor"] },
  { id: "journal_article", label: "Journal articles", icon: "📰", types: ["journal_article"] },
  { id: "books", label: "Books / chapters", icon: "📖", types: ["book", "book_chapter"] },
  { id: "patent", label: "Patents", icon: "⚙️", types: ["patent"] },
  { id: "thesis", label: "Thesis", icon: "🎓", types: ["thesis"] },
  { id: "community", label: "Community impact", icon: "🌍", types: ["community_research_impact"] },
];

export const PUBLICATION_TYPE_OPTIONS = [
  { value: "paper", label: "Paper", group: "paper" },
  { value: "conference", label: "Conference paper", group: "conference" },
  { value: "review", label: "Review article", group: "review" },
  { value: "case_study", label: "Case study", group: "case_study" },
  { value: "letter_to_editor", label: "Letter to editor", group: "letter_to_editor" },
  { value: "journal_article", label: "Journal article", group: "journal_article" },
  { value: "book", label: "Book", group: "books" },
  { value: "book_chapter", label: "Book chapter", group: "books" },
  { value: "patent", label: "Patent", group: "patent" },
  { value: "community_research_impact", label: "Community research impact", group: "community" },
  { value: "thesis", label: "Thesis", group: "thesis" },
];

const LABEL_MAP = Object.fromEntries(PUBLICATION_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function publicationTypeLabel(type) {
  return LABEL_MAP[type] || type?.replace(/_/g, " ") || "—";
}

export function countByTrackingCategory(publications, category) {
  return publications.filter((p) => category.types.includes(p.type)).length;
}

export function matchesTrackingFilter(publication, filterId) {
  if (!filterId || filterId === "all") return true;
  const cat = OUTPUT_TRACKING_CATEGORIES.find((c) => c.id === filterId);
  if (!cat) return true;
  return cat.types.includes(publication.type);
}

/** Optgroup labels for the create form (order matches tracking tiles). */
export const FORM_TYPE_GROUPS = [
  { key: "paper", label: "Papers" },
  { key: "conference", label: "Conference" },
  { key: "review", label: "Review" },
  { key: "case_study", label: "Case studies" },
  { key: "letter_to_editor", label: "Letter to editor" },
  { key: "journal_article", label: "Journal articles" },
  { key: "books", label: "Books / chapters" },
  { key: "patent", label: "Patents" },
  { key: "community", label: "Community research impact" },
  { key: "thesis", label: "Thesis" },
];
