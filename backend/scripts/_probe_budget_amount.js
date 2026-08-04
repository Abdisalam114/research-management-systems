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
        budgetTotal: 1,
        budgetCurrency: 1,
        budgetBreakdown: 1,
        fundingCallId: 1,
        proposalKind: 1,
        programTier: 1,
      },
    }
  );
  console.log("PROPOSAL_BUDGET", JSON.stringify(p, null, 2));
  if (p?.fundingCallId) {
    const call = await mongoose.connection.db.collection("fundingcalls").findOne(
      { _id: p.fundingCallId },
      { projection: { title: 1, amountCap: 1, currency: 1, budgetCeiling: 1, maxAward: 1 } }
    );
    console.log("CALL", JSON.stringify(call, null, 2));
  }
  const grant = await mongoose.connection.db.collection("grants").findOne(
    { proposalId: new mongoose.Types.ObjectId(id) },
    { projection: { title: 1, amountRequested: 1, amountAwarded: 1, currency: 1, status: 1 } }
  );
  console.log("GRANT", JSON.stringify(grant, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
