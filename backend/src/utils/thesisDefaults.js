const MIN_THESIS_GROUP_STUDENTS = 4;

const CHAPTER_STATUSES = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REVIEWED: "reviewed",
});

const TITLE_PROPOSAL_STATUSES = Object.freeze({
  NONE: "none",
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
});

const DEFAULT_THESIS_CHAPTERS = Object.freeze([
  { key: "ch1", title: "Chapter 1: Introduction" },
  { key: "ch2", title: "Chapter 2: Literature Review" },
  { key: "ch3", title: "Chapter 3: Methodology" },
  { key: "ch4", title: "Chapter 4: Results / Findings" },
  { key: "ch5", title: "Chapter 5: Discussion" },
  { key: "ch6", title: "Chapter 6: Conclusion & Recommendations" },
]);

function defaultChapters() {
  return DEFAULT_THESIS_CHAPTERS.map((c) => ({
    key: c.key,
    title: c.title,
    status: CHAPTER_STATUSES.PENDING,
    notes: "",
    updatedAt: null,
    updatedBy: null,
  }));
}

function emptyTitleProposal() {
  return {
    title: "",
    status: TITLE_PROPOSAL_STATUSES.NONE,
    proposedAt: null,
    proposedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
}

function buildActivityTimeline(group) {
  const items = [];

  if (group.createdAt) {
    items.push({
      type: "group_created",
      at: group.createdAt,
      label: "Thesis group created",
      detail: group.title || group.titleProposal?.title || "Untitled",
    });
  }

  if (group.supervisorId && group.supervisorAssignedAt) {
    items.push({
      type: "supervisor_assigned",
      at: group.supervisorAssignedAt,
      label: "Supervisor assigned",
      detail: "",
    });
  }

  const proposal = group.titleProposal;
  if (proposal?.proposedAt && proposal.status === TITLE_PROPOSAL_STATUSES.PENDING) {
    items.push({
      type: "title_proposed",
      at: proposal.proposedAt,
      label: "Supervisor recorded student thesis title",
      detail: proposal.title || "",
    });
  }

  if (proposal?.reviewedAt && proposal.status === TITLE_PROPOSAL_STATUSES.ACCEPTED) {
    items.push({
      type: "title_accepted",
      at: proposal.reviewedAt,
      label: "Thesis title accepted",
      detail: proposal.title || group.title || "",
    });
  }

  if (proposal?.reviewedAt && proposal.status === TITLE_PROPOSAL_STATUSES.REJECTED) {
    items.push({
      type: "title_rejected",
      at: proposal.reviewedAt,
      label: "Thesis title rejected",
      detail: proposal.reviewNote || proposal.title || "",
    });
  }

  for (const ch of group.chapters || []) {
    if (ch.updatedAt && ch.status !== CHAPTER_STATUSES.PENDING) {
      items.push({
        type: "chapter_update",
        at: ch.updatedAt,
        label: `${ch.title} — ${ch.status.replace(/_/g, " ")}`,
        detail: ch.notes || "",
        chapterKey: ch.key,
      });
    }
  }

  for (const m of group.meetings || []) {
    const at = m.createdAt || m.date;
    if (!at) continue;
    const chapterLabels = (m.chaptersDiscussed || [])
      .map((key) => (group.chapters || []).find((c) => c.key === key)?.title || key)
      .filter(Boolean);
    items.push({
      type: "meeting",
      at,
      label: "Meeting logged",
      detail: [m.agenda, m.location, chapterLabels.length ? `Chapters: ${chapterLabels.join(", ")}` : ""]
        .filter(Boolean)
        .join(" • "),
      meetingDate: m.date,
    });
  }

  if (group.finalDocument?.path && group.finalDocument?.uploadedAt) {
    items.push({
      type: "final_document",
      at: group.finalDocument.uploadedAt,
      label: "Final thesis document uploaded",
      detail: group.finalDocument.originalName || "PDF / Word file",
    });
  }

  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function normalizeStudentRows(students) {
  if (!Array.isArray(students)) return [];
  return students
    .map((s) => ({
      fullName: String(s.fullName || "").trim(),
      studentId: String(s.studentId || "").trim(),
      email: String(s.email || "").trim().toLowerCase(),
    }))
    .filter((s) => s.fullName);
}

function assertMinThesisStudents(students) {
  const clean = normalizeStudentRows(students);
  if (clean.length < MIN_THESIS_GROUP_STUDENTS) {
    const err = new Error(`Each thesis group requires at least ${MIN_THESIS_GROUP_STUDENTS} students`);
    err.statusCode = 400;
    throw err;
  }
  return clean;
}

function assertNoDuplicateStudentsWithinGroup(students) {
  const clean = normalizeStudentRows(students);
  const emails = clean.map((s) => s.email).filter(Boolean);
  const ids = clean.map((s) => s.studentId).filter(Boolean);
  const dupEmail = emails.find((e, i) => emails.indexOf(e) !== i);
  if (dupEmail) {
    const err = new Error(`Duplicate student email in this group: ${dupEmail}`);
    err.statusCode = 400;
    throw err;
  }
  const dupId = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupId) {
    const err = new Error(`Duplicate student ID in this group: ${dupId}`);
    err.statusCode = 400;
    throw err;
  }
  return clean;
}

function normalizedTitleKey(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function collectThesisTitles(group) {
  const keys = new Set();
  for (const raw of [group.title, group.titleProposal?.title]) {
    const key = normalizedTitleKey(raw);
    if (key) keys.add(key);
  }
  return keys;
}

async function assertThesisStudentsNotUsedElsewhere(ThesisGroup, students, { excludeGroupId, tierFilter }) {
  const clean = normalizeStudentRows(students);
  const filter = { ...tierFilter };
  if (excludeGroupId) filter._id = { $ne: excludeGroupId };

  const emails = [...new Set(clean.map((s) => s.email).filter(Boolean))];
  const ids = [...new Set(clean.map((s) => s.studentId).filter(Boolean))];
  if (!emails.length && !ids.length) return clean;

  const or = [];
  if (emails.length) or.push({ "students.email": { $in: emails } });
  if (ids.length) or.push({ "students.studentId": { $in: ids } });
  const existing = await ThesisGroup.find({ ...filter, $or: or }).select("students title titleProposal");

  for (const g of existing) {
    for (const s of clean) {
      if (s.email && (g.students || []).some((x) => String(x.email || "").trim().toLowerCase() === s.email)) {
        const err = new Error(`Student email already used in another thesis group: ${s.email}`);
        err.statusCode = 400;
        throw err;
      }
      if (s.studentId && (g.students || []).some((x) => String(x.studentId || "").trim() === s.studentId)) {
        const err = new Error(`Student ID already used in another thesis group: ${s.studentId}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }
  return clean;
}

async function assertThesisTitleNotUsedElsewhere(ThesisGroup, title, { excludeGroupId, tierFilter }) {
  const key = normalizedTitleKey(title);
  if (!key) return;

  const filter = { ...tierFilter };
  if (excludeGroupId) filter._id = { $ne: excludeGroupId };

  const groups = await ThesisGroup.find(filter).select("title titleProposal");
  for (const g of groups) {
    for (const existing of collectThesisTitles(g)) {
      if (existing === key) {
        const err = new Error("This thesis title is already used by another group");
        err.statusCode = 400;
        throw err;
      }
    }
  }
}

module.exports = {
  MIN_THESIS_GROUP_STUDENTS,
  CHAPTER_STATUSES,
  TITLE_PROPOSAL_STATUSES,
  DEFAULT_THESIS_CHAPTERS,
  defaultChapters,
  emptyTitleProposal,
  buildActivityTimeline,
  normalizeStudentRows,
  assertMinThesisStudents,
  assertNoDuplicateStudentsWithinGroup,
  assertThesisStudentsNotUsedElsewhere,
  assertThesisTitleNotUsedElsewhere,
  normalizedTitleKey,
};
