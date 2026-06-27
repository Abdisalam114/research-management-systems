const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");
const { userDisplayName } = require("../utils/userDisplay");
const {
  resolvePrincipalInvestigatorId,
  resolvePrincipalInvestigatorName,
  PROJECT_PI_POPULATE,
} = require("../utils/projectPrincipalInvestigator");

function normalizeTeamMembers(team) {
  if (!Array.isArray(team)) return [];
  return team.map((m) => {
    if (typeof m === "string") return { name: m, userId: null, role: "member" };
    return {
      name: m.name || "Member",
      userId: m.userId || null,
      role: m.role || "member",
    };
  });
}

function attachPrincipalInvestigator(out, p) {
  const name = resolvePrincipalInvestigatorName(p);
  const piId = resolvePrincipalInvestigatorId(p);
  const researcher =
    p.researcherId && userDisplayName(p.researcherId) !== "—"
      ? p.researcherId
      : p.leadResearcher && userDisplayName(p.leadResearcher) !== "—"
        ? p.leadResearcher
        : null;

  if (researcher && typeof researcher === "object") {
    const displayName = userDisplayName(researcher);
    out.principalInvestigator = {
      id: researcher._id,
      fullName: displayName,
      email: researcher.email,
      department: researcher.department,
    };
    out.principalInvestigatorName = displayName;
  } else if (name) {
    out.principalInvestigatorName = name;
  }

  if (piId) out.principalInvestigatorId = String(piId);
  return out;
}

function sanitizeProject(p) {
  const researcherId = resolvePrincipalInvestigatorId(p);
  const proposalId = p.proposalId?._id || p.proposalId || p.proposal?._id || p.proposal;
  const out = {
    id: p._id,
    proposalId,
    title: p.title,
    researcherId: researcherId ? String(researcherId) : null,
    milestones: p.milestones || [],
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    progressReports: p.progressReports,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  return attachPrincipalInvestigator(out, p);
}

const PROJECT_POPULATE = { path: "researcherId", select: "fullName name email department" };

async function listProjects(req, res) {
  const { role } = req.user;
  const filter = req.tierWhere(role === "researcher" ? { researcherId: req.user.id } : {});
  const projects = await Project.find(filter).sort({ createdAt: -1 }).populate(PROJECT_POPULATE);
  const sanitized = projects.map(sanitizeProject);

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const withPi = sanitized.filter((p) => p.principalInvestigatorName).length;
    fs.appendFileSync(
      path.join(__dirname, "../../../debug-6113cc.log"),
      `${JSON.stringify({
        sessionId: "6113cc",
        location: "projectController.js:listProjects",
        message: "projects PI coverage",
        data: { total: sanitized.length, withPi, missingPi: sanitized.length - withPi },
        timestamp: Date.now(),
        hypothesisId: "PI1",
        runId: "project-pi",
      })}\n`
    );
  } catch (_) {}
  // #endregion

  res.json({ projects: sanitized });
}

async function getProject(req, res) {
  const { id } = req.params;
  const project = await Project.findOne(req.tierWhere({ _id: id })).populate(PROJECT_POPULATE);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const grantDocs = await Grant.find(req.tierWhere({ projectId: id }))
    .sort({ createdAt: -1 })
    .select("title status amountRequested amountAwarded currency fundingSource");

  const out = sanitizeProject(project);
  out.linkedGrants = grantDocs.map((g) => ({
    id: g._id,
    title: g.title,
    status: g.status,
    amountRequested: g.amountRequested,
    amountAwarded: g.amountAwarded,
    currency: g.currency,
    fundingSource: g.fundingSource,
  }));

  res.json({ project: out });
}

async function updateProject(req, res) {
  const { id } = req.params;
  const project = await Project.findOne(req.tierWhere({ _id: id }));
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isDirector = req.user.role === "research_director";
  if (!isOwner && !isDirector) throw new AppError("Forbidden", 403);

  const { milestones, teamMembers, startDate, endDate, status } = req.body;

  if (milestones !== undefined) {
    if (!Array.isArray(milestones)) throw new AppError("milestones must be an array", 400);
    project.milestones = milestones.map((m) => ({
      title: m.title,
      dueDate: m.dueDate ? new Date(m.dueDate) : null,
      completed: Boolean(m.completed),
    }));
  }

  if (teamMembers !== undefined) {
    if (!Array.isArray(teamMembers)) throw new AppError("teamMembers must be an array", 400);
    project.teamMembers = teamMembers.map((m) => ({
      name: String(m.name || "").trim() || "Member",
      userId: m.userId || null,
      role: m.role || "member",
    }));
  }

  if (startDate !== undefined) project.startDate = startDate ? new Date(startDate) : project.startDate;
  if (endDate !== undefined) project.endDate = endDate ? new Date(endDate) : null;

  if (status !== undefined) {
    if (!Object.values(PROJECT_STATUSES).includes(status)) throw new AppError("Invalid status", 400);
    if (!isDirector && status !== project.status) throw new AppError("Only director can change project status", 403);
    project.status = status;
  }

  await project.save();
  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Project updated", project: sanitizeProject(updated) });
}

async function addProgressReport(req, res) {
  const { id } = req.params;
  const { note, progressPercent } = req.body;
  if (!note) throw new AppError("note is required", 400);

  const project = await Project.findOne(req.tierWhere({ _id: id }));
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  if (!isOwner) throw new AppError("Forbidden", 403);

  project.progressReports.unshift({
    note,
    progressPercent: typeof progressPercent === "number" ? progressPercent : 0,
    createdBy: req.user.id,
  });

  await project.save();
  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Progress report added", project: sanitizeProject(updated) });
}

async function backfillProjectFromApprovedProposal(req, res) {
  const { proposalId } = req.params;

  const proposal = await Proposal.findOne(req.tierWhere({ _id: proposalId }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (proposal.status !== PROPOSAL_STATUSES.APPROVED) throw new AppError("Proposal is not approved", 400);

  const existing = await Project.findOne(req.tierWhere({ proposalId: proposal._id })).populate(PROJECT_POPULATE);
  if (existing) return res.json({ message: "Project already exists", project: sanitizeProject(existing) });

  const project = await Project.create(req.tierAssign({
    proposalId: proposal._id,
    title: proposal.title,
    researcherId: proposal.researcherId,
    teamMembers: [],
    milestones: [],
    status: "active",
    progressReports: [],
  }));

  const created = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.status(201).json({ message: "Project created", project: sanitizeProject(created) });
}

module.exports = { listProjects, getProject, updateProject, addProgressReport, backfillProjectFromApprovedProposal };
