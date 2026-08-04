require("dotenv").config();
const mongoose = require("mongoose");
const { Project, CLOSURE_STATUSES } = require("../src/models/Project");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const all = await Project.find({ "closure.status": { $ne: "none" } })
    .sort({ updatedAt: -1 })
    .select("title programTier status closure.status");
  const data = {
    by: {
      submitted: await Project.countDocuments({ "closure.status": "submitted" }),
      director_approved: await Project.countDocuments({ "closure.status": "director_approved" }),
      finance_approved: await Project.countDocuments({ "closure.status": "finance_approved" }),
      archived: await Project.countDocuments({ "closure.status": "archived" }),
    },
    projects: all.map((p) => ({
      id: String(p._id),
      title: p.title,
      tier: p.programTier,
      status: p.status,
      closure: p.closure?.status,
    })),
  };
  const fs = require("fs");
  const path = require("path");
  fs.appendFileSync(
    path.join(__dirname, "../../debug-f558f7.log"),
    `${JSON.stringify({
      sessionId: "f558f7",
      runId: "finance-approve-btn",
      hypothesisId: "FA1",
      location: "probe_closure_now.js",
      message: "current closure states",
      data,
      timestamp: Date.now(),
    })}\n`
  );
  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
