require("dotenv").config();
const mongoose = require("mongoose");
const { Proposal, PROPOSAL_STATUSES } = require("../src/models/Proposal");
const { User } = require("../src/models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const leadership = await User.findOne({ email: "leadership@rms.edu" });
  const uid = leadership._id;
  const tier = leadership.programTier;

  const oldFilter = {
    programTier: tier,
    "assignedReviewers.userId": uid,
    status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW] },
  };
  const newFilter = {
    programTier: tier,
    "assignedReviewers.userId": uid,
    status: { $nin: [PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REJECTED] },
  };

  const oldQ = await Proposal.find(oldFilter).select("title status").lean();
  const newQ = await Proposal.find(newFilter).select("title status assignedReviewers peerReviews").lean();
  const allAssigned = await Proposal.find({
    programTier: tier,
    assignedReviewers: { $exists: true, $ne: [] },
  })
    .select("title status assignedReviewers")
    .lean();

  console.log(
    JSON.stringify(
      {
        leadershipId: String(uid),
        oldFilterCount: oldQ.length,
        newFilterCount: newQ.length,
        allWithReviewers: allAssigned.map((p) => ({
          title: p.title,
          status: p.status,
          reviewerIds: p.assignedReviewers.map((r) => String(r.userId)),
        })),
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
})();
