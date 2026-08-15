const { ThesisGroup, THESIS_STATUSES } = require("../models/ThesisGroup");
const { User, ROLES, USER_STATUSES } = require("../models/User");
const { FACULTIES, DEFAULT_FACULTY, matchFacultyByName, resolveCoordinatorDepartment, recordInCoordinatorFaculty } = require("../utils/facultyMatcher");
function canonicalFaculty(value, fallbackName) {
  const raw = String(value || "").trim();
  if (raw && FACULTIES.includes(raw)) return raw;
  return matchFacultyByName(raw || fallbackName || "") || DEFAULT_FACULTY;
}

function facultiesMatch(a, b, fallbackName) {
  return canonicalFaculty(a, fallbackName) === canonicalFaculty(b, fallbackName);
}

function assertCoordinatorThesisFaculty(req, group) {
  if (req.user?.role !== ROLES.FACULTY_COORDINATOR) return;
  const dept = resolveCoordinatorDepartment(req);
  if (!dept) throw new AppError("Coordinator department not configured", 403);
  const ok = recordInCoordinatorFaculty(
    dept,
    group.department,
    group.faculty
  );
  if (!ok) throw new AppError("Thesis group is outside your faculty", 403);
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
  assertNoDuplicateStudentsWithinGroup,
  assertThesisStudentsNotUsedElsewhere,
  assertThesisTitleNotUsedElsewhere,
  MIN_THESIS_GROUP_STUDENTS,
  assertChapterSequentialOrder,
  allChaptersFinished,
  applyThesisGroupStatusFromChapterProgress,
} = require("../utils/thesisDefaults");

/** Researchers: own groups by supervisor/createdBy (ignore stale programTier). Staff: portal-scoped. */
function findAccessibleThesisGroup(req, id) {
  if (req.user?.role === ROLES.RESEARCHER) {
    const userId = req.user.id;
    return ThesisGroup.findOne({
      _id: id,
      $or: [{ supervisorId: userId }, { createdBy: userId }, { coordinatorId: userId }],
    });
  }
  return ThesisGroup.findOne(req.tierWhere({ _id: id }));
}

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

function isTitleAcceptedForProgress(group) {
  const tp = group.titleProposal || {};
  const status = tp.status || TITLE_PROPOSAL_STATUSES.NONE;
  if (status === TITLE_PROPOSAL_STATUSES.ACCEPTED) return true;
  if (status === TITLE_PROPOSAL_STATUSES.NONE && group.title?.trim()) return true;
  return false;
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
    finalDocument: plain.finalDocument?.path
      ? {
          path: plain.finalDocument.path,
          originalName: plain.finalDocument.originalName || "",
          mimeType: plain.finalDocument.mimeType || "",
          uploadedAt: plain.finalDocument.uploadedAt || null,
          uploadedBy: plain.finalDocument.uploadedBy || null,
        }
      : null,
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
    group.title = "";
    return;
  }
  const now = new Date();
  // Pending until Director OR Faculty Coordinator accepts (one acceptance is enough)
  group.titleProposal = {
    title: trimmed,
    status: TITLE_PROPOSAL_STATUSES.PENDING,
    proposedAt: now,
    proposedBy: userId,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
  // Do not unlock group.title / chapters until accepted
  group.title = "";
}

async function loadSanitizedGroup(id) {
  const populated = await ThesisGroup.findById(id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");
  if (!populated) return null;
  return sanitize(populated);
}

async function notifySupervisorAssignment(group, programTier) {
  if (!group.supervisorId) return;
  try {
    const studentNames = (group.students || []).map((s) => s.fullName).filter(Boolean).join(", ");
    await notifyUser(group.supervisorId, {
      type: "system",
      title: "Thesis supervision assignment",
      body: `You have been assigned to supervise a thesis group${studentNames ? ` (${studentNames})` : ""}. When students choose their thesis title, enter it on the Thesis page.`,
      link: `/thesis?groupId=${group._id}`,
      programTier,
    });
  } catch {
    /* best-effort */
  }
}

async function findSupervisorResearcher(supervisorId, req) {
  if (!supervisorId) return null;
  const filter = {
    _id: supervisorId,
    role: ROLES.RESEARCHER,
    status: USER_STATUSES.ACTIVE,
  };
  const scoped = req?.userWhere ? req.userWhere(filter) : filter;
  const sup = await User.findOne(scoped);
  if (!sup) return null;
  if (req.user?.role === ROLES.FACULTY_COORDINATOR) {
    const dept = resolveCoordinatorDepartment(req);
    if (dept && !recordInCoordinatorFaculty(dept, sup.department)) {
      throw new AppError("Supervisor must be in your faculty", 403);
    }
  }
  return sup;
}

/** Notify Faculty Coordinator + Research Director about thesis title / updates. */
async function notifyCoordinatorThesisUpdate(group, programTier, { title, body, downloadLink, link }) {
  const resolvedLink = link || `/thesis?groupId=${group._id}`;
  const payload = {
    type: "system",
    title: title || "Thesis supervisor update",
    body: body || "The thesis supervisor made an update.",
    link: resolvedLink,
    downloadLink: downloadLink || "",
  };
  try {
    await notifyUsersByRole(ROLES.FACULTY_COORDINATOR, payload, programTier);
  } catch {
    /* best-effort */
  }
  try {
    await notifyUsersByRole(ROLES.RESEARCH_DIRECTOR, payload, programTier);
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

/** After one staff accepts/rejects title, clear sibling pending title-review notifications. */
async function clearTitleReviewNotifications(group) {
  const link = `/thesis?groupId=${group._id}`;
  try {
    const { Notification } = require("../models/Notification");
    await Notification.updateMany(
      {
        link,
        readAt: null,
        title: { $in: ["Thesis title pending review", "Thesis title recorded"] },
      },
      {
        $set: {
          readAt: new Date(),
          body: "Title already decided by another reviewer — no further action needed.",
        },
      }
    );
  } catch {
    /* best-effort */
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
    filter = {
      $or: [{ supervisorId: userId }, { createdBy: userId }, { coordinatorId: userId }],
    };
  }

  let groups = await ThesisGroup.find(
    role === ROLES.RESEARCHER ? filter : req.tierWhere(filter)
  )
    .sort({ createdAt: -1 })
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");

  if (role === ROLES.FACULTY_COORDINATOR) {
    const dept = resolveCoordinatorDepartment(req);
    groups = dept
      ? groups.filter((g) => recordInCoordinatorFaculty(dept, g.department, g.faculty))
      : [];
  }

  // One-time legacy title sync only — do not rewrite students from seed templates on every list
  await Promise.all(groups.map((g) => syncLegacyTitleProposal(g)));

  res.json({ groups: groups.map(sanitize) });
}

async function getGroup(req, res) {
  const { role, id: userId } = req.user;
  const { id } = req.params;
  const group = await findAccessibleThesisGroup(req, id)
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
  assertCoordinatorThesisFaculty(req, group);

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
  } = req.body || {};

  let cleanStudents;
  try {
    cleanStudents = assertMinThesisStudents(students);
    assertNoDuplicateStudentsWithinGroup(cleanStudents);
    await assertThesisStudentsNotUsedElsewhere(ThesisGroup, cleanStudents, {
      tierFilter: req.tierWhere({}),
    });
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }

  let resolvedSupervisorId = null;
  if (supervisorId) {
    const sup = await findSupervisorResearcher(supervisorId, req);
    if (!sup) throw new AppError("Supervisor user not found (active researcher required)", 404);
    resolvedSupervisorId = sup._id;
  }

  const writeTier = req.requireWriteProgramTier(
    req.body?.programTier,
    "programTier (undergraduate or postgraduate)"
  );

  const { cleanDepartment, linkedDepartmentId, facultyValue } = await resolveThesisDepartment(req, {
    departmentId,
    department,
    faculty,
  });
  if (role === ROLES.FACULTY_COORDINATOR) {
    const coordDept = resolveCoordinatorDepartment(req);
    if (coordDept && !recordInCoordinatorFaculty(coordDept, cleanDepartment, facultyValue)) {
      throw new AppError("Thesis group must be within your faculty", 403);
    }
  }
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
    programTier: writeTier,
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
    status: THESIS_STATUSES.PROPOSED,
    chapters: defaultChapters(),
    titleProposal: emptyTitleProposal(),
    createdBy: userId,
    programTier: writeTier,
  });

  const group = await ThesisGroup.create(groupData);
  if (resolvedSupervisorId) {
    await notifySupervisorAssignment(group, writeTier);
  }

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
  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  ensureChapters(group);

  const {
    students,
    supervisorId,
    department,
    departmentId,
    faculty,
    facultyResearchArea,
    meetingSchedule,
  } = req.body || {};

  const prevSupervisorId = group.supervisorId ? String(group.supervisorId) : null;

  if (Array.isArray(students)) {
    try {
      const clean = assertMinThesisStudents(students);
      assertNoDuplicateStudentsWithinGroup(clean);
      await assertThesisStudentsNotUsedElsewhere(ThesisGroup, clean, {
        excludeGroupId: group._id,
        tierFilter: req.tierWhere({}),
      });
      group.students = clean;
    } catch (e) {
      throw new AppError(e.message, e.statusCode || 400);
    }
  }
  if (supervisorId !== undefined) {
    if (supervisorId === null || supervisorId === "") {
      group.supervisorId = null;
      group.supervisorAssignedAt = null;
    } else {
      const sup = await findSupervisorResearcher(supervisorId, req);
      if (!sup) throw new AppError("Supervisor user not found (active researcher required)", 404);
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
    assertCoordinatorThesisFaculty(req, group);
    if (group.researchGroupId && resolved.linkedDepartmentId) {
      await ResearchGroup.updateOne(
        req.tierWhere({ _id: group.researchGroupId }),
        { $set: { departmentId: resolved.linkedDepartmentId } }
      );
    }
  }
  if (facultyResearchArea !== undefined) group.facultyResearchArea = String(facultyResearchArea).trim();
  if (meetingSchedule !== undefined) group.meetingSchedule = String(meetingSchedule).trim();

  const newSupervisorId = group.supervisorId ? String(group.supervisorId) : null;
  if (newSupervisorId && newSupervisorId !== prevSupervisorId) {
    group.supervisorAssignedAt = new Date();
    await notifySupervisorAssignment(group, group.programTier || req.programTier);
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

  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);

  if (!group.supervisorId || String(group.supervisorId) !== String(userId)) {
    throw new AppError("Only the assigned supervisor can enter the student-chosen thesis title", 403);
  }

  if (group.titleProposal?.status === TITLE_PROPOSAL_STATUSES.ACCEPTED) {
    throw new AppError("Title is already accepted. Ask Coordinator/Director to unlock before changing it.", 400);
  }

  try {
    await assertThesisTitleNotUsedElsewhere(ThesisGroup, trimmed, {
      excludeGroupId: group._id,
      tierFilter: req.tierWhere({}),
    });
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }

  applyStudentTitleProposal(group, trimmed, userId);
  await group.save();

  await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
    title: "Thesis title pending review",
    body: `Supervisor proposed thesis title "${trimmed}" for ${thesisGroupLabel(group)}. Director or Faculty Coordinator — accept or reject (one decision is enough).`,
    link: `/thesis?groupId=${group._id}`,
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
  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  // Coordinator/Director may unlock an accepted title so supervisor can re-submit
  if (unlocking) {
    group.title = "";
    group.titleProposal = emptyTitleProposal();
    await group.save();
    if (group.supervisorId) {
      try {
        await notifyUser(group.supervisorId, {
          type: "system",
          title: "Thesis title unlocked",
          body: "The accepted thesis title was unlocked. Please enter a new student-chosen title.",
          link: `/thesis?groupId=${group._id}`,
          programTier: group.programTier || req.programTier,
        });
      } catch {
        /* best-effort */
      }
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
    try {
      await assertThesisTitleNotUsedElsewhere(ThesisGroup, group.titleProposal.title, {
        excludeGroupId: group._id,
        tierFilter: req.tierWhere({}),
      });
    } catch (e) {
      throw new AppError(e.message, e.statusCode || 400);
    }
    group.title = group.titleProposal.title;
    if (group.status === THESIS_STATUSES.PROPOSED) {
      group.status = THESIS_STATUSES.IN_PROGRESS;
    }
  }

  await group.save();

  await clearTitleReviewNotifications(group);

  if (group.supervisorId) {
    try {
      await notifyUser(group.supervisorId, {
        type: "system",
        title: accepting ? "Thesis title accepted" : "Thesis title rejected",
        body: accepting
          ? `The thesis title "${group.titleProposal.title}" has been accepted. You may begin supervision.`
          : `The proposed thesis title was rejected.${note ? ` Note: ${note}` : ""}`,
        link: `/thesis?groupId=${group._id}`,
        programTier: group.programTier || req.programTier,
      });
    } catch {
      /* best-effort */
    }
  }

  // Inform the other staff role so they know the title was already decided
  const otherRoles =
    role === ROLES.RESEARCH_DIRECTOR
      ? [ROLES.FACULTY_COORDINATOR]
      : [ROLES.RESEARCH_DIRECTOR];
  for (const r of otherRoles) {
    try {
      await notifyUsersByRole(
        r,
        {
          type: "system",
          title: accepting ? "Thesis title already accepted" : "Thesis title already rejected",
          body: accepting
            ? `Title "${group.titleProposal.title}" was accepted — no further accept needed.`
            : `Title proposal was rejected — no further action needed.`,
          link: `/thesis?groupId=${group._id}`,
        },
        group.programTier || req.programTier
      );
    } catch {
      /* best-effort */
    }
  }

  res.json({ group: await loadSanitizedGroup(group._id) });
}

async function updateChapter(req, res) {
  const { role, id: userId } = req.user;
  const { id, chapterKey } = req.params;
  const { status, notes } = req.body || {};

  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  ensureChapters(group);

  if (!isTitleAcceptedForProgress(group)) {
    throw new AppError("Accept the thesis title before updating chapter progress", 400);
  }

  const isSupervisor = group.supervisorId && String(group.supervisorId) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) {
    throw new AppError("Only supervisor, coordinator, or director can update chapter progress", 403);
  }

  const chapter = group.chapters.find((c) => c.key === chapterKey);
  if (!chapter) throw new AppError("Chapter not found", 404);

  if (status !== undefined) {
    if (!Object.values(CHAPTER_STATUSES).includes(status)) throw new AppError("Invalid chapter status", 400);
    if (status !== chapter.status) {
      try {
        assertChapterSequentialOrder(group.chapters, chapterKey, status);
      } catch (e) {
        throw new AppError(e.message, e.statusCode || 400);
      }
    }
    chapter.status = status;
  }
  if (notes !== undefined) chapter.notes = String(notes);
  chapter.updatedAt = new Date();
  chapter.updatedBy = userId;
  group.markModified("chapters");
  const promotedStatus = applyThesisGroupStatusFromChapterProgress(group, THESIS_STATUSES);
  await group.save();

  if (isSupervisor) {
    const chapterLabel = chapter.title || chapter.key || chapterKey;
    await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
      title: "Thesis chapter updated",
      body: `Supervisor updated "${chapterLabel}" → ${chapter.status.replace(/_/g, " ")} on ${thesisGroupLabel(group)}.`,
      link: `/thesis?groupId=${group._id}`,
    });
    if (promotedStatus === THESIS_STATUSES.COMPLETED) {
      await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
        title: "All thesis chapters complete",
        body: `${thesisGroupLabel(group)} — all chapters are finished. Thesis status is now Completed. Record defense when the oral exam is done.`,
        link: `/thesis?groupId=${group._id}`,
      });
      if (group.supervisorId) {
        await notifyUser(group.supervisorId, {
          type: "system",
          title: "All thesis chapters complete",
          body: `All chapters are finished for ${thesisGroupLabel(group)}. Thesis status: Completed.`,
          link: `/thesis?groupId=${group._id}`,
          programTier: group.programTier || req.programTier,
        });
      }
    }
  }

  res.json({
    group: await loadSanitizedGroup(group._id),
    statusPromoted: promotedStatus || undefined,
  });
}

async function markDefended(req, res) {
  const { role } = req.user;
  if (![ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role)) {
    throw new AppError("Only the coordinator or director can record thesis defense", 403);
  }

  const { id } = req.params;
  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  ensureChapters(group);

  if (!allChaptersFinished(group.chapters)) {
    throw new AppError("All chapters must be completed before recording defense", 400);
  }
  if (group.status !== THESIS_STATUSES.COMPLETED) {
    throw new AppError("Thesis must be Completed (all chapters finished) before recording defense", 400);
  }

  group.status = THESIS_STATUSES.DEFENDED;
  await group.save();

  await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
    title: "Thesis defense recorded",
    body: `${thesisGroupLabel(group)} has been marked Defended.`,
    link: `/thesis?groupId=${group._id}`,
  });

  if (group.supervisorId) {
    await notifyUser(group.supervisorId, {
      type: "system",
      title: "Thesis defense recorded",
      body: `${thesisGroupLabel(group)} has been marked Defended in the system.`,
      link: `/thesis?groupId=${group._id}`,
      programTier: group.programTier || req.programTier,
    });
  }

  res.json({ group: await loadSanitizedGroup(group._id), message: "Thesis marked as defended" });
}

async function addMeeting(req, res) {
  const { role, id: userId } = req.user;
  const { id } = req.params;
  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  ensureChapters(group);

  if (!isTitleAcceptedForProgress(group)) {
    throw new AppError("Accept the thesis title before logging supervision meetings", 400);
  }

  const isSupervisor = group.supervisorId && String(group.supervisorId) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) throw new AppError("Only supervisor, coordinator, or director can log meetings", 403);

  const { date, location, agenda, notes, chaptersDiscussed } = req.body || {};
  if (!date) throw new AppError("date is required", 400);

  if (group.status === THESIS_STATUSES.DEFENDED) {
    throw new AppError("Cannot log supervision meetings after thesis defense is recorded", 400);
  }

  const validKeys = new Set((group.chapters || []).map((c) => c.key));
  const chapterKeys = Array.isArray(chaptersDiscussed)
    ? chaptersDiscussed.map((k) => String(k).trim()).filter((k) => validKeys.has(k))
    : [];

  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("Invalid meeting date", 400);
  }

  const meetingDay = new Date(`${dateStr}T23:59:59.999Z`);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  if (meetingDay.getTime() > todayEnd.getTime()) {
    throw new AppError("Meeting date cannot be in the future", 400);
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
    await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
      title: "Thesis meeting logged by supervisor",
      body: `Supervisor logged a meeting (${dateStr}) for ${thesisGroupLabel(group)}${agenda ? `: ${String(agenda).slice(0, 80)}` : ""}.`,
    });
  }

  const populated = await ThesisGroup.findById(group._id)
    .populate("researchGroupId", "name departmentId members createdAt")
    .populate("supervisorId", "fullName email department")
    .populate("coordinatorId", "fullName email")
    .populate("createdBy", "fullName email role")
    .populate("meetings.loggedBy", "fullName email");

  res.status(201).json({ message: "Meeting logged", group: sanitize(populated || group) });
}

/**
 * Supervisor uploads final thesis (PDF / DOC / DOCX) when the work is finished.
 * Optionally marks group status completed.
 */
async function uploadFinalDocument(req, res) {
  const { role, id: userId } = req.user;
  const { id } = req.params;
  const group = await findAccessibleThesisGroup(req, id);
  if (!group) throw new AppError("Thesis group not found", 404);
  assertCoordinatorThesisFaculty(req, group);

  const supervisorRef = group.supervisorId?._id || group.supervisorId;
  const isSupervisor = supervisorRef && String(supervisorRef) === String(userId);
  const isStaff = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR].includes(role);
  if (!isSupervisor && !isStaff) {
    throw new AppError("Only the supervisor (or coordinator/director) can upload the final thesis", 403);
  }

  if (!String(group.title || "").trim() || !isTitleAcceptedForProgress(group)) {
    throw new AppError("Accepted thesis title is required before uploading the final document", 400);
  }

  if (!req.file) throw new AppError("PDF or Word file is required", 400);

  const markComplete =
    String(req.body?.markCompleted || "").toLowerCase() === "true" || req.body?.markCompleted === true;

  group.finalDocument = {
    path: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname || req.file.filename,
    mimeType: req.file.mimetype || "",
    uploadedAt: new Date(),
    uploadedBy: userId,
  };

  if (markComplete) {
    if (!allChaptersFinished(group.chapters)) {
      throw new AppError("All chapters must be finished before marking the thesis completed", 400);
    }
    if (group.status !== THESIS_STATUSES.DEFENDED && group.status !== THESIS_STATUSES.COMPLETED) {
      group.status = THESIS_STATUSES.COMPLETED;
    }
  } else if (
    group.status === THESIS_STATUSES.IN_PROGRESS ||
    group.status === THESIS_STATUSES.PROPOSED
  ) {
    group.status = THESIS_STATUSES.SUBMITTED;
  }

  await group.save();

  const fileLabel = group.finalDocument.originalName || "thesis document";
  await notifyCoordinatorThesisUpdate(group, group.programTier || req.programTier, {
    title: "Final thesis document uploaded",
    body: `Supervisor uploaded "${fileLabel}" for ${thesisGroupLabel(group)}${
      group.status === THESIS_STATUSES.COMPLETED ? " (marked completed)." : "."
    }`,
    downloadLink: group.finalDocument.path,
  });

  res.json({
    message: "Final thesis document uploaded",
    group: await loadSanitizedGroup(group._id),
  });
}

async function deleteGroup(req, res) {
  const { role } = req.user;
  if (role !== ROLES.RESEARCH_DIRECTOR) throw new AppError("Only the director can delete thesis groups", 403);

  const { id } = req.params;
  const group = await findAccessibleThesisGroup(req, id);
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
  markDefended,
  addMeeting,
  uploadFinalDocument,
  deleteGroup,
  THESIS_STATUSES,
};
