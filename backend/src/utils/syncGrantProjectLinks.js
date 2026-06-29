const { Grant } = require("../models/Grant");
const { Project } = require("../models/Project");

/** Link unlinked grants only when the researcher has exactly one project (safe backfill). */
async function syncGrantProjectLinks(filter = {}) {
  const grants = await Grant.find({
    ...filter,
    $or: [{ projectId: null }, { projectId: { $exists: false } }],
  });

  let updated = 0;
  let skipped = 0;
  for (const grant of grants) {
    const projects = await Project.find({
      programTier: grant.programTier,
      researcherId: grant.researcherId,
    }).sort({ createdAt: 1 });

    if (projects.length !== 1) {
      skipped += 1;
      continue;
    }

    grant.projectId = projects[0]._id;
    await grant.save();
    updated += 1;
  }

  return { scanned: grants.length, updated, skipped };
}

module.exports = { syncGrantProjectLinks };
