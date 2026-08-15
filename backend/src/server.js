const dotenv = require("dotenv");
dotenv.config();

const { createApp } = require("./app");
const { connectDB } = require("./config/db");
const { migrateLegacyResearchInterests } = require("./scripts/migrateResearchInterests");
const { migrateLegacyPublicationTypes } = require("./scripts/migratePublicationTypes");
const { migrateDepartmentFaculties } = require("./scripts/migrateDepartmentFaculties");

async function start() {
  await connectDB(process.env.MONGO_URI);
  await migrateLegacyResearchInterests();
  await migrateLegacyPublicationTypes();
  await migrateDepartmentFaculties();

  const app = createApp();
  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "0.0.0.0";

  // Close any open funding calls whose deadline already passed (also runs on list/apply)
  try {
    const { closeExpiredOpenCalls } = require("./utils/fundingCallAutoClose");
    await closeExpiredOpenCalls({ actorRole: "system" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Funding call deadline auto-close on boot failed:", err?.message || err);
  }

  // Seed/legacy grants often lack callId — link by title so Grants & Funding Calls stay in sync
  try {
    const { linkGrantsMissingCallId } = require("./utils/linkGrantsToFundingCalls");
    await linkGrantsMissingCallId();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Grant↔FundingCall link on boot failed:", err?.message || err);
  }

  try {
    const { collapseDuplicateFundingCallGrants } = require("./utils/collapseDuplicateFundingCallGrants");
    const { Grant } = require("./models/Grant");
    await collapseDuplicateFundingCallGrants();
    await Grant.syncIndexes();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Grant duplicate collapse on boot failed:", err?.message || err);
  }

  try {
    const { ensureEthicsApplicationsForProposals } = require("./utils/ensureEthicsApplicationsForProposals");
    const result = await ensureEthicsApplicationsForProposals();
    if (result?.restored || result?.created) {
      // eslint-disable-next-line no-console
      console.log(
        `Ethics restore: ${result.restored || 0} from snapshot, ${result.created || 0} recreated`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Ethics restore on boot failed:", err?.message || err);
  }

  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

