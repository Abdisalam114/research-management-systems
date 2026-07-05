require("dotenv").config();
const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { INSTITUTIONAL_USERS } = require("./seedData");

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  const expected = INSTITUTIONAL_USERS.map((u) => u.email.toLowerCase());
  const dbUsers = await User.find({ email: { $in: expected } })
    .select("+password email role programTier status fullName")
    .lean();

  const byEmail = Object.fromEntries(dbUsers.map((u) => [u.email, u]));

  console.log("=== DB + PASSWORD CHECK ===");
  let okCount = 0;
  for (const spec of INSTITUTIONAL_USERS) {
    const u = byEmail[spec.email.toLowerCase()];
    const roleOk = u && u.role === spec.role && u.status === "active";
    let passOk = false;
    if (u?.password) {
      passOk = await require("bcryptjs").compare(spec.password, u.password);
    }
    const ok = roleOk && passOk;
    if (ok) okCount += 1;
    console.log(
      `${ok ? "OK" : "BAD"} | ${spec.email} | role=${u?.role || "?"} (want ${spec.role}) | tier=${u?.programTier || "?"} | pass=${passOk ? "yes" : "no"}`
    );
  }
  console.log(`RESULT: ${okCount}/${INSTITUTIONAL_USERS.length} users correct`);
  process.exit(okCount === INSTITUTIONAL_USERS.length ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
