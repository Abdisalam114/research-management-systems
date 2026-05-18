const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { User, ROLES, USER_STATUSES } = require("../models/User");

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@rms.edu";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

  await connectDB(process.env.MONGO_URI);

  const existing = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (existing) {
    existing.fullName = existing.fullName || "Seed Admin";
    existing.role = ROLES.RESEARCH_DIRECTOR;
    existing.status = USER_STATUSES.ACTIVE;
    existing.isProtected = true;
    if (password) existing.password = password;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Updated seed admin: ${email}`);
    return;
  }

  await User.create({
    fullName: "Seed Admin",
    email,
    password,
    role: ROLES.RESEARCH_DIRECTOR,
    department: "Research Office",
    rank: "Director",
    status: USER_STATUSES.ACTIVE,
    isProtected: true,
  });

  // eslint-disable-next-line no-console
  console.log(`Created seed admin: ${email}`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    process.exit();
  }
});

