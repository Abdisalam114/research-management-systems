const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    faculty: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ...programTierField,
  },
  { timestamps: true }
);

departmentSchema.index({ name: 1, programTier: 1 }, { unique: true });
departmentSchema.index({ code: 1, programTier: 1 }, { unique: true });

const Department = mongoose.model("Department", departmentSchema);

module.exports = { Department };
