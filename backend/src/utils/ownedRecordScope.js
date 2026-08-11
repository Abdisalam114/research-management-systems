const { ROLES } = require("../models/User");
const { isValidProgramTier } = require("../constants/programTier");

function isResearcherRole(req) {
  return req.user?.role === ROLES.RESEARCHER;
}

/** Align legacy/wrong programTier on owned records with the researcher's portal. */
async function repairOwnerProgramTier(doc, req) {
  if (!doc || !req?.programTier || !isValidProgramTier(req.programTier)) return doc;
  if (doc.programTier !== req.programTier) {
    doc.programTier = req.programTier;
    await doc.save();
  }
  return doc;
}

/**
 * List/query filter: researchers see all their records (owner id only);
 * staff see records scoped to the active UG/PG portal.
 */
function ownedListFilter(req, base = {}, { ownerField = "researcherId" } = {}) {
  if (isResearcherRole(req)) {
    return { ...base, [ownerField]: req.user.id };
  }
  if (req.tierWhere) return req.tierWhere(base);
  return base;
}

/** Dashboard / analytics counts for researchers — never hide own data behind tier filter. */
function researcherDashboardFilter(req, base = {}, ownerField = "researcherId") {
  if (req.user?.role === ROLES.RESEARCHER) {
    if (ownerField == null) return { ...base };
    return { ...base, [ownerField]: req.user.id };
  }
  if (req.tierWhere) return req.tierWhere(base);
  return base;
}

/** Find one record: owner-first for researchers; tier-scoped for staff. */
async function findOwnedRecord(Model, req, id, { ownerField = "researcherId" } = {}) {
  if (!id) return null;
  try {
    if (isResearcherRole(req)) {
      const doc = await Model.findOne({ _id: id, [ownerField]: req.user.id });
      if (!doc) return null;
      await repairOwnerProgramTier(doc, req);
      return doc;
    }
    if (req.tierWhere) return Model.findOne(req.tierWhere({ _id: id }));
    return Model.findById(id);
  } catch (err) {
    // Invalid Mongo id in /projects/:id (e.g. broken notification link) → not found, not 500.
    if (err?.name === "CastError") return null;
    throw err;
  }
}

/** Create payload with enforced programTier (avoids silent UG default). */
function createWithTier(req, data, label = "program tier") {
  // Prefer active portal (req.programTier) over staff account's stored tier (often UG).
  const tier = req.requireWriteProgramTier(data?.programTier || req.programTier, label);
  return req.tierAssign({ ...data, programTier: tier });
}

/** Workflow/related queries: skip tier filter when PI views own project. */
function relatedRecordsFilter(req, base = {}, { isOwner = false } = {}) {
  if (isOwner && isResearcherRole(req)) return base;
  if (req.tierWhere) return req.tierWhere(base);
  return base;
}

module.exports = {
  isResearcherRole,
  repairOwnerProgramTier,
  ownedListFilter,
  researcherDashboardFilter,
  findOwnedRecord,
  createWithTier,
  relatedRecordsFilter,
};
