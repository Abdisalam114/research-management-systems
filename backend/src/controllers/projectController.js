const { Project } = require("../models/Project");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");

function sanitizeProject(p) {
  return {
    id: p._id,
    proposalId: p.proposalId,
    title: p.title,
    researcherId: p.researcherId,
    teamMembers: p.teamMembers,
    milestones: p.milestones,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    progressReports: p.progressReports,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listProjects(req, res) {
  const { role } = req.user;

  if (role === "researcher") {
    const projects = await Project.find({ researcherId: req.user.id }).sort({ createdAt: -1 });
    res.json({ projects: projects.map(sanitizeProject) });
    return;
  }

  // Research Director / Faculty Coordinator: view all projects (MVP)
  const projects = await Project.find({}).sort({ createdAt: -1 });
  res.json({ projects: projects.map(sanitizeProject) });
}

async function getProject(req, res) {
  const { id } = req.params;
  const project = await Project.findById(id);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ project: sanitizeProject(project) });
}

async function addProgressReport(req, res) {
  const { id } = req.params;
  const { note, progressPercent } = req.body;
  if (!note) throw new AppError("note is required", 400);

  const project = await Project.findById(id);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  if (!isOwner) throw new AppError("Forbidden", 403);

  project.progressReports.unshift({
    note,
    progressPercent: typeof progressPercent === "number" ? progressPercent : 0,
    createdBy: req.user.id,
  });

  await project.save();
  res.json({ message: "Progress report added", project: sanitizeProject(project) });
}

async function backfillProjectFromApprovedProposal(req, res) {
  // MVP helper: if a proposal is already approved but project missing, create it.
  const { proposalId } = req.params;

  const proposal = await Proposal.findById(proposalId);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (proposal.status !== PROPOSAL_STATUSES.APPROVED) throw new AppError("Proposal is not approved", 400);

  const existing = await Project.findOne({ proposalId: proposal._id });
  if (existing) return res.json({ message: "Project already exists", project: sanitizeProject(existing) });

  const project = await Project.create({
    proposalId: proposal._id,
    title: proposal.title,
    researcherId: proposal.researcherId,
    teamMembers: [],
    milestones: [],
    status: "active",
    progressReports: [],
  });

  res.status(201).json({ message: "Project created", project: sanitizeProject(project) });
}

module.exports = { listProjects, getProject, addProgressReport, backfillProjectFromApprovedProposal };

