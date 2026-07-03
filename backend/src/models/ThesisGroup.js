const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");
const { CHAPTER_STATUSES, TITLE_PROPOSAL_STATUSES } = require("../utils/thesisDefaults");

const THESIS_STATUSES = Object.freeze({
  PROPOSED: "proposed",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  DEFENDED: "defended",
  COMPLETED: "completed",
});

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    studentId: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
  },
  { _id: false }
);

const chapterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(CHAPTER_STATUSES),
      default: CHAPTER_STATUSES.PENDING,
    },
    notes: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const titleProposalSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(TITLE_PROPOSAL_STATUSES),
      default: TITLE_PROPOSAL_STATUSES.NONE,
    },
    proposedAt: { type: Date, default: null },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewNote: { type: String, default: "" },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    location: { type: String, default: "", trim: true },
    agenda: { type: String, default: "" },
    notes: { type: String, default: "" },
    chaptersDiscussed: { type: [String], default: [] },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const thesisGroupSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    titleProposal: { type: titleProposalSchema, default: () => ({ status: TITLE_PROPOSAL_STATUSES.NONE }) },
    students: { type: [studentSchema], default: [] },
    researchGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ResearchGroup", default: null, index: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    supervisorAssignedAt: { type: Date, default: null },
    chapters: { type: [chapterSchema], default: [] },
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    department: { type: String, default: "", trim: true },
    faculty: { type: String, default: "", trim: true, index: true },
    facultyResearchArea: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(THESIS_STATUSES),
      default: THESIS_STATUSES.PROPOSED,
      index: true,
    },
    meetingSchedule: { type: String, default: "", trim: true },
    meetings: { type: [meetingSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ...programTierField,
  },
  { timestamps: true }
);

const ThesisGroup = mongoose.model("ThesisGroup", thesisGroupSchema);

module.exports = { ThesisGroup, THESIS_STATUSES };
