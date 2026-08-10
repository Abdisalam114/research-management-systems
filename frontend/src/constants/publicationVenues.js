/** Venue dropdown options keyed by publication output type. */

const OTHER = { value: "__other__", label: "Other (type name below)" };

const JOURNAL_VENUES = [
  { value: "BMC Public Health", label: "BMC Public Health" },
  { value: "BMJ Open", label: "BMJ Open" },
  { value: "Computers & Security", label: "Computers & Security" },
  { value: "Global Health Action", label: "Global Health Action" },
  { value: "Renewable Energy", label: "Renewable Energy" },
  { value: "Applied Energy", label: "Applied Energy" },
  { value: "The Lancet Digital Health", label: "The Lancet Digital Health" },
  { value: "Structural Health Monitoring", label: "Structural Health Monitoring" },
  { value: "FinTech Review", label: "FinTech Review" },
  OTHER,
];

const CONFERENCE_VENUES = [
  { value: "IEEE International Conference on Software Engineering Education", label: "IEEE ICSEE" },
  { value: "IEEE ICRERA", label: "IEEE ICRERA" },
  { value: "ACL Clinical NLP Workshop", label: "ACL Clinical NLP Workshop" },
  { value: "ACM SIGCHI", label: "ACM SIGCHI" },
  { value: "International Conference on Machine Learning (ICML)", label: "ICML" },
  { value: "NeurIPS", label: "NeurIPS" },
  OTHER,
];

const PUBLISHER_VENUES = [
  { value: "Springer", label: "Springer" },
  { value: "Oxford University Press", label: "Oxford University Press" },
  { value: "Cambridge University Press", label: "Cambridge University Press" },
  { value: "Elsevier", label: "Elsevier" },
  { value: "Wiley", label: "Wiley" },
  { value: "Taylor & Francis", label: "Taylor & Francis" },
  OTHER,
];

const PATENT_VENUES = [
  { value: "USPTO (United States)", label: "USPTO (United States)" },
  { value: "WIPO (International)", label: "WIPO (International)" },
  { value: "EPO (European Patent Office)", label: "EPO (European Patent Office)" },
  { value: "Somalia IP Office", label: "Somalia IP Office" },
  OTHER,
];

const THESIS_VENUES = [
  { value: "Jamhuriya University thesis archive", label: "Jamhuriya University thesis archive" },
  { value: "Faculty of Engineering & Technology", label: "Faculty of Engineering & Technology" },
  { value: "Faculty of Medicine & Health Sciences", label: "Faculty of Medicine & Health Sciences" },
  { value: "Faculty of Science", label: "Faculty of Science" },
  OTHER,
];

const COMMUNITY_VENUES = [
  { value: "Ministry / government partner", label: "Ministry / government partner" },
  { value: "Local NGO / community organization", label: "Local NGO / community organization" },
  { value: "Hospital / clinic network", label: "Hospital / clinic network" },
  { value: "School / education partner", label: "School / education partner" },
  { value: "Municipal / district program", label: "Municipal / district program" },
  OTHER,
];

const VENUE_OPTIONS_BY_TYPE = Object.freeze({
  paper: JOURNAL_VENUES,
  journal_article: JOURNAL_VENUES,
  review: JOURNAL_VENUES,
  case_study: JOURNAL_VENUES,
  letter_to_editor: JOURNAL_VENUES,
  conference: CONFERENCE_VENUES,
  book: PUBLISHER_VENUES,
  book_chapter: PUBLISHER_VENUES,
  patent: PATENT_VENUES,
  thesis: THESIS_VENUES,
  community_research_impact: COMMUNITY_VENUES,
});

const VENUE_LABEL_BY_TYPE = Object.freeze({
  paper: "Journal (name)",
  journal_article: "Journal (name)",
  review: "Journal (name)",
  case_study: "Journal / outlet (name)",
  letter_to_editor: "Journal (name)",
  conference: "Conference (name)",
  book: "Publisher (name)",
  book_chapter: "Publisher (name)",
  patent: "Patent office",
  thesis: "Thesis archive / faculty",
  community_research_impact: "Community partner / program",
});

export function venueLabelForType(type) {
  return VENUE_LABEL_BY_TYPE[type] || "Venue (name)";
}

export function venueOptionsForType(type) {
  return VENUE_OPTIONS_BY_TYPE[type] || [{ value: "", label: "Select output type first" }, OTHER];
}

export function isPresetVenue(type, venue) {
  const v = String(venue || "").trim();
  if (!v) return false;
  return (VENUE_OPTIONS_BY_TYPE[type] || []).some((o) => o.value !== OTHER.value && o.value === v);
}

export function venueSelectValue(type, venue) {
  const v = String(venue || "").trim();
  if (!v) return "";
  return isPresetVenue(type, v) ? v : OTHER.value;
}
