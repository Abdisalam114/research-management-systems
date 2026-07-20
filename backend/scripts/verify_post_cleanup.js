require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const cols = [
    "projects",
    "proposals",
    "publications",
    "grants",
    "budgets",
    "ethicsapplications",
    "repositoryitems",
    "researchgroups",
    "thesisgroups",
    "fundingcalls",
    "users",
    "departments",
    "notifications",
    "auditevents",
    "payments",
  ];
  const detail = {};
  for (const c of cols) {
    const items = await db
      .collection(c)
      .find({})
      .project({ title: 1, name: 1, email: 1, status: 1 })
      .limit(50)
      .toArray();
    detail[c] = { count: await db.collection(c).countDocuments(), items: items.map((i) => i.title || i.name || i.email || String(i._id)) };
  }
  const payload = {
    sessionId: "f558f7",
    hypothesisId: "FAKE3",
    message: "post-cleanup verification",
    data: detail,
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(detail, null, 2));
  await mongoose.disconnect();
})();
