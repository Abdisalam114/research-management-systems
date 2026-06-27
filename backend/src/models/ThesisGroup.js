const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

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

const meetingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    location: { type: String, default: "", trim: true },
    agenda: { type: String, default: "" },
    notes: { type: String, default: "" },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const thesisGroupSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    students: { type: [studentSchema], default: [] },
    // Collaboration / chat group created for this thesis group
    researchGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ResearchGroup", default: null, index: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
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
