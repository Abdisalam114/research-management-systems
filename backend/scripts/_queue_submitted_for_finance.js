require("dotenv").config();
const mongoose = require("mongoose");
const { Project, CLOSURE_STATUSES } = require("../src/models/Project");

/** One-shot: move submitted grant closures to director_approved so Finance can clear. */
(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const q = { "closure.status": CLOSURE_STATUSES.SUBMITTED };
  const before = await Project.find(q).select("title programTier");
  const res = await Project.updateMany(q, {
    $set: {
      "closure.status": CLOSURE_STATUSES.DIRECTOR_APPROVED,
      "closure.directorApprovedAt": new Date(),
      "closure.checklist.financialCleared": false,
    },
  });
  const after = await Project.find({ "closure.status": CLOSURE_STATUSES.DIRECTOR_APPROVED }).select(
    "title programTier closure.status"
  );
  const payload = {
    sessionId: "f558f7",
    runId: "finance-approve-btn",
    hypothesisId: "FA1",
    location: "queue_submitted_for_finance.js",
    message: "queued submitted closures for finance",
    data: {
      matched: res.matchedCount ?? res.n,
      modified: res.modifiedCount ?? res.nModified,
      before: before.map((p) => ({ title: p.title, tier: p.programTier })),
      awaitingNow: after.map((p) => ({
        id: String(p._id),
        title: p.title,
        tier: p.programTier,
        closure: p.closure?.status,
      })),
    },
    timestamp: Date.now(),
  };
  require("fs").appendFileSync(
    require("path").join(__dirname, "../../debug-f558f7.log"),
    `${JSON.stringify(payload)}\n`
  );
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
