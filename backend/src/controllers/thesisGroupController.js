const fs = require("fs");
const path = require("path");
const { ThesisGroup, THESIS_STATUSES } = require("../models/ThesisGroup");
const { User, ROLES } = require("../models/User");
const { FACULTIES, matchFacultyByName } = require("../utils/facultyMatcher");
const { AppError } = require("../utils/AppError");
const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { Department } = require("../models/Department");

function debugLog(location, data) {
  // #region agent log
  try {
    const logPath = path.resolve(__dirname, "../../../debug-6113cc.log");
    const entry = {
      sessionId: "6113cc",
      runId: "pre-push",
      hypothesisId: "thesis-to-groups",
      location,
      message: "thesis group -> collaboration group linkage",
      data,
      timestamp: Date.now(),
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch (_) {}
  // #endregion
}

function sanitize(g) {
  return {
    id: g._id,
    title: g.title,
    students: g.students,
    researchGroupId: g.researchGroupId,
    supervisorId: g.supervisorId,
    coordinatorId: g.coordinatorId,
    department: g.department,
    faculty: g.faculty,
    facultyResearchArea: g.facultyResearchArea,
    status: g.status,
    meetingSchedule: g.meetingSchedule,
    meetings: g.meetings,
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

function resolveFaculty(facultyInput, departmentInput) {
  const f = (facultyInput || "").trim();
  if (f && FACULTIES.includes(f)) return f;
  return matchFacultyByName(departmentInput || "");
}

async function listGroups(req, res) {
  const { role, id: userId } = req.user;
  let filter = {};

  if (role === ROLES.RESEARCHER) {
    filter = { supervisorId: userId };
  }
  // Coordinator + Director see all (could later scope coordinator by faculty)

  const groups = await ThesisGroup.find(filter)
    .sort({ createdAt: -1 })
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role");

  res.json({ groups: groups.map(sanitize) });
}

async function getGroup(req, res) {
  const { id } = req.params;
  const group = await ThesisGroup.findById(id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");
  if (!group) throw new AppError("Thesis group not found", 404);
  res.json({ group: sanitize(group) });
}

async function createGroup(req, res) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can create thesis groups", 403);
  }

  const {
    title,
    students,
    supervisorId,
    department,
    faculty,
    facultyResearchArea,
    meetingSchedule,
    status,
  } = req.body || {};

  if (!Array.isArray(students) || students.length === 0) {
    throw new AppError("students array is required (at least one student)", 400);
  }

  // Validate supervisor if provided.
  let resolvedSupervisorId = null;
  if (supervisorId) {
    const sup = await User.findById(supervisorId);
    if (!sup) throw new AppError("Supervisor user not found", 404);
    if (sup.role !== ROLES.RESEARCHER) throw new AppError("Supervisor must have researcher role", 400);
    resolvedSupervisorId = sup._id;
  }

  const facultyValue = resolveFaculty(faculty, department);

  const coordinatorId = role === ROLES.FACULTY_COORDINATOR ? userId : null;

  const cleanDepartment = department ? String(department).trim() : "";

  // Create a Collaboration Group (ResearchGroup) so the thesis shows up under /groups.
  // Lead defaults to supervisor if present, otherwise the creator.
  const leadId = resolvedSupervisorId || userId;
  const memberIds = new Set([String(leadId)]);
  if (String(leadId) !== String(userId)) memberIds.add(String(userId));

  let departmentId = null;
  if (cleanDepartment) {
    const deptDoc = await Department.findOne({ name: cleanDepartment }).select("_id");
    if (deptDoc) departmentId = deptDoc._id;
  }

  const firstStudent = Array.isArray(students) && students[0] ? String(students[0].fullName || "").trim() : "";
  const rgNameBase = title ? String(title).trim() : firstStudent ? `Thesis: ${firstStudent}` : "Thesis Group";
  const rgName = rgNameBase.length > 120 ? rgNameBase.slice(0, 120) : rgNameBase;

  const researchGroup = await ResearchGroup.create({
    name: rgName,
    description: "Thesis student group (auto-created).",
    kind: GROUP_KINDS.THESIS,
    departmentId,
    createdBy: userId,
    members: Array.from(memberIds).map((id) => ({
      userId: id,
      role: String(id) === String(leadId) ? GROUP_MEMBER_ROLES.LEAD : GROUP_MEMBER_ROLES.MEMBER,
    })),
  });

  const group = await ThesisGroup.create({
    title: title ? String(title).trim() : "",
    students: students.map((s) => ({
      fullName: String(s.fullName || "").trim(),
      studentId: String(s.studentId || "").trim(),
      email: String(s.email || "").trim().toLowerCase(),
    })),
    researchGroupId: researchGroup._id,
    supervisorId: resolvedSupervisorId,
    coordinatorId,
    department: cleanDepartment,
    faculty: facultyValue,
    facultyResearchArea: facultyResearchArea ? String(facultyResearchArea).trim() : "",
    meetingSchedule: meetingSchedule ? String(meetingSchedule).trim() : "",
    status: status && Object.values(THESIS_STATUSES).includes(status) ? status : THESIS_STATUSES.PROPOSED,
    createdBy: userId,
  });

  debugLog("thesisGroupController.js:createGroup", {
    thesisGroupId: String(group._id),
    researchGroupId: String(researchGroup._id),
    researchGroupName: researchGroup.name,
    leadId: String(leadId),
    departmentId: departmentId ? String(departmentId) : null,
  });

  res.status(201).json({ group: sanitize(group) });
}

async function updateGroup(req, res) {
  const { role } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can update thesis groups", 403);
  }

  const { id } = req.params;
  const group = await ThesisGroup.findById(id);
  if (!group) throw new AppError("Thesis group not found", 404);

  const {
    title,
    students,
    supervisorId,
    department,
    faculty,
    facultyResearchArea,
    meetingSchedule,
    status,
  } = req.body || {};

  if (title !== undefined) group.title = String(title).trim();
  if (Array.isArray(students)) {
    group.students = students.map((s) => ({
      fullName: String(s.fullName || "").trim(),
      studentId: String(s.studentId || "").trim(),
      email: String(s.email || "").trim().toLowerCase(),
    }));
  }
  if (supervisorId !== undefined) {
    if (supervisorId === null || supervisorId === "") {
      group.supervisorId = null;
    } else {
      const sup = await User.findById(supervisorId);
      if (!sup) throw new AppError("Supervisor user not found", 404);
      if (sup.role !== ROLES.RESEARCHER) throw new AppError("Supervisor must have researcher role", 400);
      group.supervisorId = sup._id;
    }
  }
  if (department !== undefined) group.department = String(department).trim();
  if (faculty !== undefined || department !== undefined) {
    group.faculty = resolveFaculty(faculty !== undefined ? faculty : group.faculty, department !== undefined ? department : group.department);
  }
  if (facultyResearchArea !== undefined) group.facultyResearchArea = String(facultyResearchArea).trim();
  if (meetingSchedule !== undefined) group.meetingSchedule = String(meetingSchedule).trim();
  if (status !== undefined) {
    if (!Object.values(THESIS_STATUSES).includes(status)) throw new AppError("Invalid status", 400);
    group.status = status;
  }

  await group.save();
  res.json({ group: sanitize(group) });
}

async function addMeeting(req, res) {
  const { role, id: userId } = req.user;
  const { id } = req.params;
  const group = await ThesisGroup.findById(id);
  if (!group) throw new AppError("Thesis group not found", 404);

  // Supervisor of the group OR coordinator/director can log meetings.
  const isSupervisor = group.supervisorId && String(group.supervisorId) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) throw new AppError("Only supervisor, coordinator, or director can log meetings", 403);

  const { date, location, agenda, notes } = req.body || {};
  if (!date) throw new AppError("date is required", 400);

  group.meetings.push({
    date: new Date(date),
    location: location ? String(location).trim() : "",
    agenda: agenda ? String(agenda) : "",
    notes: notes ? String(notes) : "",
    loggedBy: userId,
  });
  await group.save();
  res.status(201).json({ group: sanitize(group) });
}

async function deleteGroup(req, res) {
  const { role } = req.user;
  if (role !== ROLES.RESEARCH_DIRECTOR) throw new AppError("Only the director can delete thesis groups", 403);

  const { id } = req.params;
  const group = await ThesisGroup.findById(id);
  if (!group) throw new AppError("Thesis group not found", 404);
  await ThesisGroup.deleteOne({ _id: group._id });
  res.json({ message: "Thesis group deleted" });
}

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  addMeeting,
  deleteGroup,
  THESIS_STATUSES,
};
