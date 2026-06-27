const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { syncGrantBudgets } = require("../utils/syncGrantBudgets");

async function main() {
  await connectDB(process.env.MONGODB_URI || process.env.MONGO_URI);
  const result = await syncGrantBudgets();
  console.log(
    `Grant budgets synced: ${result.created} created, ${result.updated} updated (${result.scanned} awarded grants scanned)`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
