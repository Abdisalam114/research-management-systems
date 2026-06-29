const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const NOTIFICATION_TYPES = Object.freeze({
  PROPOSAL: "proposal",
  PROJECT: "project",
  GRANT: "grant",
  BUDGET: "budget",
  PUBLICATION: "publication",
  REPOSITORY: "repository",
  ETHICS: "ethics",
  MESSAGE: "message",
  SYSTEM: "system",
});

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), default: NOTIFICATION_TYPES.SYSTEM, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    readAt: { type: Date, default: null, index: true },
    ...programTierField,
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES };

