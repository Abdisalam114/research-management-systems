const {
  Publication,
  PUBLICATION_STATUSES,
  PUBLICATION_TYPES,
  LEGACY_PUBLICATION_TYPE_MAP,
  WORKFLOW_STAGES,
} = require("../models/Publication");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const {
  resolveWorkflowStage,
  workflowStageLabel,
  countByWorkflowStage,
  STAGE_ORDER,
} = require("../utils/publicationWorkflow");

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

  const pubs = await Publication.find(filter).sort({ createdAt: -1 }).populate("researcherId", "fullName department");
  res.json({ publications: pubs.map(sanitizePublication) });
}

async function getFacultyWorkflow(req, res) {
  const { role, department } = req.user;
  if (!["faculty_coordinator", "research_director"].includes(role)) {
    throw new AppError("Forbidden", 403);
  }

  const dept = (department || "").trim();
  let pubs = await Publication.find({
    status: { $ne: PUBLICATION_STATUSES.DRAFT },
  })
    .sort({ updatedAt: -1 })
    .populate("researcherId", "fullName department");

  if (role === "faculty_coordinator" && dept) {
    pubs = pubs.filter((p) => p.researcherId && p.researcherId.department === dept);
  }

  const sanitized = pubs.map(sanitizePublication);
  const byStage = {};
  STAGE_ORDER.forEach((s) => {
    byStage[s] = sanitized.filter((p) => p.workflowStage === s);
  });

  res.json({
    department: role === "research_director" ? "All faculties" : dept || "Faculty",
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
  const pub = await Publication.findById(id);
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
  const { title, type, year, venue, doi, orcid, url, authors, communityImpact } = req.body || {};
  if (!title) throw new AppError("title is required", 400);

  const normalizedType = normalizeType(type);
  const impactText = communityImpact ? String(communityImpact).trim() : "";
  if (normalizedType === PUBLICATION_TYPES.COMMUNITY_IMPACT && !impactText) {
    throw new AppError("communityImpact description is required for community research impact outputs", 400);
  }

  const pub = await Publication.create({
    title: String(title).trim(),
    type: normalizedType,
    year,
    venue: venue ? String(venue).trim() : "",
    doi: doi ? String(doi).trim() : "",
    orcid: orcid ? String(orcid).trim() : "",
    url: url ? String(url).trim() : "",
    authors: Array.isArray(authors) ? authors.map((a) => String(a).trim()).filter(Boolean) : [],
    communityImpact: impactText,
    researcherId: req.user.id,
    status: PUBLICATION_STATUSES.DRAFT,
  });

  res.status(201).json({ publication: sanitizePublication(pub) });
}

async function updatePublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![PUBLICATION_STATUSES.DRAFT, PUBLICATION_STATUSES.REJECTED].includes(pub.status)) {
    throw new AppError("Only draft or rejected publications can be edited", 400);
  }

  const { title, type, year, venue, doi, orcid, url, authors, citationCount, communityImpact } = req.body || {};
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

  await pub.save();
  res.json({ publication: sanitizePublication(pub) });
}

async function submitPublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (pub.status !== PUBLICATION_STATUSES.DRAFT) throw new AppError("Only draft publications can be submitted", 400);

  pub.status = PUBLICATION_STATUSES.SUBMITTED;
  pub.workflowStage = WORKFLOW_STAGES.SUBMITTED;
  await pub.save();

  try {
    await notifyUsersByRole("faculty_coordinator", {
      type: "publication",
      title: "Publication submitted for validation",
      body: pub.title,
      link: "/publications",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Publication submitted", publication: sanitizePublication(pub) });
}

async function validatePublication(req, res) {
  const { id } = req.params;
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["validated", "rejected"].includes(decision)) throw new AppError("Invalid decision", 400);

  const pub = await Publication.findById(id);
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
  const pub = await Publication.findById(id);
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

  const pub = await Publication.findById(id).populate("researcherId", "fullName department");
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

