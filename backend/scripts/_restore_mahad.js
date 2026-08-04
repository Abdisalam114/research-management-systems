/** Restore PG researcher mahad@rms.edu if missing. node backend/scripts/_restore_mahad.js */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { User, ROLES, USER_STATUSES } = require("../src/models/User");
const { PROGRAM_TIERS } = require("../src/constants/programTier");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");
  const exists = await User.findOne({ email: "mahad@rms.edu" });
  if (exists) {
    console.log(JSON.stringify({ restored: false, id: exists._id, email: exists.email }));
    await mongoose.disconnect();
    return;
  }
  const user = await User.create({
    fullName: "Mahad Hassan",
    email: "mahad@rms.edu",
    password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
    role: ROLES.RESEARCHER,
    department: "Engineering",
    rank: "Assistant Professor",
    status: USER_STATUSES.ACTIVE,
    programTier: PROGRAM_TIERS.POSTGRADUATE,
    isProtected: false,
  });
  console.log(JSON.stringify({ restored: true, id: user._id, email: user.email }));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
