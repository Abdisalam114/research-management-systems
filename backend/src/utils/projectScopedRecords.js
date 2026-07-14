const { Project } = require("../models/Project");
const { AppError } = require("../utils/AppError");

function indexByProjectId(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.projectId) continue;
    const key = String(item.projectId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function pickLatestByDate(items, dateField = "updatedAt") {
  if (!items?.length) return null;
  return [...items].sort(
    (a, b) => new Date(b[dateField] || b.createdAt) - new Date(a[dateField] || a.createdAt)
  )[0];
}

function pickPublicationForProject(publications, project) {
  if (!project?._id || !publications?.length) return null;
  const linked = publications.filter(
    (p) => p.projectId && String(p.projectId) === String(project._id)
  );
  if (!linked.length) return null;

  // Prefer validated/submitted over draft so workflow & awards stay correct
  const rank = { validated: 4, submitted: 3, rejected: 2, draft: 1 };
  return [...linked].sort((a, b) => {
    const rankDiff = (rank[b.status] || 0) - (rank[a.status] || 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  })[0];
}

function pickRepositoryForProject(repositoryItems, project) {
  if (!project?._id || !repositoryItems?.length) return null;
  const linked = repositoryItems.filter(
    (r) => r.projectId && String(r.projectId) === String(project._id)
  );
  return pickLatestByDate(linked, "createdAt");
}

async function resolveOwnedProjectId(req, projectId, researcherId) {
  if (!projectId) return null;
  const project = await Project.findOne(req.tierWhere({ _id: projectId, researcherId }));
  if (!project) throw new AppError("Research project not found or does not belong to you", 404);
  return project._id;
}

async function requireOwnedProjectId(req, projectId, researcherId) {
  if (!projectId) {
    throw new AppError("projectId is required — select your research project", 400);
  }
  return resolveOwnedProjectId(req, projectId, researcherId);
}

async function validateProjectQuery(req, projectId, { ownerOnly = false } = {}) {
  if (!projectId) return null;
  const filter = { _id: projectId };
  if (ownerOnly && req.user?.role === "researcher") {
    filter.researcherId = req.user.id;
  }
  const project = await Project.findOne(req.tierWhere(filter));
  if (!project) throw new AppError("Project not found", 404);
  return project._id;
}

module.exports = {
  indexByProjectId,
  pickLatestByDate,
  pickPublicationForProject,
  pickRepositoryForProject,
  resolveOwnedProjectId,
  requireOwnedProjectId,
  validateProjectQuery,
};
