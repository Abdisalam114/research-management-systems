const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

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
  COMMUNITY_IMPACT: "community_research_impact",
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
  community_research_impact: "Community research impact",
});

const LEGACY_PUBLICATION_TYPE_MAP = Object.freeze({
  conference_paper: "conference",
  other: "letter_to_editor",
});

/** Institutional + international-style lifecycle statuses. */
const PUBLICATION_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVISION_REQUESTED: "revision_requested",
  VALIDATED: "validated",
  REJECTED: "rejected",
});

const PUBLICATION_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  submitted: "Under review",
  revision_requested: "Revise & resubmit",
  validated: "Accepted",
  rejected: "Rejected",
});

/**
 * Journal / venue decision (international peer-review style).
 * Distinct from institutional workflowStage; mirrors accept / reject / revise.
 */
const JOURNAL_DECISIONS = Object.freeze({
  PENDING: "pending",
  ACCEPT: "accept",
  REJECT: "reject",
  REVISE: "revise",
});

const JOURNAL_DECISION_LABELS = Object.freeze({
  pending: "Pending decision",
  accept: "Accept",
  reject: "Reject",
  revise: "Revise & resubmit",
});

/** Faculty research output pipeline — visible on coordinator dashboard. */
const WORKFLOW_STAGES = Object.freeze({
  SUBMITTED: "submitted",
  IN_PROCESS: "in_process",
  PIPELINE: "pipeline",
  PUBLISHED: "published",
});

const WORKFLOW_STAGE_LABELS = Object.freeze({
  submitted: "Submitted",
  in_process: "In process",
  pipeline: "Pipeline",
  published: "Published",
});

const reviewerCommentSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, default: "", trim: true },
    authorRole: { type: String, default: "", trim: true },
    comment: { type: String, required: true, trim: true },
    /** Optional decision attached to this comment (accept/reject/revise). */
    decision: {
      type: String,
      enum: Object.values(JOURNAL_DECISIONS),
      default: undefined,
    },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

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
    status: {
      type: String,
      enum: Object.values(PUBLICATION_STATUSES),
      default: PUBLICATION_STATUSES.DRAFT,
      index: true,
    },
    workflowStage: {
      type: String,
      enum: Object.values(WORKFLOW_STAGES),
      default: null,
      index: true,
    },

    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    validatedAt: { type: Date, default: null },
    validationComment: { type: String, default: "" },

    /** Latest journal-style decision (accept / reject / revise / pending). */
    journalDecision: {
      type: String,
      enum: Object.values(JOURNAL_DECISIONS),
      default: JOURNAL_DECISIONS.PENDING,
      index: true,
    },
    journalDecisionNote: { type: String, default: "", trim: true },
    journalDecisionAt: { type: Date, default: null },
    journalDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    /** Peer / staff / researcher review comments (international revise cycle). */
    reviewerComments: { type: [reviewerCommentSchema], default: [] },

    ...programTierField,
  },
  { timestamps: true }
);

// One output per project (1:1)
publicationSchema.index({ projectId: 1 }, { unique: true, sparse: true });

const Publication = mongoose.model("Publication", publicationSchema);

module.exports = {
  Publication,
  PUBLICATION_TYPES,
  PUBLICATION_TYPE_LABELS,
  PUBLICATION_STATUSES,
  PUBLICATION_STATUS_LABELS,
  JOURNAL_DECISIONS,
  JOURNAL_DECISION_LABELS,
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
  LEGACY_PUBLICATION_TYPE_MAP,
};
