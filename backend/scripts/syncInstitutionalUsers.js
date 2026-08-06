/**
 * Sync institutional user profiles from seedData.js into MongoDB (match by email).
 *
 * - Updates fullName, department, rank, role, status, programTier, isProtected.
 * - Keeps existing passwords unless the account is newly created or --reset-passwords is passed.
 *
 * Usage (local or another server after git pull):
 *   node backend/scripts/syncInstitutionalUsers.js
 *   node backend/scripts/syncInstitutionalUsers.js --reset-passwords
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { User } = require("../src/models/User");
const { INSTITUTIONAL_USERS } = require("../src/scripts/seedData");

const resetPasswords = process.argv.includes("--reset-passwords");

async function syncUser(spec) {
  const email = String(spec.email).toLowerCase().trim();
  const existing = await User.findOne({ email }).select("+password isProtected");
  if (existing) {
    existing.fullName = spec.fullName;
    existing.role = spec.role;
    existing.department = spec.department;
    existing.rank = spec.rank;
    existing.status = spec.status;
    if (spec.programTier) existing.programTier = spec.programTier;
    if (spec.isProtected) existing.isProtected = true;
    if (resetPasswords && spec.password) existing.password = spec.password;
    await existing.save();
    return { email, action: resetPasswords ? "updated+password" : "updated" };
  }

  await User.create({
    fullName: spec.fullName,
    email,
    password: spec.password,
    role: spec.role,
    department: spec.department,
    rank: spec.rank,
    status: spec.status,
    programTier: spec.programTier,
    isProtected: Boolean(spec.isProtected),
  });
  return { email, action: "created" };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");

  const results = [];
  for (const spec of INSTITUTIONAL_USERS) {
    results.push(await syncUser(spec));
  }

  console.log(
    JSON.stringify(
      {
        resetPasswords,
        synced: results.length,
        results,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
