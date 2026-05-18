const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { AppError } = require("../utils/AppError");

function sanitizeItem(i) {
  return {
    id: i._id,
    type: i.type,
    title: i.title,
    description: i.description,
    tags: i.tags,
    filePath: i.filePath,
    fileSize: i.fileSize,
    access: i.access,
    groupId: i.groupId,
    projectId: i.projectId,
    uploadedBy: i.uploadedBy,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

async function listItems(req, res) {
  const { role } = req.user;

  if (["research_director", "faculty_coordinator"].includes(role)) {
    const items = await RepositoryItem.find({}).sort({ createdAt: -1 });
    return res.json({ items: items.map(sanitizeItem) });
  }

  if (role === "finance_officer") {
    // Finance can see institution-wide items only (safest default)
    const items = await RepositoryItem.find({ access: REPOSITORY_ACCESS.INSTITUTION }).sort({ createdAt: -1 });
    return res.json({ items: items.map(sanitizeItem) });
  }

  // Researcher: can see own uploads + institution + groups they belong to
  const groups = await ResearchGroup.find({ "members.userId": req.user.id }).select("_id");
  const groupIds = groups.map((g) => g._id);

  const items = await RepositoryItem.find({
    $or: [
      { uploadedBy: req.user.id },
      { access: REPOSITORY_ACCESS.INSTITUTION },
      { access: REPOSITORY_ACCESS.GROUP, groupId: { $in: groupIds } },
    ],
  }).sort({ createdAt: -1 });

  return res.json({ items: items.map(sanitizeItem) });
}

async function uploadItem(req, res) {
  const { type, title, description, tags, access, groupId, projectId } = req.body || {};
  if (!type || !title) throw new AppError("type and title are required", 400);
  if (!req.file) throw new AppError("file is required", 400);

  const normalizedAccess = access && Object.values(REPOSITORY_ACCESS).includes(access) ? access : REPOSITORY_ACCESS.PRIVATE;
  const normalizedGroupId = normalizedAccess === REPOSITORY_ACCESS.GROUP ? groupId || null : null;

  if (normalizedAccess === REPOSITORY_ACCESS.GROUP) {
    if (!normalizedGroupId) throw new AppError("groupId is required for group access", 400);
    const group = await ResearchGroup.findById(normalizedGroupId);
    if (!group) throw new AppError("Research group not found", 404);
    const isMember = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (!isMember) throw new AppError("Forbidden", 403);
  }

  const item = await RepositoryItem.create({
    type,
    title: String(title).trim(),
    description: description ? String(description) : "",
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    filePath: `/uploads/${req.file.filename}`,
    fileSize: req.file.size || 0,
    access: normalizedAccess,
    groupId: normalizedGroupId,
    projectId: projectId || null,
    uploadedBy: req.user.id,
  });

  res.status(201).json({ item: sanitizeItem(item) });
}

async function getItem(req, res) {
  const { id } = req.params;
  const item = await RepositoryItem.findById(id);
  if (!item) throw new AppError("Repository item not found", 404);

  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (isStaff) return res.json({ item: sanitizeItem(item) });

  if (String(item.uploadedBy) === String(req.user.id)) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.INSTITUTION) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.GROUP && item.groupId) {
    const group = await ResearchGroup.findById(item.groupId);
    const isMember = group && (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (isMember) return res.json({ item: sanitizeItem(item) });
  }

  throw new AppError("Forbidden", 403);
}

module.exports = { listItems, uploadItem, getItem };

