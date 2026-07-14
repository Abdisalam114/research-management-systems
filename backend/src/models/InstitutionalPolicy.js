const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const institutionalPolicySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    category: {
      type: String,
      enum: ["research", "funding", "ethics", "general"],
      default: "general",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ...programTierField,
  },
  { timestamps: true }
);

const InstitutionalPolicy = mongoose.model("InstitutionalPolicy", institutionalPolicySchema);

module.exports = { InstitutionalPolicy };
