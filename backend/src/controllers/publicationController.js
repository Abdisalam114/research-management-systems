const {
  Publication,
  PUBLICATION_STATUSES,
  PUBLICATION_STATUS_LABELS,
  PUBLICATION_TYPES,
  LEGACY_PUBLICATION_TYPE_MAP,
  WORKFLOW_STAGES,
  JOURNAL_DECISIONS,
  JOURNAL_DECISION_LABELS,
} = require("../models/Publication");
const { Project } = require("../models/Project");
const { User } = require("../models/User");
const { AppError } = require("../utils/AppError");
const { recordAudit } = require("../utils/audit");
const {
  resolveOwnedProjectId,
  requireOwnedProjectId,
  validateProjectQuery,
  assertSinglePublicationPerProject,
} = require("../utils/projectScopedRecords");
const {
  resolveWorkflowStage,
  workflowStageLabel,
  countByWorkflowStage,
  STAGE_ORDER,
} = require("../utils/publicationWorkflow");
const { resolvePrincipalInvestigatorName } = require("../utils/projectPrincipalInvestigator");
const { userDisplayName } = require("../utils/userDisplay");
const {
  afterPublicationSubmitted,
  afterPublicationDecision,
  afterPublicationComment,
  notifyPublicationEvent,
  buildPublicationSubmitNotificationBody,
  loadPublicationForNotification,
} = require("../utils/publicationSideEffects");
const { coordinatorMatchesResearcherDept } = require("../utils/facultyMatcher");

const EDITABLE_STATUSES = [
  PUBLICATION_STATUSES.DRAFT,
  PUBLICATION_STATUSES.REJECTED,
  PUBLICATION_STATUSES.REVISION_REQUESTED,
];

function pushReviewerComment(pub, req, comment, decision = null) {
  const text = String(comment || "").trim();
  if (!text) throw new AppError("comment is required", 400);
  pub.reviewerComments = pub.reviewerComments || [];
  const entry = {
    authorId: req.user.id,
    authorName: req.user.fullName || req.currentUser?.fullName || "",
    authorRole: req.user.role,
    comment: text,
    at: new Date(),
  };
  if (decision) entry.decision = decision;
  pub.reviewerComments.push(entry);
}
async function authorsFromProject(projectId, researcherId) {
  const project = await Project.findById(projectId)
    .populate("researcherId", "fullName name email")
    .populate("teamMembers.userId", "fullName name");
  if (!project) return [];

  const names = [];
  const pi =
    resolvePrincipalInvestigatorName(project) ||
    userDisplayName(project.researcherId) ||
    "";
  if (pi && pi !== "—") names.push(pi);

  for (const m of project.teamMembers || []) {
    const n =
      (m.userId && userDisplayName(m.userId)) ||
      (m.name && String(m.name).trim()) ||
      "";
    if (n && n !== "—" && !names.some((x) => x.toLowerCase() === n.toLowerCase())) {
      names.push(n);
    }
  }

  if (!names.length && researcherId) {
    const u = await User.findById(researcherId).select("fullName name");
    const self = userDisplayName(u);
    if (self && self !== "—") names.push(self);
  }
  return names;
}

function looksLikeFundingAwardTitle(title) {
  const t = String(title || "").trim();
  if (!t) return false;
  return /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(t);
}

async function projectDefaults(projectId, researcherId) {
  const project = await Project.findById(projectId).select("title");
  const authors = await authorsFromProject(projectId, researcherId);
  const rawTitle = project?.title ? String(project.title).trim() : "";
  // Do not invent publication titles from funding-call / grant names
  return {
    title: looksLikeFundingAwardTitle(rawTitle) ? "" : rawTitle,
    authors,
  };
}

function sanitizePublication(p) {
  const workflowStage = resolveWorkflowStage(p);
  return {
    id: p._id,
    title: p.title,
    type: p.type,
    year: p.year,
    venue: p.venue,
    doi: p.doi,
    orcid: p.orcid,
    url: p.url,
    authors: p.authors,
    citationCount: p.citationCount,
    communityImpact: p.communityImpact || "",
    status: p.status,
    statusLabel: PUBLICATION_STATUS_LABELS[p.status] || p.status,
    workflowStage,
    workflowStageLabel: workflowStageLabel(workflowStage),
    researcherId: p.researcherId,
    projectId: p.projectId?._id ? String(p.projectId._id) : p.projectId || null,
    projectTitle:
      p.projectId && typeof p.projectId === "object" && p.projectId.title ? p.projectId.title : null,
    validatedBy: p.validatedBy,
    validatedAt: p.validatedAt,
    validationComment: p.validationComment,
    journalDecision: p.journalDecision || JOURNAL_DECISIONS.PENDING,
    journalDecisionLabel:
      JOURNAL_DECISION_LABELS[p.journalDecision] || JOURNAL_DECISION_LABELS.pending,
    journalDecisionNote: p.journalDecisionNote || "",
    journalDecisionAt: p.journalDecisionAt || null,
    journalDecisionBy: p.journalDecisionBy || null,
    reviewerComments: (p.reviewerComments || []).map((c) => ({
      id: c._id,
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole,
      comment: c.comment,
      decision: c.decision,
      decisionLabel: c.decision ? JOURNAL_DECISION_LABELS[c.decision] || c.decision : null,
      at: c.at,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listPublications(req, res) {
  const { role } = req.user;
  const filter = {};

  // Researcher: NEVER see another person's outputs
  if (role === "researcher") {
    filter.researcherId = req.user.id;
    if (req.query.projectId) {
      await validateProjectQuery(req, req.query.projectId, { ownerOnly: true });
      filter.projectId = req.query.projectId;
    } else {
      const myProjects = await Project.find(req.tierWhere({ researcherId: req.user.id })).select("_id");
      filter.projectId = { $in: myProjects.map((p) => p._id) };
    }
  } else if (req.query.projectId) {
    await validateProjectQuery(req, req.query.projectId, { ownerOnly: false });
    filter.projectId = req.query.projectId;
  } else {
    // Staff: Publications & Outputs only from Projects (no orphan silo)
    filter.projectId = { $ne: null, $exists: true };
  }

  let pubs = await Publication.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("researcherId", "fullName department")
    .populate("projectId", "title status");

  // Defense in depth — strip any non-owned rows for researchers
  if (role === "researcher") {
    const uid = String(req.user.id);
    pubs = pubs.filter((p) => String(p.researcherId?._id || p.researcherId) === uid);
  }
res.json({ publications: pubs.map(sanitizePublication) });
}

async function getFacultyWorkflow(req, res) {
  const { role, department } = req.user;
  if (!["faculty_coordinator", "research_director", "researcher"].includes(role)) {
    throw new AppError("Forbidden", 403);
  }

  const dept = (department || "").trim();
  const projectIdQuery = req.query.projectId ? String(req.query.projectId) : "";
  const filter = { status: { $ne: PUBLICATION_STATUSES.DRAFT } };

  // Researcher: only own outputs (never other people's)
  if (role === "researcher") {
    filter.researcherId = req.user.id;
  }

  // Optional project filter; otherwise show all project-linked outputs (as before)
  if (projectIdQuery) {
    await validateProjectQuery(req, projectIdQuery, { ownerOnly: role === "researcher" });
    filter.projectId = projectIdQuery;
  } else {
    filter.projectId = { $ne: null, $exists: true };
  }

  let pubs = await Publication.find(req.tierWhere(filter))
    .sort({ updatedAt: -1 })
    .populate("researcherId", "fullName department")
    .populate("projectId", "title status");

  if (role === "researcher") {
    const myProjects = await Project.find(req.tierWhere({ researcherId: req.user.id })).select("_id");
    const myIds = new Set(myProjects.map((p) => String(p._id)));
    const uid = String(req.user.id);
    pubs = pubs.filter((p) => {
      const ownerOk = String(p.researcherId?._id || p.researcherId) === uid;
      const projectOk = p.projectId && myIds.has(String(p.projectId._id || p.projectId));
      return ownerOk && projectOk;
    });
  } else if (role === "faculty_coordinator" && dept) {
    pubs = pubs.filter(
      (p) => p.researcherId && coordinatorMatchesResearcherDept(dept, p.researcherId.department)
    );
  }
const sanitized = pubs.map(sanitizePublication);
  const byStage = {};
  STAGE_ORDER.forEach((s) => {
    byStage[s] = sanitized.filter((p) => p.workflowStage === s);
  });

  const deptLabel =
    role === "research_director" ? "All faculties" : role === "researcher" ? "My outputs" : dept || "Faculty";

  let projectFilter = null;
  if (projectIdQuery) {
    const proj = await Project.findById(projectIdQuery).select("title status");
    if (proj) projectFilter = { id: String(proj._id), title: proj.title, status: proj.status };
  }

  res.json({
    department: deptLabel,
    projectFilter,
    generatedAt: new Date().toISOString(),
    counts: countByWorkflowStage(pubs),
    stages: STAGE_ORDER.map((id) => ({
      id,
      label: workflowStageLabel(id),
      count: byStage[id]?.length || 0,
      items: byStage[id] || [],
    })),
  });
}

async function getPublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);

  const isOwner = String(pub.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ publication: sanitizePublication(pub) });
}

function normalizeType(value) {
  if (!value) return undefined;
  const mapped = LEGACY_PUBLICATION_TYPE_MAP[value] || value;
  if (!Object.values(PUBLICATION_TYPES).includes(mapped)) {
    throw new AppError(
      `Invalid publication type. Allowed: ${Object.values(PUBLICATION_TYPES).join(", ")}`,
      400
    );
  }
  return mapped;
}

async function createPublication(req, res) {
  const { title, type, year, venue, doi, orcid, url, authors, communityImpact, projectId, submit } = req.body || {};
  if (!title && !projectId) throw new AppError("title is required", 400);

  const normalizedType = normalizeType(type);
  const impactText = communityImpact ? String(communityImpact).trim() : "";
  if (normalizedType === PUBLICATION_TYPES.COMMUNITY_IMPACT && !impactText) {
    throw new AppError("communityImpact description is required for community research impact outputs", 400);
  }

  const linkedProjectId = await requireOwnedProjectId(req, projectId, req.user.id);
  await assertSinglePublicationPerProject(req, linkedProjectId);
  const defaults = await projectDefaults(linkedProjectId, req.user.id);

  let authorList = Array.isArray(authors) ? authors.map((a) => String(a).trim()).filter(Boolean) : [];
  if (!authorList.length) authorList = defaults.authors;

  const finalTitle = String(title || "").trim() || defaults.title;
  if (!finalTitle) throw new AppError("title is required", 400);
const pub = await Publication.create(req.tierAssign({
    title: finalTitle,
    type: normalizedType,
    year: year || new Date().getFullYear(),
    venue: venue ? String(venue).trim() : "",
    doi: doi ? String(doi).trim() : "",
    orcid: orcid ? String(orcid).trim() : "",
    url: url ? String(url).trim() : "",
    authors: authorList,
    communityImpact: impactText,
    researcherId: req.user.id,
    projectId: linkedProjectId,
    status: PUBLICATION_STATUSES.DRAFT,
  }));

  const wantSubmit = submit === true || submit === "true";
  let sideEffects = null;
  if (wantSubmit) {
    pub.status = PUBLICATION_STATUSES.SUBMITTED;
    pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
    await pub.save();
    sideEffects = await afterPublicationSubmitted(req, pub);
  }

  res.status(201).json({
    message: wantSubmit ? "Publication created and submitted" : "Publication created",
    publication: sanitizePublication(pub),
    sideEffects,
  });
}

async function updatePublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (!EDITABLE_STATUSES.includes(pub.status)) {
    throw new AppError("Only draft, rejected, or revise&resubmit publications can be edited", 400);
  }

  const { title, type, year, venue, doi, orcid, url, authors, citationCount, communityImpact, projectId } = req.body || {};
  if (title !== undefined) pub.title = String(title).trim();
  if (type !== undefined) pub.type = normalizeType(type);
  if (year !== undefined) pub.year = year;
  if (venue !== undefined) pub.venue = String(venue).trim();
  if (doi !== undefined) pub.doi = String(doi).trim();
  if (orcid !== undefined) pub.orcid = String(orcid).trim();
  if (url !== undefined) pub.url = String(url).trim();
  if (citationCount !== undefined) pub.citationCount = citationCount;
  if (communityImpact !== undefined) pub.communityImpact = String(communityImpact).trim();
  if (authors !== undefined) {
    pub.authors = Array.isArray(authors) ? authors.map((a) => String(a).trim()).filter(Boolean) : [];
  }
  if (projectId !== undefined) {
    if (!projectId) {
      throw new AppError("projectId cannot be removed — link a research project", 400);
    }
    const nextProjectId = await requireOwnedProjectId(req, projectId, req.user.id);
    if (String(nextProjectId) !== String(pub.projectId)) {
      await assertSinglePublicationPerProject(req, nextProjectId, { excludePublicationId: pub._id });
    }
    pub.projectId = nextProjectId;
  }

  // Editing a rejected / revise output returns it to draft so it can be resubmitted
  if (
    pub.status === PUBLICATION_STATUSES.REJECTED ||
    pub.status === PUBLICATION_STATUSES.REVISION_REQUESTED
  ) {
    pub.status = PUBLICATION_STATUSES.DRAFT;
    pub.validatedBy = undefined;
    pub.validatedAt = undefined;
    pub.journalDecision = JOURNAL_DECISIONS.PENDING;
    pub.validationComment = "";
    pub.workflowStage = null;
  }

  await pub.save();
  res.json({ publication: sanitizePublication(pub) });
}

async function submitPublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (!EDITABLE_STATUSES.includes(pub.status)) {
    throw new AppError("Only draft, rejected, or revise&resubmit publications can be submitted", 400);
  }
  if (!pub.projectId) {
    throw new AppError("Link this output to a research project before submitting", 400);
  }

  // Auto-complete related fields from the linked project before submit
  if (!pub.authors?.length) {
    pub.authors = await authorsFromProject(pub.projectId, req.user.id);
  }
  if (!(pub.title || "").trim()) {
    const project = await Project.findById(pub.projectId).select("title");
    const t = project?.title ? String(project.title).trim() : "";
    if (t && !looksLikeFundingAwardTitle(t)) pub.title = t;
  }
  if (!(pub.title || "").trim()) {
    throw new AppError("Publication title is required before submit — enter a real research output title (not the funding-call name)", 400);
  }
  if (looksLikeFundingAwardTitle(pub.title)) {
    throw new AppError("Publication title cannot be a funding-call / grant name — enter the real research output title", 400);
  }

  pub.status = PUBLICATION_STATUSES.SUBMITTED;
  pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
  pub.journalDecision = JOURNAL_DECISIONS.PENDING;
  pub.validatedBy = undefined;
  pub.validatedAt = undefined;
  await pub.save();

  const sideEffects = await afterPublicationSubmitted(req, pub);

  let projectCompletion = null;
  if (pub.projectId) {
    try {
      const { maybeCompleteFundedProject } = require("../utils/maybeCompleteFundedProject");
      projectCompletion = await maybeCompleteFundedProject(pub.projectId);
    } catch { /* best-effort */ }
  }

  res.json({
    message: "Publication submitted",
    publication: sanitizePublication(pub),
    sideEffects,
    projectCompletion,
  });
}

async function validatePublication(req, res) {
  const { id } = req.params;
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required (reviewer feedback)", 400);

  // International-style decisions: accept | reject | revise
  // Legacy aliases: validated → accept, rejected → reject
  const normalized =
    decision === "validated" || decision === "accept"
      ? "accept"
      : decision === "rejected" || decision === "reject"
        ? "reject"
        : decision === "revise" || decision === "revision_requested"
          ? "revise"
          : null;
  if (!normalized) {
    throw new AppError("Invalid decision — use accept, reject, or revise", 400);
  }

  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);
  if (
    ![PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.REVISION_REQUESTED].includes(pub.status)
  ) {
    throw new AppError("Publication is not ready for a review decision", 400);
  }

  const journalDecision =
    normalized === "accept"
      ? JOURNAL_DECISIONS.ACCEPT
      : normalized === "reject"
        ? JOURNAL_DECISIONS.REJECT
        : JOURNAL_DECISIONS.REVISE;

  pushReviewerComment(pub, req, comment, journalDecision);

  pub.journalDecision = journalDecision;
  pub.journalDecisionNote = String(comment).trim();
  pub.journalDecisionAt = new Date();
  pub.journalDecisionBy = req.user.id;
  pub.validatedBy = req.user.id;
  pub.validatedAt = new Date();
  pub.validationComment = String(comment).trim();

  if (normalized === "accept") {
    pub.status = PUBLICATION_STATUSES.VALIDATED;
    pub.workflowStage = WORKFLOW_STAGES.IN_PROCESS;
  } else if (normalized === "reject") {
    pub.status = PUBLICATION_STATUSES.REJECTED;
    pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
  } else {
    pub.status = PUBLICATION_STATUSES.REVISION_REQUESTED;
    pub.workflowStage = WORKFLOW_STAGES.IN_PROCESS;
  }

  await pub.save();

  let projectCompletion = null;
  if (normalized === "accept" && pub.projectId) {
    try {
      const { maybeCompleteFundedProject } = require("../utils/maybeCompleteFundedProject");
      projectCompletion = await maybeCompleteFundedProject(pub.projectId);
    } catch {
      /* best-effort */
    }
  }

  const decisionLabel =
    normalized === "accept" ? "accepted" : normalized === "reject" ? "rejected" : "sent back for revision";

  await afterPublicationDecision(req, pub, { decisionLabel, comment });

  res.json({
    message: `Decision saved: ${decisionLabel}`,
    publication: sanitizePublication(pub),
    projectCompletion,
  });
}

/** Researcher or staff adds a review comment (no status change). */
async function addPublicationComment(req, res) {
  const { id } = req.params;
  const { comment } = req.body || {};
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);

  const role = req.user.role;
  const isOwner = String(pub.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "leadership"].includes(role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);
  if (pub.status === PUBLICATION_STATUSES.DRAFT && !isOwner) {
    throw new AppError("Cannot comment on a draft you do not own", 400);
  }

  pushReviewerComment(pub, req, comment, null);
  await pub.save();

  await afterPublicationComment(req, pub, comment);

  res.json({ message: "Comment added", publication: sanitizePublication(pub) });
}

/**
 * Record external journal / venue decision (international accept/reject/revise).
 * Researcher (owner) or Director/Coordinator may set this after submission.
 */
async function setJournalDecision(req, res) {
  const { id } = req.params;
  const { decision, note } = req.body || {};
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);

  const role = req.user.role;
  const isOwner = String(pub.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);
  if (pub.status === PUBLICATION_STATUSES.DRAFT) {
    throw new AppError("Submit the publication before recording a journal decision", 400);
  }

  const normalized =
    decision === "accept" || decision === "validated"
      ? JOURNAL_DECISIONS.ACCEPT
      : decision === "reject" || decision === "rejected"
        ? JOURNAL_DECISIONS.REJECT
        : decision === "revise" || decision === "revision_requested"
          ? JOURNAL_DECISIONS.REVISE
          : decision === "pending"
            ? JOURNAL_DECISIONS.PENDING
            : null;
  if (!normalized) throw new AppError("Invalid journal decision — use accept, reject, revise, or pending", 400);

  const noteText = String(note || "").trim();
  if (normalized !== JOURNAL_DECISIONS.PENDING && !noteText) {
    throw new AppError("note/comment is required with the journal decision", 400);
  }

  pub.journalDecision = normalized;
  pub.journalDecisionNote = noteText;
  pub.journalDecisionAt = new Date();
  pub.journalDecisionBy = req.user.id;

  if (noteText) pushReviewerComment(pub, req, noteText, normalized);

  // Keep institutional status aligned when staff/researcher logs venue outcome
  if (normalized === JOURNAL_DECISIONS.ACCEPT) {
    pub.status = PUBLICATION_STATUSES.VALIDATED;
    pub.workflowStage = WORKFLOW_STAGES.PUBLISHED;
    pub.validationComment = noteText || pub.validationComment;
    pub.validatedAt = new Date();
    pub.validatedBy = req.user.id;
  } else if (normalized === JOURNAL_DECISIONS.REJECT) {
    pub.status = PUBLICATION_STATUSES.REJECTED;
    pub.validationComment = noteText || pub.validationComment;
    pub.validatedAt = new Date();
    pub.validatedBy = req.user.id;
  } else if (normalized === JOURNAL_DECISIONS.REVISE) {
    pub.status = PUBLICATION_STATUSES.REVISION_REQUESTED;
    pub.workflowStage = WORKFLOW_STAGES.IN_PROCESS;
    pub.validationComment = noteText || pub.validationComment;
    pub.validatedAt = new Date();
    pub.validatedBy = req.user.id;
  }

  await pub.save();

  if (normalized !== JOURNAL_DECISIONS.PENDING) {
    const decisionLabel =
      normalized === JOURNAL_DECISIONS.ACCEPT
        ? "accepted (journal)"
        : normalized === JOURNAL_DECISIONS.REJECT
          ? "rejected (journal)"
          : "sent back for revision (journal)";
    await afterPublicationDecision(req, pub, { decisionLabel, comment: noteText });
  }

  res.json({
    message: `Journal decision saved: ${JOURNAL_DECISION_LABELS[normalized]}`,
    publication: sanitizePublication(pub),
  });
}

async function refreshCitations(req, res) {
  const { id } = req.params;
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);

  const isOwner = String(pub.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  if (!pub.doi) {
    throw new AppError("Publication has no DOI to look up", 400);
  }

  let citationCount = pub.citationCount || 0;
  let source = "manual";
  try {
    const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(pub.doi)}`;
    const r = await fetch(apiUrl, {
      headers: { "User-Agent": "JustRMS/1.0 (mailto:research@just.edu.so)" },
    });
    if (r.ok) {
      const data = await r.json();
      const count = data?.message?.["is-referenced-by-count"];
      if (typeof count === "number") {
        citationCount = count;
        source = "crossref";
      }
    }
  } catch {
    /* keep manual count on network errors */
  }

  pub.citationCount = citationCount;
  await pub.save();

  res.json({
    message: source === "crossref" ? "Citation count refreshed from CrossRef" : "DOI lookup unavailable; count unchanged",
    citationCount,
    source,
    publication: sanitizePublication(pub),
  });
}

async function updateWorkflowStage(req, res) {
  const { id } = req.params;
  const { stage } = req.body || {};
  if (!STAGE_ORDER.includes(stage)) {
    throw new AppError(`stage must be one of: ${STAGE_ORDER.join(", ")}`, 400);
  }

  const pub = await Publication.findOne(req.tierWhere({ _id: id })).populate("researcherId", "fullName department");
  if (!pub) throw new AppError("Publication not found", 404);
  if (pub.status === PUBLICATION_STATUSES.DRAFT) {
    throw new AppError("Submit the publication before updating faculty workflow stage", 400);
  }
  if (!pub.projectId) {
    throw new AppError("Publication must be linked to a research projectId before faculty workflow", 400);
  }

  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isStaff) throw new AppError("Forbidden", 403);

  if (req.user.role === "faculty_coordinator") {
    const dept = (req.user.department || "").trim();
    const researcherDept = pub.researcherId?.department || "";
    const inScope = coordinatorMatchesResearcherDept(dept, researcherDept);
    if (dept && !inScope) {
      throw new AppError("Publication is outside your faculty", 403);
    }
  }

  const current = resolveWorkflowStage(pub);
  if (current !== stage) {
    const isDirector = req.user.role === "research_director";
    const ci = STAGE_ORDER.indexOf(current);
    const ni = STAGE_ORDER.indexOf(stage);
    const ok = ni > ci && (isDirector ? true : ni === ci + 1);
    if (!ok) {
      throw new AppError(
        `Cannot move from "${workflowStageLabel(current)}" to "${workflowStageLabel(stage)}". Advance one step at a time.`,
        400
      );
    }
  }

  pub.workflowStage = stage;
  if (stage === WORKFLOW_STAGES.PUBLISHED && pub.status === PUBLICATION_STATUSES.SUBMITTED) {
    pub.status = PUBLICATION_STATUSES.VALIDATED;
    pub.validatedAt = pub.validatedAt || new Date();
  }
  await pub.save();
  let projectCompletion = null;
  if (pub.projectId && (stage === WORKFLOW_STAGES.PUBLISHED || pub.status === PUBLICATION_STATUSES.VALIDATED)) {
    try {
      const { maybeCompleteFundedProject } = require("../utils/maybeCompleteFundedProject");
      projectCompletion = await maybeCompleteFundedProject(pub.projectId);
    } catch {
      /* best-effort */
    }
  }

  await notifyPublicationEvent(req, pub, {
    title: `Research output: ${workflowStageLabel(stage)}`,
    body: buildPublicationSubmitNotificationBody(await loadPublicationForNotification(pub), req),
    notifyOwner: true,
    alsoNotifyRoles: stage === WORKFLOW_STAGES.PUBLISHED ? ["faculty_coordinator", "research_director"] : [],
  });

  res.json({ message: "Workflow stage updated", publication: sanitizePublication(pub), projectCompletion });
}

async function deletePublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);

  const isDirector = req.user.role === "research_director";
  const isOwner = String(pub.researcherId) === String(req.user.id);
  if (!isDirector && !isOwner) throw new AppError("Forbidden", 403);

  if (
    !isDirector &&
    ![
      PUBLICATION_STATUSES.DRAFT,
      PUBLICATION_STATUSES.REJECTED,
      PUBLICATION_STATUSES.REVISION_REQUESTED,
    ].includes(pub.status)
  ) {
    throw new AppError("Only draft, rejected, or revise&resubmit outputs can be deleted", 400);
  }

  const title = pub.title;
  const projectId = pub.projectId ? String(pub.projectId) : null;
  await pub.deleteOne();
try {
    await recordAudit(req, {
      action: "publication.deleted",
      entityType: "publication",
      entityId: id,
      summary: `Deleted publication: ${title}`,
    });
  } catch {
    /* optional */
  }

  res.json({ message: "Publication deleted", id, projectId });
}

module.exports = {
  listPublications,
  getPublication,
  getFacultyWorkflow,
  createPublication,
  updatePublication,
  submitPublication,
  validatePublication,
  addPublicationComment,
  setJournalDecision,
  refreshCitations,
  updateWorkflowStage,
  deletePublication,
};

