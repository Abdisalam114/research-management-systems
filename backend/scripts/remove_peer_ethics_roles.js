/**
 * Remove peer_reviewer & ethics_committee users; roles retired from system.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const removed = await db
    .collection("users")
    .find({ role: { $in: ["peer_reviewer", "ethics_committee"] } })
    .project({ email: 1, role: 1, fullName: 1 })
    .toArray();
  const del = await db.collection("users").deleteMany({ role: { $in: ["peer_reviewer", "ethics_committee"] } });
  const payload = {
    sessionId: "f558f7",
    hypothesisId: "ROLE1",
    message: "removed peer_reviewer and ethics_committee users",
    data: { deleted: del.deletedCount, removed },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
