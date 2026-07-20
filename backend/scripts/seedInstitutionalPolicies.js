/**
 * Seed canonical institutional policies (all RMS modules) per program tier.
 * Run: node scripts/seedInstitutionalPolicies.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");
const { User, ROLES } = require("../src/models/User");
const { InstitutionalPolicy } = require("../src/models/InstitutionalPolicy");
const { PROGRAM_TIERS } = require("../src/constants/programTier");
const { INSTITUTIONAL_POLICY_CATALOG } = require("../src/constants/institutionalPolicyCatalog");

async function seedPoliciesForTier(programTier, updatedBy) {
  let upserted = 0;
  for (const spec of INSTITUTIONAL_POLICY_CATALOG) {
    const existing = await InstitutionalPolicy.findOne({ programTier, moduleKey: spec.moduleKey });
    if (existing) {
      existing.title = spec.title;
      existing.body = spec.body;
      existing.category = spec.category;
      existing.status = "published";
      existing.updatedBy = updatedBy;
      await existing.save();
    } else {
      await InstitutionalPolicy.create({
        programTier,
        moduleKey: spec.moduleKey,
        title: spec.title,
        body: spec.body,
        category: spec.category,
        status: "published",
        updatedBy,
      });
    }
    upserted += 1;
  }
  return upserted;
}

async function run() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  const leadership =
    (await User.findOne({ role: ROLES.LEADERSHIP, status: "active" }).sort({ createdAt: 1 })) ||
    (await User.findOne({ role: ROLES.RESEARCH_DIRECTOR }));
  if (!leadership) throw new Error("No leadership or director user found to attribute policies");

  const tiers = [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE];
  let total = 0;
  for (const tier of tiers) {
    total += await seedPoliciesForTier(tier, leadership._id);
  }

  const count = await InstitutionalPolicy.countDocuments();
  const payload = {
    sessionId: "f558f7",
    runId: "policy-seed",
    hypothesisId: "POL1",
    location: "seedInstitutionalPolicies.js",
    message: "institutional policies seeded",
    data: { perTier: INSTITUTIONAL_POLICY_CATALOG.length, tiers: tiers.length, totalDocs: count },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { seedPoliciesForTier };
