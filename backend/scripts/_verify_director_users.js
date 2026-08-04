/**
 * Verify director sees all users (UG+PG) and can resolve Mahad.
 * node backend/scripts/_verify_director_users.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "../../debug-f558f7.log");

function log(hypothesisId, message, data) {
  const e = {
    sessionId: "f558f7",
    runId: "director-users-verify",
    hypothesisId,
    location: "_verify_director_users.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(e));
  fs.appendFileSync(LOG, `${JSON.stringify(e)}\n`);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");
  const { User, ROLES } = require("../src/models/User");
  const { userWhere } = require("../src/utils/programTierScope");

  const director = await User.findOne({ email: "director@rms.edu" });
  const mahad = await User.findOne({ email: "mahad@rms.edu" });
  const asha = await User.findOne({ email: "asha@rms.edu" });

  const mockReqUg = {
    programTier: "undergraduate",
    user: { role: ROLES.RESEARCH_DIRECTOR, id: director?._id },
  };

  const oldFilter = userWhere(
    { user: { role: ROLES.FACULTY_COORDINATOR }, programTier: "undergraduate" },
    { role: { $ne: ROLES.RESEARCH_DIRECTOR } }
  );
  // Simulate OLD behavior (before fix) - tier filter on researchers only
  const oldUsers = await User.find({
    $or: [
      { role: ROLES.RESEARCHER, programTier: "undergraduate" },
      { role: { $in: [ROLES.FACULTY_COORDINATOR, ROLES.FINANCE_OFFICER, ROLES.LEADERSHIP] } },
    ],
  }).select("email programTier role");

  const newFilter = userWhere(mockReqUg, { role: { $ne: ROLES.RESEARCH_DIRECTOR } });
  const newUsers = await User.find(newFilter).select("email programTier role");

  const mahadInOld = oldUsers.some((u) => u.email === "mahad@rms.edu");
  const mahadInNew = newUsers.some((u) => u.email === "mahad@rms.edu");
  const ashaInNew = newUsers.some((u) => u.email === "asha@rms.edu");

  log("H1-director-users", "director user list scope", {
    mahadTier: mahad?.programTier,
    ashaTier: asha?.programTier,
    oldListCount: oldUsers.length,
    newListCount: newUsers.length,
    mahadInOld,
    mahadInNew,
    ashaInNew,
    researcherEmails: newUsers.filter((u) => u.role === ROLES.RESEARCHER).map((u) => u.email),
  });

  // updateUser lookup simulation
  const updateLookupOld = await User.findOne({
    $or: [
      { _id: mahad?._id, programTier: "undergraduate" },
      { _id: mahad?._id, role: { $in: [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR, ROLES.FINANCE_OFFICER, ROLES.LEADERSHIP] } },
    ],
  });
  const updateLookupNew = await User.findOne(userWhere(mockReqUg, { _id: mahad?._id }));

  log("H1-director-users", "director edit/delete lookup for Mahad (PG)", {
    oldLookupFound: Boolean(updateLookupOld),
    newLookupFound: Boolean(updateLookupNew),
    ok: Boolean(updateLookupNew) && mahadInNew,
  });

  await mongoose.disconnect();
  process.exit(mahadInNew && updateLookupNew ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
