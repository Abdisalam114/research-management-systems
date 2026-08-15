require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { User, ROLES } = require("../src/models/User");
const { userWhere } = require("../src/utils/programTierScope");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const filter = { role: { $ne: ROLES.RESEARCH_DIRECTOR } };
  const req = { programTier: "undergraduate", user: { role: ROLES.RESEARCH_DIRECTOR, id: "x" } };
  const q = userWhere(req, filter);
  const users = await User.find(q).select("email role programTier");
  console.log(JSON.stringify({ query: q, count: users.length, emails: users.map((u) => u.email) }, null, 2));
  await mongoose.disconnect();
})();
