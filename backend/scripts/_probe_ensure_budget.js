const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { ensureBudgetForProject } = require("../src/utils/ensureBudgetForProject");
const { Project } = require("../src/models/Project");

const envPath = path.join(__dirname, "..", ".env");
let uri = "mongodb://127.0.0.1:27017/rms";
if (fs.existsSync(envPath)) {
  const t = fs.readFileSync(envPath, "utf8");
  const m = t.match(/^MONGODB_URI=(.+)$/m);
  if (m) uri = m[1].trim().replace(/^['"]|['"]$/g, "");
}

(async () => {
  await mongoose.connect(uri);
  const p = await Project.findById("6a606b2d4af5bda3df5da096");
  const r = await ensureBudgetForProject(p);
  console.log(
    JSON.stringify(
      {
        created: r.created,
        updated: r.updated,
        amount: r.amount,
        totalAllocated: r.budget?.totalAllocated,
        budgetId: r.budget?._id,
        currency: r.budget?.currency,
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
