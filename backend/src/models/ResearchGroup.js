const mongoose = require("mongoose");

const GROUP_MEMBER_ROLES = Object.freeze({
  LEAD: "lead",
  MEMBER: "member",
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
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: [groupMemberSchema],
  },
  { timestamps: true }
);

const ResearchGroup = mongoose.model("ResearchGroup", researchGroupSchema);

module.exports = { ResearchGroup, GROUP_MEMBER_ROLES };

