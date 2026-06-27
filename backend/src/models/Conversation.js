const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true },
    at: { type: Date, default: Date.now, index: true },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: null, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "ResearchGroup", default: null, index: true },
    title: { type: String, default: "", trim: true },
    ...programTierField,
  },
  { timestamps: true }
);

conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = { Conversation };

