const { ThesisGroup, THESIS_STATUSES } = require("../models/ThesisGroup");
const { User, ROLES } = require("../models/User");
const { FACULTIES, matchFacultyByName } = require("../utils/facultyMatcher");
const { AppError } = require("../utils/AppError");
const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { Department } = require("../models/Department");
const { notifyUser } = require("../utils/notify");
const { THESIS_GROUPS } = require("../scripts/seedRecords");
const {
  CHAPTER_STATUSES,
  TITLE_PROPOSAL_STATUSES,
  defaultChapters,
  emptyTitleProposal,
  buildActivityTimeline,
  normalizeStudentRows,
  assertMinThesisStudents,
  MIN_THESIS_GROUP_STUDENTS,
} = require("../utils/thesisDefaults");

function resolveTitleProposal(plain) {
  const tp = plain.titleProposal || {};
  const status = tp.status || TITLE_PROPOSAL_STATUSES.NONE;

  if (status === TITLE_PROPOSAL_STATUSES.PENDING || status === TITLE_PROPOSAL_STATUSES.REJECTED) {
    return {
      title: tp.title || "",
      status,
      proposedAt: tp.proposedAt || null,
      proposedBy: tp.proposedBy || null,
      reviewedAt: tp.reviewedAt || null,
      reviewedBy: tp.reviewedBy || null,
      reviewNote: tp.reviewNote || "",
    };
  }

  if (status === TITLE_PROPOSAL_STATUSES.ACCEPTED) {
    const title = (tp.title || plain.title || "").trim();
    if (title) {
      return {
        title,
        status: TITLE_PROPOSAL_STATUSES.ACCEPTED,
        proposedAt: tp.proposedAt || plain.createdAt || null,
        proposedBy: tp.proposedBy || plain.createdBy || null,
        reviewedAt: tp.reviewedAt || plain.createdAt || null,
        reviewedBy: tp.reviewedBy || plain.createdBy || null,
        reviewNote: tp.reviewNote || "",
      };
    }
  }

  const legacyTitle = (plain.title || "").trim();
  if (legacyTitle && status === TITLE_PROPOSAL_STATUSES.NONE && !tp.title?.trim()) {
    return {
      title: legacyTitle,
      status: TITLE_PROPOSAL_STATUSES.ACCEPTED,
      proposedAt: plain.createdAt || null,
      proposedBy: plain.supervisorId || plain.createdBy || null,
      reviewedAt: plain.createdAt || null,
      reviewedBy: plain.coordinatorId || plain.createdBy || null,
      reviewNote: "",
    };
  }

  return emptyTitleProposal();
}

function titleIsLocked(group) {
  const tp = group.titleProposal || {};
  const status = tp.status || TITLE_PROPOSAL_STATUSES.NONE;
  if (status === TITLE_PROPOSAL_STATUSES.ACCEPTED) return true;
  if (status === TITLE_PROPOSAL_STATUSES.NONE && group.title?.trim()) return true;
  return false;
}

async function syncLegacyTitleProposal(group) {
  if (!group.title?.trim()) return false;
  const tp = group.titleProposal || {};
  const status = tp.status || TITLE_PROPOSAL_STATUSES.NONE;
  if (status === TITLE_PROPOSAL_STATUSES.PENDING || status === TITLE_PROPOSAL_STATUSES.REJECTED) return false;
  if (status === TITLE_PROPOSAL_STATUSES.ACCEPTED && tp.title?.trim()) return false;

  group.titleProposal = {
    title: group.title.trim(),
    status: TITLE_PROPOSAL_STATUSES.ACCEPTED,
    proposedAt: tp.proposedAt || group.createdAt || null,
    proposedBy: tp.proposedBy || group.supervisorId || group.createdBy || null,
    reviewedAt: tp.reviewedAt || group.createdAt || null,
    reviewedBy: tp.reviewedBy || group.coordinatorId || group.createdBy || null,
    reviewNote: tp.reviewNote || "",
  };
  await group.save();
  return true;
}

async function syncThesisGroupStudents(group) {
  const count = group.students?.length || 0;
  if (count >= MIN_THESIS_GROUP_STUDENTS) return false;

  const title = (group.title || "").trim();
  const tpl = THESIS_GROUPS.find((t) => t.title === title);
  if (!tpl?.students?.length) return false;

  group.students = tpl.students.map((s) => ({
    fullName: String(s.fullName || "").trim(),
    studentId: String(s.studentId || "").trim(),
    email: String(s.email || "").trim().toLowerCase(),
  }));
  await group.save();
  return true;
}

function sanitize(g) {
  const plain = g.toObject ? g.toObject() : g;
  const chapters = plain.chapters?.length ? plain.chapters : defaultChapters();
  const titleProposal = resolveTitleProposal(plain);
  const enriched = { ...plain, chapters, titleProposal };
  return {
    id: plain._id,
    title: plain.title,
    titleProposal,
    students: plain.students,
    researchGroupId: plain.researchGroupId,
    supervisorId: plain.supervisorId,
    supervisorAssignedAt: plain.supervisorAssignedAt || null,
    chapters,
    coordinatorId: plain.coordinatorId,
    department: plain.department,
    faculty: plain.faculty,
    facultyResearchArea: plain.facultyResearchArea,
    status: plain.status,
    meetingSchedule: plain.meetingSchedule,
    meetings: plain.meetings,
    activityTimeline: buildActivityTimeline(enriched),
    createdBy: plain.createdBy,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function resolveFaculty(facultyInput, departmentInput) {
  const f = (facultyInput || "").trim();
  if (f && FACULTIES.includes(f)) return f;
  return matchFacultyByName(departmentInput || "");
}

function ensureChapters(group) {
  if (!group.chapters || group.chapters.length === 0) {
    group.chapters = defaultChapters();
  }
}

function applyStudentTitleProposal(group, title, userId) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    group.titleProposal = emptyTitleProposal();
    return;
  }
  group.titleProposal = {
    title: trimmed,
    status: TITLE_PROPOSAL_STATUSES.PENDING,
    proposedAt: new Date(),
    proposedBy: userId,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
}

async function notifySupervisorAssignment(group, programTier) {
  if (!group.supervisorId) return;
  const studentNames = (group.students || []).map((s) => s.fullName).filter(Boolean).join(", ");
  await notifyUser(group.supervisorId, {
    type: "system",
    title: "Thesis supervision assignment",
    body: `You have been assigned to supervise a thesis group${studentNames ? ` (${studentNames})` : ""}. When students choose their thesis title, enter it on the Thesis page.`,
    link: "/thesis",
    programTier,
  });
}

async function listGroups(req, res) {
  const { role, id: userId } = req.user;
  let filter = {};

  if (role === ROLES.RESEARCHER) {
    filter = { supervisorId: userId };
  }

  const groups = await ThesisGroup.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role");

  await Promise.all(groups.map((g) => syncLegacyTitleProposal(g)));
  await Promise.all(groups.map((g) => syncThesisGroupStudents(g)));

  res.json({ groups: groups.map(sanitize) });
}

async function getGroup(req, res) {
  const { id } = req.params;
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }))
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email")
    .populate("titleProposal.proposedBy", "fullName email")
    .populate("titleProposal.reviewedBy", "fullName email");
  if (!group) throw new AppError("Thesis group not found", 404);
  res.json({ group: sanitize(group) });
}

async function createGroup(req, res) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can create thesis groups", 403);
  }

  const {
    students,
    supervisorId,
    department,
    faculty,
    facultyResearchArea,
    meetingSchedule,
    status,
  } = req.body || {};

  let cleanStudents;
  try {
    cleanStudents = assertMinThesisStudents(students);
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }

  let resolvedSupervisorId = null;
  if (supervisorId) {
    const sup = await User.findOne(req.tierWhere({ _id: supervisorId }));
    if (!sup) throw new AppError("Supervisor user not found", 404);
    if (sup.role !== ROLES.RESEARCHER) throw new AppError("Supervisor must have researcher role", 400);
    resolvedSupervisorId = sup._id;
  }

  const facultyValue = resolveFaculty(faculty, department);
  const coordinatorId = role === ROLES.FACULTY_COORDINATOR ? userId : null;
  const cleanDepartment = department ? String(department).trim() : "";

  const leadId = resolvedSupervisorId || userId;
  const memberIds = new Set([String(leadId)]);
  if (String(leadId) !== String(userId)) memberIds.add(String(userId));

  let departmentId = null;
  if (cleanDepartment) {
    const deptDoc = await Department.findOne(req.tierWhere({ name: cleanDepartment })).select("_id");
    if (deptDoc) departmentId = deptDoc._id;
  }

  const firstStudent = Array.isArray(students) && students[0] ? String(students[0].fullName || "").trim() : "";
  const rgNameBase = firstStudent ? `Thesis: ${firstStudent}` : "Thesis Group";
  const rgName = rgNameBase.length > 120 ? rgNameBase.slice(0, 120) : rgNameBase;

  const researchGroup = await ResearchGroup.create(req.tierAssign({
    name: rgName,
    description: "Thesis student group (auto-created).",
    kind: GROUP_KINDS.THESIS,
    departmentId,
    createdBy: userId,
    members: Array.from(memberIds).map((id) => ({
      userId: id,
      role: String(id) === String(leadId) ? GROUP_MEMBER_ROLES.LEAD : GROUP_MEMBER_ROLES.MEMBER,
    })),
  }));

  const groupData = req.tierAssign({
    title: "",
    students: cleanStudents,
    researchGroupId: researchGroup._id,
    supervisorId: resolvedSupervisorId,
    supervisorAssignedAt: resolvedSupervisorId ? new Date() : null,
    coordinatorId,
    department: cleanDepartment,
    faculty: facultyValue,
    facultyResearchArea: facultyResearchArea ? String(facultyResearchArea).trim() : "",
    meetingSchedule: meetingSchedule ? String(meetingSchedule).trim() : "",
    status: status && Object.values(THESIS_STATUSES).includes(status) ? status : THESIS_STATUSES.PROPOSED,
    chapters: defaultChapters(),
    titleProposal: emptyTitleProposal(),
    createdBy: userId,
  });

  const group = await ThesisGroup.create(groupData);
  if (resolvedSupervisorId) {
    await notifySupervisorAssignment(group, req.programTier);
  }

  res.status(201).json({ group: sanitize(group) });
}

async function updateGroup(req, res) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can update thesis groups", 403);
  }

  const { id } = req.params;
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  ensureChapters(group);

  const {
    students,
    supervisorId,
    department,
    faculty,
    facultyResearchArea,
    meetingSchedule,
    status,
  } = req.body || {};

  const prevSupervisorId = group.supervisorId ? String(group.supervisorId) : null;

  if (Array.isArray(students)) {
    try {
      group.students = assertMinThesisStudents(students);
    } catch (e) {
      throw new AppError(e.message, e.statusCode || 400);
    }
  }
  if (supervisorId !== undefined) {
    if (supervisorId === null || supervisorId === "") {
      group.supervisorId = null;
      group.supervisorAssignedAt = null;
    } else {
      const sup = await User.findOne(req.tierWhere({ _id: supervisorId }));
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

  const newSupervisorId = group.supervisorId ? String(group.supervisorId) : null;
  if (newSupervisorId && newSupervisorId !== prevSupervisorId) {
    group.supervisorAssignedAt = new Date();
    await notifySupervisorAssignment(group, req.programTier);
  }

  await group.save();
  res.json({ group: sanitize(group) });
}

async function proposeTitle(req, res) {
  const { id: userId } = req.user;
  const { id } = req.params;
  const { title } = req.body || {};
  const trimmed = String(title || "").trim();
  if (!trimmed) throw new AppError("title is required", 400);

  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  if (!group.supervisorId || String(group.supervisorId) !== String(userId)) {
    throw new AppError("Only the assigned supervisor can enter the student-chosen thesis title", 403);
  }

  if (titleIsLocked(group)) {
    throw new AppError("Title is already accepted; contact coordinator to change it", 400);
  }

  applyStudentTitleProposal(group, trimmed, userId);
  await group.save();

  const notifyTarget = group.coordinatorId || group.createdBy;
  if (notifyTarget) {
    await notifyUser(notifyTarget, {
      type: "system",
      title: "Thesis title submitted for review",
      body: `Supervisor submitted the student-chosen thesis title: "${trimmed}". Please review and accept on the Thesis page.`,
      link: "/thesis",
      programTier: req.programTier,
    });
  }

  res.json({ group: sanitize(group) });
}

async function reviewTitleProposal(req, res) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can accept or reject a title proposal", 403);
  }

  const { id } = req.params;
  const { decision, note } = req.body || {};
  const normalized = String(decision || "").toLowerCase();
  if (!["accept", "accepted", "reject", "rejected"].includes(normalized)) {
    throw new AppError("decision must be accept or reject", 400);
  }

  const accepting = normalized === "accept" || normalized === "accepted";
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  if (!group.titleProposal?.title?.trim()) {
    throw new AppError("No student title proposal to review", 400);
  }
  if (group.titleProposal.status !== TITLE_PROPOSAL_STATUSES.PENDING) {
    throw new AppError("Title proposal is not pending review", 400);
  }

  group.titleProposal.status = accepting ? TITLE_PROPOSAL_STATUSES.ACCEPTED : TITLE_PROPOSAL_STATUSES.REJECTED;
  group.titleProposal.reviewedAt = new Date();
  group.titleProposal.reviewedBy = userId;
  group.titleProposal.reviewNote = note ? String(note) : "";

  if (accepting) {
    group.title = group.titleProposal.title;
    if (group.status === THESIS_STATUSES.PROPOSED) {
      group.status = THESIS_STATUSES.IN_PROGRESS;
    }
  }

  await group.save();

  if (group.supervisorId) {
    await notifyUser(group.supervisorId, {
      type: "system",
      title: accepting ? "Thesis title accepted" : "Thesis title rejected",
      body: accepting
        ? `The thesis title "${group.titleProposal.title}" has been accepted. You may begin supervision.`
        : `The proposed thesis title was rejected.${note ? ` Note: ${note}` : ""}`,
      link: "/thesis",
      programTier: req.programTier,
    });
  }

  res.json({ group: sanitize(group) });
}

async function updateChapter(req, res) {
  const { role, id: userId } = req.user;
  const { id, chapterKey } = req.params;
  const { status, notes } = req.body || {};

  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  ensureChapters(group);

  const isSupervisor = group.supervisorId && String(group.supervisorId) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) {
    throw new AppError("Only supervisor, coordinator, or director can update chapter progress", 403);
  }

  const chapter = group.chapters.find((c) => c.key === chapterKey);
  if (!chapter) throw new AppError("Chapter not found", 404);

  if (status !== undefined) {
    if (!Object.values(CHAPTER_STATUSES).includes(status)) throw new AppError("Invalid chapter status", 400);
    chapter.status = status;
  }
  if (notes !== undefined) chapter.notes = String(notes);
  chapter.updatedAt = new Date();
  chapter.updatedBy = userId;

  await group.save();

  res.json({ group: sanitize(group) });
}

async function addMeeting(req, res) {
  const { role, id: userId } = req.user;
  const { id } = req.params;
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  ensureChapters(group);

  const isSupervisor = group.supervisorId && String(group.supervisorId) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) throw new AppError("Only supervisor, coordinator, or director can log meetings", 403);

  const { date, location, agenda, notes, chaptersDiscussed } = req.body || {};
  if (!date) throw new AppError("date is required", 400);

  const validKeys = new Set((group.chapters || []).map((c) => c.key));
  const chapterKeys = Array.isArray(chaptersDiscussed)
    ? chaptersDiscussed.map((k) => String(k).trim()).filter((k) => validKeys.has(k))
    : [];

  group.meetings.push({
    date: new Date(date),
    location: location ? String(location).trim() : "",
    agenda: agenda ? String(agenda) : "",
    notes: notes ? String(notes) : "",
    chaptersDiscussed: chapterKeys,
    loggedBy: userId,
  });
  await group.save();

  res.status(201).json({ group: sanitize(group) });
}

async function deleteGroup(req, res) {
  const { role } = req.user;
  if (role !== ROLES.RESEARCH_DIRECTOR) throw new AppError("Only the director can delete thesis groups", 403);

  const { id } = req.params;
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);
  await ThesisGroup.deleteOne({ _id: group._id });
  res.json({ message: "Thesis group deleted" });
}

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  proposeTitle,
  reviewTitleProposal,
  updateChapter,
  addMeeting,
  deleteGroup,
  THESIS_STATUSES,
};
