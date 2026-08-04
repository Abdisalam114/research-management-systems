const mongoose = require("mongoose");
require("dotenv").config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Proposal = mongoose.connection.collection("proposals");

  // PG voluntary the user opened — ready for Assign committee
  const openedId = new mongoose.Types.ObjectId("6a665bfe7a66c88e96508c3b");
  await Proposal.updateOne(
    { _id: openedId },
    {
      $set: {
        "reviewPipeline.adminScreening.status": "passed",
        "reviewPipeline.adminScreening.completedAt": new Date(),
        "reviewPipeline.adminScreening.comment": "Passed for assign-committee demo",
        "reviewPipeline.peerReview.status": "passed",
        "reviewPipeline.peerReview.completedAt": new Date(),
        "reviewPipeline.committeeReview.status": "pending",
        "reviewPipeline.financeReview.status": "skipped",
        "reviewPipeline.financeReview.decision": "skipped",
        "reviewPipeline.financeReview.comment":
          "Not applicable — voluntary research proposal",
        assignedCommittee: [],
        assignedFinance: [],
        status: "under_review",
      },
    }
  );

  // UG grant — committee passed, finance pending → Assign finance demo
  const grant = await Proposal.findOne({
    proposalKind: "grant_fund_call",
    fundingCallId: { $ne: null },
  });
  if (!grant) throw new Error("No grant proposal found");

  await Proposal.updateOne(
    { _id: grant._id },
    {
      $set: {
        status: "under_review",
        "reviewPipeline.adminScreening.status": "passed",
        "reviewPipeline.peerReview.status": "passed",
        "reviewPipeline.committeeReview.status": "passed",
        "reviewPipeline.committeeReview.decision": "recommend_approval",
        "reviewPipeline.financeReview.status": "pending",
        "reviewPipeline.financeReview.decision": "",
        "reviewPipeline.financeReview.comment": "",
        "reviewPipeline.financeReview.completedAt": null,
        assignedCommittee: [],
        assignedFinance: [],
      },
    }
  );

  console.log(
    JSON.stringify(
      {
        committeeReady: {
          id: String(openedId),
          title: "CHALLENGES OF THE RESEARCH MANAGEMENT OFFICE...",
          tier: "postgraduate",
          kind: "voluntary",
        },
        financeReady: {
          id: String(grant._id),
          title: grant.title,
          tier: grant.programTier,
          kind: grant.proposalKind,
        },
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
