/**
 * Ensures at least one thesis group has a pending title in the queue (demo / testing).
 * Run: node scripts/ensureThesisTitleQueueDemo.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ThesisGroup, THESIS_STATUSES } = require("../src/models/ThesisGroup");
const { TITLE_PROPOSAL_STATUSES } = require("../src/utils/thesisDefaults");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/research_management";
  await mongoose.connect(uri);

  const pending = await ThesisGroup.findOne({ "titleProposal.status": TITLE_PROPOSAL_STATUSES.PENDING });
  if (pending) {
    console.log("Already pending:", pending._id.toString(), pending.titleProposal?.title);
    await mongoose.disconnect();
    return;
  }

  const group = await ThesisGroup.findOne({ supervisorId: { $ne: null } }).sort({ createdAt: -1 });
  if (!group) {
    console.log("No thesis groups found — create one first.");
    await mongoose.disconnect();
    return;
  }

  const demoTitle =
    group.titleProposal?.title?.trim() ||
    group.title?.trim() ||
    "Smart Campus Navigation Using QR and Indoor Positioning";

  group.title = "";
  group.titleProposal = {
    title: demoTitle,
    status: TITLE_PROPOSAL_STATUSES.PENDING,
    proposedAt: new Date(),
    proposedBy: group.supervisorId,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
  if (group.status === THESIS_STATUSES.IN_PROGRESS) {
    group.status = THESIS_STATUSES.PROPOSED;
  }
  await group.save();

  console.log("Queued thesis title for review:", group._id.toString(), demoTitle);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
