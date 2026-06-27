const fs = require("fs");
const path = require("path");

const backendRoot = path.join(__dirname, "..", "backend");
require(path.join(backendRoot, "node_modules", "dotenv")).config({ path: path.join(backendRoot, ".env") });

const LOG = path.join(__dirname, "..", "debug-6113cc.log");

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "project-pi-fix", timestamp: Date.now(), ...entry }) + "\n"
  );
}

async function main() {
  const mongoose = require(path.join(backendRoot, "node_modules", "mongoose"));
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rms");

  require(path.join(backendRoot, "src/models/User"));
  const { Project } = require(path.join(backendRoot, "src/models/Project"));
  const { backfillMissingProjectResearchers } = require(path.join(backendRoot, "src/utils/projectPi"));
  const { User } = require(path.join(backendRoot, "src/models/User"));

  const nameSync = await User.updateMany(
    { $or: [{ fullName: { $exists: false } }, { fullName: "" }], name: { $exists: true, $ne: "" } },
    [{ $set: { fullName: "$name" } }]
  );

  const result = await backfillMissingProjectResearchers();

  const active = await Project.find({ status: "active" }).populate("researcherId", "fullName name email").limit(12);
  const { userDisplayName } = require(path.join(backendRoot, "src/utils/userDisplay"));
  const pis = active.map((p) => userDisplayName(p.researcherId));

  const payload = {
    hypothesisId: "PI2",
    location: "fix-project-pi.cjs",
    message: "backfill project researcherId",
    data: { nameSyncModified: nameSync.modifiedCount, ...result, samplePi: pis.slice(0, 5), allHavePi: pis.every((n) => n !== "—") },
  };
  log(payload);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  log({ hypothesisId: "PI2", message: "fix failed", data: { error: e.message } });
  console.error(e);
  process.exit(1);
});
