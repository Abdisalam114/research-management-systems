const mongoose = require("mongoose");

const REPOSITORY_ITEM_TYPES = Object.freeze({
  DATASET: "dataset",
  PUBLICATION: "publication",
  THESIS: "thesis",
  DOCUMENT: "document",
});

const REPOSITORY_ACCESS = Object.freeze({
  PRIVATE: "private",
  GROUP: "group",
  INSTITUTION: "institution",
});

const repositoryItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(REPOSITORY_ITEM_TYPES), required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    tags: [{ type: String, trim: true }],
    filePath: { type: String, required: true }, // stored file path
    fileSize: { type: Number, min: 0, default: 0 },

    access: { type: String, enum: Object.values(REPOSITORY_ACCESS), default: REPOSITORY_ACCESS.PRIVATE, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "ResearchGroup", default: null, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

const RepositoryItem = mongoose.model("RepositoryItem", repositoryItemSchema);

module.exports = { RepositoryItem, REPOSITORY_ITEM_TYPES, REPOSITORY_ACCESS };

