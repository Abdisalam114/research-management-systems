const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = { Conversation };

