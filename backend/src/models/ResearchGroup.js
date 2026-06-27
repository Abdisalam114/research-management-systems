const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const GROUP_MEMBER_ROLES = Object.freeze({
  LEAD: "lead",
  MEMBER: "member",
});

const GROUP_KINDS = Object.freeze({
  COLLABORATION: "collaboration",
  THESIS: "thesis",
});

const groupMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: Object.values(GROUP_MEMBER_ROLES), default: GROUP_MEMBER_ROLES.MEMBER },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const researchGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    kind: { type: String, enum: Object.values(GROUP_KINDS), default: GROUP_KINDS.COLLABORATION, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: [groupMemberSchema],
    ...programTierField,
  },
  { timestamps: true }
);

researchGroupSchema.index({ name: 1, programTier: 1 }, { unique: true });

const ResearchGroup = mongoose.model("ResearchGroup", researchGroupSchema);

module.exports = { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS };

