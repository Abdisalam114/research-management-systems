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
  const projectId = new mongoose.Types.ObjectId("6a606b2d4af5bda3df5da096");
  const grantId = new mongoose.Types.ObjectId("6a606b2d4af5bda3df5da09e");
  const proposalId = new mongoose.Types.ObjectId("6a6060985e2dae2dc0b72b77");
  const project = await mongoose.connection.db.collection("projects").findOne({ _id: projectId });
  const grant = await mongoose.connection.db.collection("grants").findOne({ _id: grantId });
  const budgets = await mongoose.connection.db
    .collection("budgets")
    .find({ $or: [{ projectId }, { grantId }, { proposalId }] })
    .toArray();
  const proposal = await mongoose.connection.db
    .collection("proposals")
    .findOne({ _id: proposalId }, { projection: { budgetTotal: 1, status: 1, fundingCallId: 1 } });
  console.log(
    JSON.stringify(
      {
        proposal,
        project: project
          ? { id: project._id, title: project.title, status: project.status, proposalId: project.proposalId }
          : null,
        grant: grant
          ? {
              id: grant._id,
              status: grant.status,
              amountAwarded: grant.amountAwarded,
              amountRequested: grant.amountRequested,
              budgetTotal: grant.budgetTotal,
              projectId: grant.projectId,
              callId: grant.callId,
            }
          : null,
        budgets: budgets.map((b) => ({
          id: b._id,
          totalAllocated: b.totalAllocated,
          totalDisbursed: b.totalDisbursed,
          currency: b.currency,
          projectId: b.projectId,
          grantId: b.grantId,
          status: b.status,
        })),
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
