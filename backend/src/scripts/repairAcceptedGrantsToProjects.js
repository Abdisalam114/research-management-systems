/**
 * Backfill: accepted/active grants without projectId → create & link a Project.
 * Usage: node src/scripts/repairAcceptedGrantsToProjects.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { ensureProjectForAcceptedGrant } = require("../utils/ensureProjectForAcceptedGrant");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  const grants = await Grant.find({
    status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.PENDING_FINANCE, GRANT_STATUSES.APPROVED] },
    $or: [{ projectId: null }, { projectId: { $exists: false } }],
  });

  let created = 0;
  let linked = 0;
  let failed = 0;
  for (const grant of grants) {
    try {
      const result = await ensureProjectForAcceptedGrant(grant);
      if (result?.created) created += 1;
      else if (result?.linked) linked += 1;
      else if (result?.project) linked += 1;
    } catch (e) {
      failed += 1;
      console.error("fail", grant._id, e.message);
    }
  }

  console.log(JSON.stringify({ scanned: grants.length, created, linked, failed }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
