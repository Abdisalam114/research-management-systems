require("dotenv").config();
const mongoose = require("mongoose");
const { Project } = require("../src/models/Project");
const { Proposal } = require("../src/models/Proposal");
const { Grant, GRANT_STATUSES } = require("../src/models/Grant");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const p = await Project.findOne({ title: /bank system/i });
  if (!p) {
    console.log("not found");
    process.exit(0);
  }
  let proposal = null;
  if (p.proposalId) {
    proposal = await Proposal.findById(p.proposalId).select("title proposalKind fundingCallId programTier");
  }
  const grants = await Grant.find({ projectId: p._id }).select("status amountAwarded title");
  const data = {
    projectId: String(p._id),
    title: p.title,
    tier: p.programTier,
    closure: p.closure?.status,
    proposalId: p.proposalId ? String(p.proposalId) : null,
    proposalKind: proposal?.proposalKind || null,
    fundingCallId: proposal?.fundingCallId ? String(proposal.fundingCallId) : null,
    isVoluntaryGuess:
      !proposal ||
      proposal.proposalKind === "voluntary" ||
      (!proposal.fundingCallId && proposal.proposalKind !== "grant_fund_call"),
    grants: grants.map((g) => ({
      id: String(g._id),
      status: g.status,
      amount: g.amountAwarded,
    })),
  };
  // #region agent log
  const fs = require("fs");
  const path = require("path");
  fs.appendFileSync(
    path.join(__dirname, "../../debug-f558f7.log"),
    `${JSON.stringify({
      sessionId: "f558f7",
      runId: "closure-finance-queue",
      hypothesisId: "CF2",
      location: "probe_bank_system.js",
      message: "bank system voluntary vs grant",
      data,
      timestamp: Date.now(),
    })}\n`
  );
  // #endregion
  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
