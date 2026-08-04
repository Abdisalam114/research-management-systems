const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { Budget } = require("../src/models/Budget");

const envPath = path.join(__dirname, "..", ".env");
let uri = "mongodb://127.0.0.1:27017/rms";
if (fs.existsSync(envPath)) {
  const t = fs.readFileSync(envPath, "utf8");
  const m = t.match(/^MONGODB_URI=(.+)$/m);
  if (m) uri = m[1].trim().replace(/^['"]|['"]$/g, "");
}

(async () => {
  await mongoose.connect(uri);
  const budget = await Budget.findOne({ totalAllocated: { $gt: 0 } });
  if (!budget) {
    console.log(JSON.stringify({ ok: false, reason: "no allocated budget" }));
    await mongoose.disconnect();
    return;
  }
  let blocked = false;
  let errMsg = "";
  try {
    await Budget.deleteOne({ _id: budget._id });
  } catch (e) {
    blocked = true;
    errMsg = e.message;
  }
  const stillThere = await Budget.findById(budget._id).select("totalAllocated");
  console.log(
    JSON.stringify(
      {
        ok: blocked && stillThere,
        budgetId: String(budget._id),
        totalAllocated: budget.totalAllocated,
        blocked,
        errMsg,
        stillAllocated: stillThere?.totalAllocated,
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
