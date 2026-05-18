const { ResearchGroup, GROUP_MEMBER_ROLES } = require("../models/ResearchGroup");
const { AppError } = require("../utils/AppError");

function sanitizeGroup(g) {
  return {
    id: g._id,
    name: g.name,
    description: g.description,
    departmentId: g.departmentId,
    createdBy: g.createdBy,
    members: g.members,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

async function listGroups(req, res) {
  const groups = await ResearchGroup.find({}).sort({ createdAt: -1 });
  res.json({ groups: groups.map(sanitizeGroup) });
}

async function getGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findById(id);
  if (!group) throw new AppError("Research group not found", 404);
  res.json({ group: sanitizeGroup(group) });
}

async function createGroup(req, res) {
  const { name, description, departmentId } = req.body || {};
  if (!name) throw new AppError("name is required", 400);

  const group = await ResearchGroup.create({
    name: String(name).trim(),
    description: description ? String(description) : "",
    departmentId: departmentId || null,
    createdBy: req.user.id,
    members: [{ userId: req.user.id, role: GROUP_MEMBER_ROLES.LEAD }],
  });

  res.status(201).json({ group: sanitizeGroup(group) });
}

async function joinGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findById(id);
  if (!group) throw new AppError("Research group not found", 404);

  const exists = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
  if (!exists) group.members.push({ userId: req.user.id, role: GROUP_MEMBER_ROLES.MEMBER });

  await group.save();
  res.json({ message: "Joined group", group: sanitizeGroup(group) });
}

async function leaveGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findById(id);
  if (!group) throw new AppError("Research group not found", 404);

  const isLead = (group.members || []).some(
    (m) => String(m.userId) === String(req.user.id) && m.role === GROUP_MEMBER_ROLES.LEAD
  );
  if (isLead) throw new AppError("Group lead cannot leave. Transfer lead or delete the group.", 400);

  group.members = (group.members || []).filter((m) => String(m.userId) !== String(req.user.id));
  await group.save();
  res.json({ message: "Left group", group: sanitizeGroup(group) });
}

async function deleteGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findById(id);
  if (!group) throw new AppError("Research group not found", 404);

  const isLead = (group.members || []).some(
    (m) => String(m.userId) === String(req.user.id) && m.role === GROUP_MEMBER_ROLES.LEAD
  );
  const isDirector = req.user.role === "research_director";

  if (!isLead && !isDirector) throw new AppError("Forbidden", 403);

  await ResearchGroup.deleteOne({ _id: group._id });
  res.json({ message: "Group deleted" });
}

module.exports = { listGroups, getGroup, createGroup, joinGroup, leaveGroup, deleteGroup };

