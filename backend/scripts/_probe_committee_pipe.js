const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
let uri = "mongodb://127.0.0.1:27017/rms";
if (fs.existsSync(envPath)) {
  const t = fs.readFileSync(envPath, "utf8");
  const m = t.match(/^MONGODB_URI=(.+)$/m);
  if (m) uri = m[1].trim().replace(/^['"]|['"]$/g, "");
}

(async () => {
  await mongoose.connect(uri);
  const id = "6a6060985e2dae2dc0b72b77";
  const p = await mongoose.connection.db.collection("proposals").findOne(
    { _id: new mongoose.Types.ObjectId(id) },
    {
      projection: {
        title: 1,
        status: 1,
        programTier: 1,
        reviewPipeline: 1,
        peerReviews: 1,
        assignedReviewers: 1,
        ethicsStatus: 1,
      },
    }
  );
  console.log("TARGET", JSON.stringify(p, null, 2));
  const recent = await mongoose.connection.db
    .collection("proposals")
    .find({ "peerReviews.0": { $exists: true } })
    .project({ title: 1, status: 1, programTier: 1, reviewPipeline: 1, peerReviews: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(8)
    .toArray();
  console.log(
    "RECENT",
    JSON.stringify(
      recent.map((r) => ({
        id: String(r._id),
        title: r.title,
        status: r.status,
        tier: r.programTier,
        peer: r.reviewPipeline?.peerReview?.status,
        committee: r.reviewPipeline?.committeeReview?.status,
        admin: r.reviewPipeline?.adminScreening?.status,
        peerCount: (r.peerReviews || []).length,
      })),
      null,
      2
    )
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
