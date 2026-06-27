const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { syncGrantProjectLinks } = require("../utils/syncGrantProjectLinks");
const { Budget } = require("../models/Budget");

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  const result = await syncGrantProjectLinks();
  console.log(`Grant–project links synced: ${result.updated} updated (${result.scanned} unlinked)`);

  const budgets = await Budget.find({ projectId: null, grantId: { $ne: null } });
  let budgetUpdated = 0;
  for (const budget of budgets) {
    const grant = await require("../models/Grant").Grant.findById(budget.grantId);
    if (grant?.projectId) {
      budget.projectId = grant.projectId;
      await budget.save();
      budgetUpdated += 1;
    }
  }
  if (budgetUpdated) console.log(`Budgets linked to projects: ${budgetUpdated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
