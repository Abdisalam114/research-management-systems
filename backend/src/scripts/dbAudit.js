const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const LOG = path.join(__dirname, "..", "..", "..", "debug-6113cc.log");

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "db-audit", timestamp: Date.now(), ...entry }) + "\n"
  );
}

async function run() {
  const mongoose = require("mongoose");
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/rms";

  fs.writeFileSync(LOG, "");
  await mongoose.connect(uri);

  const collections = [
    "users",
    "proposals",
    "projects",
    "grants",
    "budgets",
    "publications",
    "repositoryitems",
    "researchgroups",
    "notifications",
    "conversations",
    "departments",
  ];

  const counts = {};
  for (const name of collections) {
    try {
      counts[name] = await mongoose.connection.db.collection(name).countDocuments();
    } catch (e) {
      counts[name] = -1;
    }
  }

  const usersByRole = await mongoose.connection.db
    .collection("users")
    .aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }])
    .toArray();

  log({ hypothesisId: "DB", message: "collection counts", data: { uri, counts } });
  log({ hypothesisId: "DB", message: "users by role", data: usersByRole });

  await mongoose.disconnect();
  console.log(JSON.stringify({ counts, usersByRole }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
