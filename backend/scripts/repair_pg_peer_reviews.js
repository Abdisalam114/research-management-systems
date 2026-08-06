/**
 * Repair PG (and all) peer-review data inconsistencies:
 * - Relink peerReviews from deleted peer_reviewer accounts to leadership@rms.edu
 * - Reset peerReview stage when marked passed but no peerReviews exist
 *
 * Run: node backend/scripts/repair_pg_peer_reviews.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { Proposal } = require("../src/models/Proposal");
const { User } = require("../src/models/User");
const { STAGE_STATUS } = require("../src/utils/proposalReviewPipeline");

const DELETED_PEER_REVIEWER_ID = "6a510a17362f84f31c858a41";

function refId(ref) {
  if (ref == null) return "";
  if (typeof ref === "object" && ref._id != null) return String(ref._id);
  return String(ref);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");

  const leadership = await User.findOne({ email: "leadership@rms.edu", status: "active" });
  if (!leadership) throw new Error("leadership@rms.edu not found");

  const activeIds = new Set(
    (await User.find({ status: "active" }).select("_id")).map((u) => String(u._id))
  );

  let relinkedReviews = 0;
  let resetStages = 0;
  let relinkedAssignees = 0;

  const proposals = await Proposal.find({
    $or: [
      { "peerReviews.0": { $exists: true } },
      { "reviewPipeline.peerReview.status": STAGE_STATUS.PASSED },
      { "assignedReviewers.0": { $exists: true } },
    ],
  });

  for (const proposal of proposals) {
    let changed = false;

    for (const review of proposal.peerReviews || []) {
      const uid = refId(review.userId);
      if (!activeIds.has(uid)) {
        review.userId = leadership._id;
        relinkedReviews += 1;
        changed = true;
      }
    }

    const pipe = proposal.reviewPipeline?.peerReview;
    if (pipe?.reviews?.length) {
      for (const r of pipe.reviews) {
        const uid = refId(r.userId);
        if (!activeIds.has(uid)) {
          r.userId = leadership._id;
          changed = true;
        }
      }
    }

    if (
      pipe?.status === STAGE_STATUS.PASSED &&
      (proposal.peerReviews || []).length === 0
    ) {
      proposal.reviewPipeline.peerReview = {
        status: STAGE_STATUS.PENDING,
        completedAt: null,
        reviews: [],
      };
      resetStages += 1;
      changed = true;
    }

    for (const assignee of proposal.assignedReviewers || []) {
      const uid = refId(assignee.userId);
      if (!activeIds.has(uid)) {
        assignee.userId = leadership._id;
        assignee.assignedAt = assignee.assignedAt || new Date();
        relinkedAssignees += 1;
        changed = true;
      }
    }

    if (changed) {
      proposal.markModified("peerReviews");
      proposal.markModified("reviewPipeline");
      proposal.markModified("assignedReviewers");
      await proposal.save();
    }
  }

  console.log(
    JSON.stringify(
      {
        leadershipId: String(leadership._id),
        relinkedReviews,
        relinkedAssignees,
        resetStages,
        deletedPeerReviewerId: DELETED_PEER_REVIEWER_ID,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
