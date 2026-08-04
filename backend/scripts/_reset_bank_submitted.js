require("dotenv").config();
const mongoose = require("mongoose");
const { Project, CLOSURE_STATUSES } = require("../src/models/Project");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const p = await Project.findOne({ title: /bank system/i });
  if (!p) {
    console.log("not found");
    process.exit(0);
  }
  p.closure = p.closure || {};
  p.closure.status = CLOSURE_STATUSES.SUBMITTED;
  p.closure.directorApprovedAt = null;
  p.closure.directorApprovedBy = null;
  p.closure.financeApprovedAt = null;
  p.closure.financeApprovedBy = null;
  if (p.closure.checklist) p.closure.checklist.financialCleared = false;
  p.status = "closing";
  await p.save();

  const payload = {
    sessionId: "f558f7",
    runId: "director-closure-ui",
    hypothesisId: "DA1",
    location: "reset_bank_submitted.js",
    message: "reset bank system to submitted for director approve UI",
    data: {
      id: String(p._id),
      title: p.title,
      tier: p.programTier,
      closure: p.closure.status,
      status: p.status,
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
