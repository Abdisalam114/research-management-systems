const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { AppError } = require("../utils/AppError");
const { ThesisGroup } = require("../models/ThesisGroup");

function sanitizeGroup(g, thesis) {
  return {
    id: g._id,
    name: g.name,
    description: g.description,
    kind: g.kind,
    departmentId: g.departmentId,
    createdBy: g.createdBy,
    members: g.members,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    thesis: thesis
      ? {
          id: thesis._id,
          title: thesis.title,
          status: thesis.status,
          faculty: thesis.faculty,
          department: thesis.department,
          supervisor: thesis.supervisorId
            ? { id: thesis.supervisorId._id, fullName: thesis.supervisorId.fullName, department: thesis.supervisorId.department }
            : null,
          meetingsCount: (thesis.meetings || []).length,
          lastMeetingAt:
            (thesis.meetings || []).length > 0
              ? (thesis.meetings || []).reduce((m, x) => (!m || new Date(x.date) > new Date(m) ? x.date : m), null)
              : null,
          meetingSchedule: thesis.meetingSchedule,
          facultyResearchArea: thesis.facultyResearchArea,
        }
      : null,
  };
}

async function listGroups(req, res) {
  const { kind } = req.query || {};
  const filter = {};
  if (kind && Object.values(GROUP_KINDS).includes(kind)) filter.kind = kind;
  const groups = await ResearchGroup.find(req.tierWhere(filter)).sort({ createdAt: -1 });

  if (filter.kind === GROUP_KINDS.THESIS) {
    const ids = groups.map((g) => g._id);
    const theses = await ThesisGroup.find(req.tierWhere({ researchGroupId: { $in: ids } }))
      .select("title status faculty department supervisorId meetings meetingSchedule facultyResearchArea researchGroupId")
      .populate("supervisorId", "fullName department");
    const map = new Map(theses.map((t) => [String(t.researchGroupId), t]));
    return res.json({ groups: groups.map((g) => sanitizeGroup(g, map.get(String(g._id)))) });
  }

  res.json({ groups: groups.map((g) => sanitizeGroup(g, null)) });
}

async function getGroupStats(req, res) {
  const total = await ResearchGroup.countDocuments(req.tierWhere({}));
  const thesis = await ResearchGroup.countDocuments(req.tierWhere({ kind: GROUP_KINDS.THESIS }));
  const collaboration = total - thesis;

  res.json({ stats: { total, thesis, collaboration } });
}

async function getGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Research group not found", 404);
  res.json({ group: sanitizeGroup(group) });
}

async function createGroup(req, res) {
  const { name, description, departmentId } = req.body || {};
  if (!name) throw new AppError("name is required", 400);

  const group = await ResearchGroup.create(req.tierAssign({
    name: String(name).trim(),
    description: description ? String(description) : "",
    departmentId: departmentId || null,
    createdBy: req.user.id,
    members: [{ userId: req.user.id, role: GROUP_MEMBER_ROLES.LEAD }],
  }));

  res.status(201).json({ group: sanitizeGroup(group) });
}

async function joinGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Research group not found", 404);

  const exists = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
  if (!exists) group.members.push({ userId: req.user.id, role: GROUP_MEMBER_ROLES.MEMBER });

  await group.save();
  res.json({ message: "Joined group", group: sanitizeGroup(group) });
}

async function leaveGroup(req, res) {
  const { id } = req.params;
  const group = await ResearchGroup.findOne(req.tierWhere({ _id: id }));
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
  const group = await ResearchGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Research group not found", 404);

  const isLead = (group.members || []).some(
    (m) => String(m.userId) === String(req.user.id) && m.role === GROUP_MEMBER_ROLES.LEAD
  );
  const isDirector = req.user.role === "research_director";

  if (!isLead && !isDirector) throw new AppError("Forbidden", 403);

  await ResearchGroup.deleteOne({ _id: group._id });
  res.json({ message: "Group deleted" });
}

module.exports = { listGroups, getGroupStats, getGroup, createGroup, joinGroup, leaveGroup, deleteGroup };

