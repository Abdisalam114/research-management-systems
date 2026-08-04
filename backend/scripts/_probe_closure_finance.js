require("dotenv").config();
const mongoose = require("mongoose");
const { Project, CLOSURE_STATUSES } = require("../src/models/Project");
const { Grant, GRANT_STATUSES } = require("../src/models/Grant");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const by = {};
  for (const s of Object.values(CLOSURE_STATUSES)) {
    by[s] = await Project.countDocuments({ "closure.status": s });
  }
  const recent = await Project.find({ "closure.status": { $ne: "none" } })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select("title programTier closure.status status");

  const samples = [];
  for (const p of recent) {
    const awarded = await Grant.findOne({
      projectId: p._id,
      status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED, GRANT_STATUSES.CLOSED] },
      amountAwarded: { $gt: 0 },
    }).select("_id status amountAwarded");
    samples.push({
      title: p.title,
      tier: p.programTier,
      closure: p.closure?.status,
      status: p.status,
      wouldSkipFinance: Boolean(awarded),
      grantId: awarded?._id ? String(awarded._id) : null,
    });
  }

  // #region agent log
  const fs = require("fs");
  const path = require("path");
  const payload = {
    sessionId: "f558f7",
    runId: "closure-finance-queue",
    hypothesisId: "CF1",
    location: "probe_closure_finance.js",
    message: "closure status distribution + grant skip flag",
    data: { byStatus: by, samples },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "../../debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  // #endregion

  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
