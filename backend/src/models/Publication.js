const mongoose = require("mongoose");

const PUBLICATION_TYPES = Object.freeze({
  JOURNAL: "journal_article",
  CONFERENCE: "conference_paper",
  BOOK: "book_chapter",
  PATENT: "patent",
  THESIS: "thesis",
  OTHER: "other",
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
    type: { type: String, enum: Object.values(PUBLICATION_TYPES), default: PUBLICATION_TYPES.JOURNAL, index: true },
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

module.exports = { Publication, PUBLICATION_TYPES, PUBLICATION_STATUSES };

