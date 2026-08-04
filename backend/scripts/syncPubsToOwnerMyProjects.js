/**
 * Ensure every publication.projectId belongs to the same researcher (My Projects only).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "..", "..", "debug-f558f7.log");

function log(message, data) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "f558f7",
      runId: "sync-my-projects-pubs",
      hypothesisId: "M1",
      location: "syncPubsToOwnerMyProjects.js",
      message,
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
}

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function score(pubTitle, projectTitle) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  if (norm(pubTitle) && norm(pubTitle) === norm(projectTitle)) return 100;

  const a = new Set(tokens(pubTitle));
  const b = tokens(projectTitle);
  let hit = 0;
  for (const w of b) if (a.has(w)) hit += 1;
  const pt = String(pubTitle || "").toLowerCase();
  const jt = String(projectTitle || "").toLowerCase();
  if (pt.includes("benchmark") && jt.includes("benchmark")) hit += 20;
  if (pt.includes("benchmark") && jt.includes("predictive")) hit += 10;
  if (pt.includes("energy") && jt.includes("energy")) hit += 8;
  if (pt.includes("cpu") && jt.includes("cpu")) hit += 10;
  if (pt.includes("titok") && jt.includes("titok")) hit += 20;
  if (pt.includes("retinopathy") && jt.includes("retinopathy")) hit += 20;
  if (pt.includes("microgrid") && jt.includes("microgrid")) hit += 20;
  if (pt.includes("clinical") && jt.includes("clinical")) hit += 12;
  if (pt.includes("funding") && jt.includes("funding")) hit += 12;
  if (pt.includes("policy") && jt.includes("policy")) hit += 10;
  if (pt.includes("campus") && jt.includes("campus")) hit += 6;
  if (pt.includes("event") && jt.includes("event")) hit += 8;
  if (pt.includes("solar") && jt.includes("solar")) hit += 12;
  if (pt.includes("iot") && jt.includes("iot")) hit += 10;
  if (pt.includes("rfid") && jt.includes("rfid")) hit += 10;
  if (pt.includes("water") && jt.includes("water")) hit += 8;
  if (pt.includes("maternal") && jt.includes("maternal")) hit += 12;
  if (pt.includes("health") && jt.includes("health")) hit += 4;
  if (pt.includes("de-identification") && jt.includes("de-identification")) hit += 15;
  if (pt.includes("transformer") && jt.includes("transformer")) hit += 10;
  if (pt.includes("mobile") && jt.includes("mobile")) hit += 4;
  if (pt.includes("intrusion") && jt.includes("rfid")) hit += 3;
  if (pt.includes("payment") && jt.includes("campus")) hit += 2;
  if (pt.includes("renewable") && jt.includes("renewable")) hit += 12;
  if (pt.includes("secure") && jt.includes("secure")) hit += 8;
  return hit;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const pubsCol = db.collection("publications");
  const projectsCol = db.collection("projects");

  const pubs = await pubsCol.find({}).toArray();
  const projects = await projectsCol.find({}).toArray();
  const byOwner = new Map();
  for (const p of projects) {
    const key = String(p.researcherId);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(p);
  }

  const actions = [];
  let fixed = 0;
  let alreadyOk = 0;
  let noProject = 0;

  for (const pub of pubs) {
    const ownerId = String(pub.researcherId);
    const mine = byOwner.get(ownerId) || [];
    if (!mine.length) {
      noProject += 1;
      actions.push({ pub: pub.title, action: "skip_no_my_projects", ownerId });
      continue;
    }

    const current = pub.projectId
      ? mine.find((p) => String(p._id) === String(pub.projectId))
      : null;
    if (current) {
      alreadyOk += 1;
      continue;
    }

    // Prefer exact/near title match within My Projects
    let best = null;
    let bestScore = -1;
    for (const p of mine) {
      const sc = score(pub.title, p.title);
      if (sc > bestScore) {
        bestScore = sc;
        best = p;
      }
    }
    // If no keyword overlap, still attach to a My Projects record (prefer active/non-closed)
    if (!best || bestScore < 1) {
      best =
        mine.find((p) => ["active", "closing"].includes(p.status)) ||
        mine.find((p) => p.status === "completed") ||
        mine[0];
      bestScore = 0;
    }

    await pubsCol.updateOne(
      { _id: pub._id },
      { $set: { projectId: best._id, updatedAt: new Date() } }
    );
    fixed += 1;
    actions.push({
      pub: pub.title,
      toProject: best.title,
      score: bestScore,
      projectId: String(best._id),
      ownerId,
    });
  }

  // Verify
  const after = await pubsCol.find({}).toArray();
  const projById = Object.fromEntries(projects.map((p) => [String(p._id), p]));
  const stillBad = after.filter((p) => {
    if (!p.projectId) return true;
    const pr = projById[String(p.projectId)];
    return !pr || String(pr.researcherId) !== String(p.researcherId);
  });

  const summary = {
    fixed,
    alreadyOk,
    noProject,
    stillBad: stillBad.length,
    actions,
  };
  log("synced pubs to owner My Projects", summary);
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
