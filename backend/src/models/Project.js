const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const PROJECT_STATUSES = Object.freeze({
  ACTIVE: "active",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
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
    ...programTierField,
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = { Project, PROJECT_STATUSES };
