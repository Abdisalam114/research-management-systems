const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { syncGrantAwards } = require("../utils/syncGrantAwards");

async function main() {
  await connectDB(process.env.MONGODB_URI || process.env.MONGO_URI);
  const result = await syncGrantAwards();
  console.log(`Grant awards synced: ${result.updated} updated (${result.scanned} needed repair)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
