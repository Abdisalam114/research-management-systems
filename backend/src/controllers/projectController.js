const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");

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

function sanitizeProject(p) {
  return {
    id: p._id,
    proposalId: p.proposalId,
    title: p.title,
    researcherId: p.researcherId,
    teamMembers: normalizeTeamMembers(p.teamMembers),
    milestones: p.milestones || [],
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
  const filter = role === "researcher" ? { researcherId: req.user.id } : {};
  const projects = await Project.find(filter).sort({ createdAt: -1 });
  res.json({ projects: projects.map(sanitizeProject) });
}

async function getProject(req, res) {
  const { id } = req.params;
  const project = await Project.findById(id).populate("researcherId", "fullName email department");
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const out = sanitizeProject(project);
  if (project.researcherId && typeof project.researcherId === "object") {
    out.principalInvestigator = {
      id: project.researcherId._id,
      fullName: project.researcherId.fullName,
      email: project.researcherId.email,
      department: project.researcherId.department,
    };
  }
  res.json({ project: out });
}

async function updateProject(req, res) {
  const { id } = req.params;
  const project = await Project.findById(id);
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
  res.json({ message: "Project updated", project: sanitizeProject(project) });
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

module.exports = { listProjects, getProject, updateProject, addProgressReport, backfillProjectFromApprovedProposal };
