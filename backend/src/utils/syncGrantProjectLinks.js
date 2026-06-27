const { Grant } = require("../models/Grant");
const { Project } = require("../models/Project");

/** Link grants without projectId to the researcher's project in the same portal. */
async function syncGrantProjectLinks(filter = {}) {
  const grants = await Grant.find({
    ...filter,
    $or: [{ projectId: null }, { projectId: { $exists: false } }],
  });

  let updated = 0;
  for (const grant of grants) {
    const project = await Project.findOne({
      programTier: grant.programTier,
      researcherId: grant.researcherId,
    }).sort({ updatedAt: -1 });

    if (!project) continue;

    grant.projectId = project._id;
    await grant.save();
    updated += 1;
  }

  return { scanned: grants.length, updated };
}

module.exports = { syncGrantProjectLinks };
