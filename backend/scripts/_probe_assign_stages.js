const mongoose = require("mongoose");
require("dotenv").config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Proposal = mongoose.connection.collection("proposals");
  const id = "6a665bfe7a66c88e96508c3b";
  const one = await Proposal.findOne(
    { _id: new mongoose.Types.ObjectId(id) },
    {
      projection: {
        title: 1,
        proposalKind: 1,
        fundingCallId: 1,
        programTier: 1,
        reviewPipeline: 1,
        assignedCommittee: 1,
        assignedFinance: 1,
        assignedReviewers: 1,
        peerReviews: 1,
        status: 1,
      },
    }
  );
  console.log("OPENED", JSON.stringify(one, null, 2));

  const ready = await Proposal.find(
    { "reviewPipeline.peerReview.status": "passed" },
    {
      projection: {
        title: 1,
        proposalKind: 1,
        programTier: 1,
        "reviewPipeline.peerReview.status": 1,
        "reviewPipeline.committeeReview.status": 1,
        "reviewPipeline.financeReview.status": 1,
        assignedCommittee: 1,
        assignedFinance: 1,
        fundingCallId: 1,
        status: 1,
      },
    }
  )
    .limit(20)
    .toArray();

  console.log("PEER_PASSED_COUNT", ready.length);
  console.log(
    JSON.stringify(
      ready.map((p) => ({
        id: String(p._id),
        title: p.title,
        kind: p.proposalKind,
        tier: p.programTier,
        status: p.status,
        peer: p.reviewPipeline?.peerReview?.status,
        comm: p.reviewPipeline?.committeeReview?.status,
        fin: p.reviewPipeline?.financeReview?.status,
        hasCall: !!p.fundingCallId,
        ac: (p.assignedCommittee || []).length,
        af: (p.assignedFinance || []).length,
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
