const { ThesisGroup, THESIS_STATUSES } = require("../models/ThesisGroup");
const { User, ROLES } = require("../models/User");
const { FACULTIES, DEFAULT_FACULTY, matchFacultyByName } = require("../utils/facultyMatcher");
const fs = require("fs");
const path = require("path");
const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function debugLog(hypothesisId, message, data) {
  // #region agent log
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "thesis-fix",
        hypothesisId,
        location: "thesisGroupController.js",
        message,
        data,
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

function canonicalFaculty(value, fallbackName) {
  const raw = String(value || "").trim();
  if (raw && FACULTIES.includes(raw)) return raw;
  return matchFacultyByName(raw || fallbackName || "") || DEFAULT_FACULTY;
}

function facultiesMatch(a, b, fallbackName) {
  return canonicalFaculty(a, fallbackName) === canonicalFaculty(b, fallbackName);
}
const { AppError } = require("../utils/AppError");
const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { Department } = require("../models/Department");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const {
  CHAPTER_STATUSES,
  TITLE_PROPOSAL_STATUSES,
  defaultChapters,
  emptyTitleProposal,
  buildActivityTimeline,
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

function sanitize(g) {
  const plain = g.toObject ? g.toObject() : g;
  const chapters = plain.chapters?.length ? plain.chapters : defaultChapters();
  const titleProposal = resolveTitleProposal(plain);
  const enriched = { ...plain, chapters, titleProposal };
  const rg = plain.researchGroupId;
  const departmentId =
    rg && typeof rg === "object" && rg.departmentId
      ? rg.departmentId
      : plain.departmentId || null;
  return {
    id: plain._id,
    title: plain.title,
    titleProposal,
    students: plain.students,
    researchGroupId: plain.researchGroupId,
    departmentId: departmentId ? String(departmentId) : null,
    supervisorId: plain.supervisorId,
    supervisorAssignedAt: plain.supervisorAssignedAt || null,
    chapters,
    coordinatorId: plain.coordinatorId,
    department: plain.department,
    faculty: canonicalFaculty(plain.faculty, plain.department),
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

async function resolveThesisDepartment(req, { departmentId, department, faculty }) {
  const facultyInput = (faculty || "").trim();
  let cleanDepartment = department ? String(department).trim() : "";
  let linkedDepartmentId = null;
  let facultyValue = facultyInput;

  if (departmentId) {
    const deptDoc = await Department.findOne(req.tierWhere({ _id: departmentId }));
    if (!deptDoc) throw new AppError("Department not found", 404);
    if (facultyInput && deptDoc.faculty && !facultiesMatch(deptDoc.faculty, facultyInput, deptDoc.name)) {
      throw new AppError("Department does not belong to the selected faculty", 400);
    }
    cleanDepartment = deptDoc.name;
    linkedDepartmentId = deptDoc._id;
    facultyValue = canonicalFaculty(deptDoc.faculty || facultyInput, cleanDepartment);
  } else if (cleanDepartment) {
    const deptDoc = await Department.findOne(req.tierWhere({ name: cleanDepartment }));
    if (deptDoc) {
      linkedDepartmentId = deptDoc._id;
      if (facultyInput && deptDoc.faculty && !facultiesMatch(deptDoc.faculty, facultyInput, deptDoc.name)) {
        throw new AppError("Department does not belong to the selected faculty", 400);
      }
      facultyValue = canonicalFaculty(deptDoc.faculty || facultyInput, cleanDepartment);
    } else {
      facultyValue = resolveFaculty(facultyInput, cleanDepartment);
    }
  } else {
    throw new AppError("department is required", 400);
  }

  if (!facultyValue) facultyValue = resolveFaculty("", cleanDepartment);
  facultyValue = canonicalFaculty(facultyValue, cleanDepartment);
  return { cleanDepartment, linkedDepartmentId, facultyValue };
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

async function loadSanitizedGroup(id) {
  const populated = await ThesisGroup.findById(id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");
  return sanitize(populated);
}

async function notifySupervisorAssignment(group, programTier) {
  if (!group.supervisorId) return;
  const studentNames = (group.students || []).map((s) => s.fullName).filter(Boolean).join(", ");
  await notifyUser(group.supervisorId, {
    type: "system",
    title: "Thesis supervision assignment",
    body: `You have been assigned to supervise a thesis group${studentNames ? ` (${studentNames})` : ""}. When students choose their thesis title, enter it on the Thesis page.`,
    link: `/thesis?groupId=${group._id}`,
    programTier,
  });
}

/** Notify Research Director + Faculty Coordinator when the supervisor updates a thesis group. */
async function notifyStaffOfSupervisorUpdate(group, programTier, { title, body }) {
  const link = `/thesis?groupId=${group._id}`;
  const payload = {
    type: "system",
    title: title || "Thesis supervisor update",
    body: body || "The thesis supervisor made an update.",
    link,
  };
  try {
    await notifyUsersByRole(ROLES.RESEARCH_DIRECTOR, payload, programTier);
  } catch {
    /* best-effort */
  }
  try {
    await notifyUsersByRole(ROLES.FACULTY_COORDINATOR, payload, programTier);
  } catch {
    /* best-effort */
  }
  if (group.coordinatorId) {
    try {
      await notifyUser(group.coordinatorId, { ...payload, programTier });
    } catch {
      /* best-effort */
    }
  }
}

function thesisGroupLabel(group) {
  const t = String(group?.titleProposal?.title || group?.title || "").trim();
  return t || "Untitled thesis group";
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
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");

  // One-time legacy title sync only — do not rewrite students from seed templates on every list
  await Promise.all(groups.map((g) => syncLegacyTitleProposal(g)));

  debugLog("H3", "listGroups", {
    role,
    count: groups.length,
    valid: groups.filter((g) => (g.students || []).length >= MIN_THESIS_GROUP_STUDENTS).length,
  });

  res.json({ groups: groups.map(sanitize) });
}

async function getGroup(req, res) {
  const { role, id: userId } = req.user;
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

  if (role === ROLES.RESEARCHER) {
    const isSupervisor = group.supervisorId && String(group.supervisorId._id || group.supervisorId) === String(userId);
    if (!isSupervisor) throw new AppError("Forbidden", 403);
  }

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
    departmentId,
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

  const { cleanDepartment, linkedDepartmentId, facultyValue } = await resolveThesisDepartment(req, {
    departmentId,
    department,
    faculty,
  });
  const coordinatorId = role === ROLES.FACULTY_COORDINATOR ? userId : null;

  const leadId = resolvedSupervisorId || userId;
  const memberIds = new Set([String(leadId)]);
  if (String(leadId) !== String(userId)) memberIds.add(String(userId));

  let departmentIdForGroup = linkedDepartmentId;

  const firstStudent = Array.isArray(students) && students[0] ? String(students[0].fullName || "").trim() : "";
  const rgNameBase = firstStudent ? `Thesis: ${firstStudent}` : "Thesis Group";
  const rgName = rgNameBase.length > 120 ? rgNameBase.slice(0, 120) : rgNameBase;

  const researchGroup = await ResearchGroup.create(req.tierAssign({
    name: rgName,
    description: "Thesis student group (auto-created).",
    kind: GROUP_KINDS.THESIS,
    departmentId: departmentIdForGroup,
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

  debugLog("H1", "createGroup ok", {
    groupId: String(group._id),
    faculty: group.faculty,
    department: group.department,
    students: (group.students || []).length,
    supervisorId: resolvedSupervisorId ? String(resolvedSupervisorId) : null,
    role,
  });

  const populated = await ThesisGroup.findById(group._id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role");

  res.status(201).json({ group: sanitize(populated || group) });
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
    departmentId,
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
  if (department !== undefined || departmentId !== undefined || faculty !== undefined) {
    const resolved = await resolveThesisDepartment(req, {
      departmentId: departmentId !== undefined ? departmentId : undefined,
      department: department !== undefined ? department : group.department,
      faculty: faculty !== undefined ? faculty : group.faculty,
    });
    group.department = resolved.cleanDepartment;
    group.faculty = resolved.facultyValue;
    if (group.researchGroupId && resolved.linkedDepartmentId) {
      await ResearchGroup.updateOne(
        req.tierWhere({ _id: group.researchGroupId }),
        { $set: { departmentId: resolved.linkedDepartmentId } }
      );
    }
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

  // Keep linked research group membership in sync with supervisor
  if (group.researchGroupId && (supervisorId !== undefined || newSupervisorId !== prevSupervisorId)) {
    const leadId = newSupervisorId || String(userId);
    const memberIds = new Set([String(leadId), String(userId)]);
    await ResearchGroup.updateOne(
      req.tierWhere({ _id: group.researchGroupId }),
      {
        $set: {
          members: Array.from(memberIds).map((mid) => ({
            userId: mid,
            role: String(mid) === String(leadId) ? GROUP_MEMBER_ROLES.LEAD : GROUP_MEMBER_ROLES.MEMBER,
          })),
        },
      }
    );
  }

  await group.save();

  const populated = await ThesisGroup.findById(group._id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role");

  res.json({ group: sanitize(populated || group) });
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

  await notifyStaffOfSupervisorUpdate(group, req.programTier, {
    title: "Thesis title submitted for acceptance",
    body: `Supervisor submitted title "${trimmed}" for ${thesisGroupLabel(group)}. Coordinator: Accept or Reject on Thesis.`,
  });

  res.json({ group: await loadSanitizedGroup(group._id) });
}

async function reviewTitleProposal(req, res) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only coordinators or the director can accept or reject a title proposal", 403);
  }

  const { id } = req.params;
  const { decision, note } = req.body || {};
  const normalized = String(decision || "").toLowerCase();
  if (!["accept", "accepted", "reject", "rejected", "unlock", "reset"].includes(normalized)) {
    throw new AppError("decision must be accept, reject, or unlock", 400);
  }

  const accepting = normalized === "accept" || normalized === "accepted";
  const unlocking = normalized === "unlock" || normalized === "reset";
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);

  // Coordinator/Director may unlock an accepted title so supervisor can re-submit
  if (unlocking) {
    group.title = "";
    group.titleProposal = emptyTitleProposal();
    await group.save();
    if (group.supervisorId) {
      await notifyUser(group.supervisorId, {
        type: "system",
        title: "Thesis title unlocked",
        body: "The accepted thesis title was unlocked. Please enter a new student-chosen title.",
        link: `/thesis?groupId=${group._id}`,
        programTier: req.programTier,
      });
    }
    return res.json({ message: "Title unlocked", group: await loadSanitizedGroup(group._id) });
  }

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
      link: `/thesis?groupId=${group._id}`,
      programTier: req.programTier,
    });
  }

  res.json({ group: await loadSanitizedGroup(group._id) });
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

  if (isSupervisor) {
    const chapterLabel = chapter.title || chapter.key || chapterKey;
    await notifyStaffOfSupervisorUpdate(group, req.programTier, {
      title: "Thesis chapter updated by supervisor",
      body: `Supervisor updated "${chapterLabel}" → ${chapter.status} on ${thesisGroupLabel(group)}.`,
    });
  }

  res.json({ group: await loadSanitizedGroup(group._id) });
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

  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("Invalid meeting date", 400);
  }

  group.meetings.push({
    date: new Date(`${dateStr}T12:00:00.000Z`),
    location: location ? String(location).trim() : "",
    agenda: agenda ? String(agenda) : "",
    notes: notes ? String(notes) : "",
    chaptersDiscussed: chapterKeys,
    loggedBy: userId,
  });
  group.markModified("meetings");
  await group.save();

  if (isSupervisor) {
    await notifyStaffOfSupervisorUpdate(group, req.programTier, {
      title: "Thesis meeting logged by supervisor",
      body: `Supervisor logged a meeting (${dateStr}) for ${thesisGroupLabel(group)}${agenda ? `: ${String(agenda).slice(0, 80)}` : ""}.`,
    });
  }

  debugLog("M1", "addMeeting saved", {
    groupId: String(group._id),
    meetingsCount: (group.meetings || []).length,
    date: dateStr,
    role,
  });

  const populated = await ThesisGroup.findById(group._id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");

  res.status(201).json({ message: "Meeting logged", group: sanitize(populated || group) });
}

async function deleteGroup(req, res) {
  const { role } = req.user;
  if (role !== ROLES.RESEARCH_DIRECTOR) throw new AppError("Only the director can delete thesis groups", 403);

  const { id } = req.params;
  const group = await ThesisGroup.findOne(req.tierWhere({ _id: id }));
  if (!group) throw new AppError("Thesis group not found", 404);
  if (group.researchGroupId) {
    await ResearchGroup.deleteOne(req.tierWhere({ _id: group.researchGroupId, kind: GROUP_KINDS.THESIS }));
  }
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
