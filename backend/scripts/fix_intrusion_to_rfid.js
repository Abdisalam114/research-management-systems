require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const rfid = await db.collection("projects").findOne({ title: /RFID-Based Automated Attendance/i });
  if (!rfid) throw new Error("RFID project missing");
  const res = await db.collection("publications").updateMany(
    { title: /Intrusion Detection Models on Campus/i },
    { $set: { projectId: rfid._id, updatedAt: new Date() } }
  );
  const payload = {
    sessionId: "f558f7",
    hypothesisId: "R3",
    message: "intrusion pubs → RFID recognized project",
    data: { matched: res.matchedCount, modified: res.modifiedCount, projectId: String(rfid._id) },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), JSON.stringify(payload) + "\n");
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
