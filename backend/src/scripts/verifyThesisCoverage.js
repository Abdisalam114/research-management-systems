require("dotenv").config();
const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const analyticsController = require("../controllers/analyticsController");

async function login(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) throw new Error(`Login failed: ${email}`);
  const jwt = require("jsonwebtoken");
  const token = jwt.sign(
    { id: user._id, role: user.role, programTier: user.programTier },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "1h" }
  );
  return { token, user };
}

function mockReq(user, tier) {
  return {
    user: { id: String(user._id), role: user.role },
    programTier: tier || user.programTier || "undergraduate",
    tierWhere: (base = {}) => ({ ...base, programTier: tier || user.programTier || "undergraduate" }),
    tierAssign: (data = {}) => ({ ...data, programTier: tier || user.programTier || "undergraduate" }),
  };
}

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  const { token, user } = await login("director@rms.edu", process.env.SEED_DIRECTOR_PASSWORD || "Director2024!");

  const res = { json: (body) => body };
  const kpi = await new Promise((resolve, reject) => {
    analyticsController
      .getKpiDashboard({ ...mockReq(user, "undergraduate"), headers: {} }, { json: resolve })
      .catch(reject);
  });

  console.log("=== THESIS COVERAGE CHECK ===");
  console.log(`Overall: ${kpi.coverageScore?.overall}%`);
  console.log(`Thesis-ready (90%+): ${kpi.thesisReady ? "YES" : "NO"}`);
  console.log(`Grant success rate: ${kpi.kpis?.grantSuccessRate}%`);
  console.log(`Director token OK: ${token ? "yes" : "no"}`);
  process.exit(kpi.thesisReady ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
