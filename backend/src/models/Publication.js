const mongoose = require("mongoose");

const PUBLICATION_TYPES = Object.freeze({
  PAPER: "paper",
  JOURNAL: "journal_article",
  CONFERENCE: "conference",
  BOOK: "book",
  BOOK_CHAPTER: "book_chapter",
  PATENT: "patent",
  THESIS: "thesis",
  REVIEW: "review",
  CASE_STUDY: "case_study",
  LETTER_TO_EDITOR: "letter_to_editor",
});

const PUBLICATION_TYPE_LABELS = Object.freeze({
  paper: "Paper",
  journal_article: "Journal article",
  conference: "Conference paper",
  book: "Book",
  book_chapter: "Book chapter",
  patent: "Patent",
  thesis: "Thesis",
  review: "Review",
  case_study: "Case study",
  letter_to_editor: "Letter to editor",
});

const LEGACY_PUBLICATION_TYPE_MAP = Object.freeze({
  conference_paper: "conference",
  other: "letter_to_editor",
});

const PUBLICATION_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  VALIDATED: "validated",
  REJECTED: "rejected",
});

const publicationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(PUBLICATION_TYPES),
      default: PUBLICATION_TYPES.PAPER,
      index: true,
      set: (v) => (v && LEGACY_PUBLICATION_TYPE_MAP[v]) || v,
    },
    year: { type: Number, min: 1900, max: 3000, default: new Date().getFullYear(), index: true },
    venue: { type: String, default: "", trim: true },
    doi: { type: String, default: "", trim: true, index: true },
    orcid: { type: String, default: "", trim: true, index: true },
    url: { type: String, default: "", trim: true },
    authors: [{ type: String, trim: true }],
    citationCount: { type: Number, min: 0, default: 0 },
    communityImpact: { type: String, default: "", trim: true },
    status: { type: String, enum: Object.values(PUBLICATION_STATUSES), default: PUBLICATION_STATUSES.DRAFT, index: true },

    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    validatedAt: { type: Date, default: null },
    validationComment: { type: String, default: "" },
  },
  { timestamps: true }
);

const Publication = mongoose.model("Publication", publicationSchema);

module.exports = {
  Publication,
  PUBLICATION_TYPES,
  PUBLICATION_TYPE_LABELS,
  PUBLICATION_STATUSES,
  LEGACY_PUBLICATION_TYPE_MAP,
};

