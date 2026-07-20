require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const projects = await db.collection("projects").countDocuments();
  const pubs = await db.collection("publications").countDocuments();
  const byProject = await db
    .collection("publications")
    .aggregate([
      { $match: { projectId: { $ne: null } } },
      { $group: { _id: "$projectId", c: { $sum: 1 } } },
    ])
    .toArray();
  const max = byProject.reduce((m, r) => Math.max(m, r.c), 0);
  const violations = byProject.filter((r) => r.c > 1).length;
  const payload = {
    sessionId: "f558f7",
    hypothesisId: "ONE2",
    message: "post 1:1 verification",
    data: { projects, publications: pubs, maxPubsPerProject: max, violations, oneToOneOk: max <= 1 && pubs <= projects },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
