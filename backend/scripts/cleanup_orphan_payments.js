require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const budgetIds = (await db.collection("budgets").find({}).project({ _id: 1 }).toArray()).map((b) => b._id);
  const keepProjectIds = (await db.collection("projects").find({}).project({ _id: 1 }).toArray()).map((p) => p._id);
  const budgetSet = new Set(budgetIds.map(String));
  const projectSet = new Set(keepProjectIds.map(String));

  const payments = await db.collection("payments").find({}).toArray();
  const orphanPayIds = payments
    .filter((p) => !budgetSet.has(String(p.budgetId)))
    .map((p) => p._id);
  const orphanByProject = payments
    .filter((p) => p.projectId && !projectSet.has(String(p.projectId)))
    .map((p) => p._id);
  const toDelete = [...new Set([...orphanPayIds, ...orphanByProject].map(String))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  let deleted = 0;
  if (toDelete.length) {
    const r = await db.collection("payments").deleteMany({ _id: { $in: toDelete } });
    deleted = r.deletedCount;
  }

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "FAKE4",
    message: "orphan payments cleanup",
    data: { deleted, remaining: await db.collection("payments").countDocuments() },
    timestamp: Date.now(),
  };
  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})();
