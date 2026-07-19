const {
  Publication,
  PUBLICATION_STATUSES,
  PUBLICATION_TYPES,
  LEGACY_PUBLICATION_TYPE_MAP,
  WORKFLOW_STAGES,
} = require("../models/Publication");
const { Project } = require("../models/Project");
const { User } = require("../models/User");
const { AppError } = require("../utils/AppError");
const { notifyUser } = require("../utils/notify");
const { resolveOwnedProjectId, requireOwnedProjectId, validateProjectQuery } = require("../utils/projectScopedRecords");
const {
  resolveWorkflowStage,
  workflowStageLabel,
  countByWorkflowStage,
  STAGE_ORDER,
} = require("../utils/publicationWorkflow");
const { resolvePrincipalInvestigatorName } = require("../utils/projectPrincipalInvestigator");
const { userDisplayName } = require("../utils/userDisplay");
const { afterPublicationSubmitted } = require("../utils/publicationSideEffects");

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

async function projectDefaults(projectId, researcherId) {
  const project = await Project.findById(projectId).select("title");
  const authors = await authorsFromProject(projectId, researcherId);
  return {
    title: project?.title ? String(project.title).trim() : "",
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
    workflowStage,
    workflowStageLabel: workflowStageLabel(workflowStage),
    researcherId: p.researcherId,
    projectId: p.projectId?._id ? String(p.projectId._id) : p.projectId || null,
    projectTitle:
      p.projectId && typeof p.projectId === "object" && p.projectId.title ? p.projectId.title : null,
    validatedBy: p.validatedBy,
    validatedAt: p.validatedAt,
    validationComment: p.validationComment,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listPublications(req, res) {
  const { role } = req.user;
  const filter = {};

  if (role === "researcher") filter.researcherId = req.user.id;
  if (req.query.projectId) {
    await validateProjectQuery(req, req.query.projectId, { ownerOnly: true });
    filter.projectId = req.query.projectId;
  }

  const pubs = await Publication.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("researcherId", "fullName department")
    .populate("projectId", "title status");
  res.json({ publications: pubs.map(sanitizePublication) });
}

async function getFacultyWorkflow(req, res) {
  const { role, department } = req.user;
  if (!["faculty_coordinator", "research_director", "researcher"].includes(role)) {
    throw new AppError("Forbidden", 403);
  }

  const dept = (department || "").trim();
  let pubs = await Publication.find(req.tierWhere({
    status: { $ne: PUBLICATION_STATUSES.DRAFT },
  }))
    .sort({ updatedAt: -1 })
    .populate("researcherId", "fullName department");

  if (role === "researcher") {
    pubs = pubs.filter((p) => String(p.researcherId?._id || p.researcherId) === String(req.user.id));
  } else if (role === "faculty_coordinator" && dept) {
    pubs = pubs.filter((p) => p.researcherId && p.researcherId.department === dept);
  }

  const sanitized = pubs.map(sanitizePublication);
  const byStage = {};
  STAGE_ORDER.forEach((s) => {
    byStage[s] = sanitized.filter((p) => p.workflowStage === s);
  });

  const deptLabel =
    role === "research_director" ? "All faculties" : role === "researcher" ? "My outputs" : dept || "Faculty";

  res.json({
    department: deptLabel,
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

  if (![PUBLICATION_STATUSES.DRAFT, PUBLICATION_STATUSES.REJECTED].includes(pub.status)) {
    throw new AppError("Only draft or rejected publications can be edited", 400);
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
    pub.projectId = await requireOwnedProjectId(req, projectId, req.user.id);
  }

  // Editing a rejected output returns it to draft so it can be resubmitted
  if (pub.status === PUBLICATION_STATUSES.REJECTED) {
    pub.status = PUBLICATION_STATUSES.DRAFT;
    pub.validatedBy = undefined;
    pub.validatedAt = undefined;
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
  if (![PUBLICATION_STATUSES.DRAFT, PUBLICATION_STATUSES.REJECTED].includes(pub.status)) {
    throw new AppError("Only draft or rejected publications can be submitted", 400);
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
    if (project?.title) pub.title = project.title;
  }
  if (!(pub.title || "").trim()) {
    throw new AppError("Publication title is required before submit", 400);
  }

  pub.status = PUBLICATION_STATUSES.SUBMITTED;
  pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
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
  if (!comment) throw new AppError("comment is required", 400);
  if (!["validated", "rejected"].includes(decision)) throw new AppError("Invalid decision", 400);

  const pub = await Publication.findOne(req.tierWhere({ _id: id }));
  if (!pub) throw new AppError("Publication not found", 404);
  if (pub.status !== PUBLICATION_STATUSES.SUBMITTED) throw new AppError("Publication is not validation-ready", 400);

  pub.status = decision === "validated" ? PUBLICATION_STATUSES.VALIDATED : PUBLICATION_STATUSES.REJECTED;
  pub.validatedBy = req.user.id;
  pub.validatedAt = new Date();
  pub.validationComment = String(comment);
  if (decision === "validated") {
    pub.workflowStage = WORKFLOW_STAGES.IN_PROCESS;
  } else {
    pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
  }
  await pub.save();

  try {
    await notifyUser(pub.researcherId, {
      type: "publication",
      title: `Publication ${decision === "validated" ? "validated" : "rejected"}`,
      body: pub.title,
      link: "/publications",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Validation saved", publication: sanitizePublication(pub) });
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

  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isStaff) throw new AppError("Forbidden", 403);

  if (req.user.role === "faculty_coordinator") {
    const dept = (req.user.department || "").trim();
    if (dept && pub.researcherId?.department !== dept) {
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

  try {
    const researcherId = pub.researcherId?._id || pub.researcherId;
    await notifyUser(researcherId, {
      type: "publication",
      title: `Research output: ${workflowStageLabel(stage)}`,
      body: pub.title,
      link: "/publications",
    });
  } catch {
    /* best-effort */
  }

  res.json({ message: "Workflow stage updated", publication: sanitizePublication(pub) });
}

module.exports = {
  listPublications,
  getPublication,
  getFacultyWorkflow,
  createPublication,
  updatePublication,
  submitPublication,
  validatePublication,
  refreshCitations,
  updateWorkflowStage,
};

