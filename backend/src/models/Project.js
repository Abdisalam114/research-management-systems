const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const PROJECT_STATUSES = Object.freeze({
  ACTIVE: "active",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
  CLOSING: "closing",
  CLOSED: "closed",
});

const CLOSURE_STATUSES = Object.freeze({
  NONE: "none",
  SUBMITTED: "submitted",
  DIRECTOR_APPROVED: "director_approved",
  FINANCE_APPROVED: "finance_approved",
  ARCHIVED: "archived",
});

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date, default: null },
  completed: { type: Boolean, default: false },
});

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  role: { type: String, default: "member", trim: true },
});

const progressReportSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const workPlanItemSchema = new mongoose.Schema(
  {
    phase: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    owner: { type: String, default: "", trim: true },
    status: { type: String, enum: ["planned", "in_progress", "completed"], default: "planned" },
  },
  { _id: true }
);

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ["todo", "in_progress", "done", "blocked"], default: "todo" },
    assignedTo: { type: String, default: "", trim: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true, timestamps: true }
);

const communicationLogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["note", "email", "meeting", "decision", "other"], default: "note" },
    subject: { type: String, default: "", trim: true },
    body: { type: String, required: true },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: "Proposal", index: true },
    /** @deprecated legacy field — use proposalId */
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: "Proposal", index: true },
    title: { type: String, required: true, trim: true },
    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    /** @deprecated legacy field — use researcherId (Principal Investigator) */
    leadResearcher: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    teamMembers: [teamMemberSchema],
    milestones: [milestoneSchema],
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    status: { type: String, enum: Object.values(PROJECT_STATUSES), default: PROJECT_STATUSES.ACTIVE, index: true },
    progressReports: [progressReportSchema],
    workPlan: [workPlanItemSchema],
    activities: [activitySchema],
    communicationLog: [communicationLogSchema],
    closure: {
      status: { type: String, enum: Object.values(CLOSURE_STATUSES), default: CLOSURE_STATUSES.NONE },
      finalReport: { type: String, default: "" },
      finalReportDocument: { type: String, default: null },
      auditNotes: { type: String, default: "" },
      assetHandover: { type: String, default: "" },
      lessonsLearned: { type: String, default: "" },
      checklist: {
        publicationsArchived: { type: Boolean, default: false },
        assetsHandedOver: { type: Boolean, default: false },
        dataArchived: { type: Boolean, default: false },
        financialCleared: { type: Boolean, default: false },
        ethicsClosed: { type: Boolean, default: false },
      },
      submittedAt: { type: Date, default: null },
      directorApprovedAt: { type: Date, default: null },
      directorApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      financeApprovedAt: { type: Date, default: null },
      financeApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      archivedAt: { type: Date, default: null },
    },
    ...programTierField,
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = { Project, PROJECT_STATUSES, CLOSURE_STATUSES };
