const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { AppError } = require("../utils/AppError");

function sanitizeProposal(p) {
  return {
    id: p._id,
    title: p.title,
    abstract: p.abstract,
    department: p.department,
    researchArea: p.researchArea,
    document: p.document,
    version: p.version,
    researcherId: p.researcherId,
    status: p.status,
    reviewerComments: p.reviewerComments,
    submittedAt: p.submittedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function createProposal(req, res) {
  const { title, abstract, department, researchArea } = req.body;
  if (!title || !abstract || !department || !researchArea) {
    throw new AppError("title, abstract, department, and researchArea are required", 400);
  }

  const document = req.file ? `/uploads/${req.file.filename}` : null;

  const proposal = await Proposal.create({
    title,
    abstract,
    department,
    researchArea,
    document,
    researcherId: req.user.id,
    status: PROPOSAL_STATUSES.DRAFT,
    version: 1,
  });

  res.status(201).json({ proposal: sanitizeProposal(proposal) });
}

async function updateProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (String(proposal.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
    throw new AppError("Only draft or revision requested proposals can be edited", 400);
  }

  const { title, abstract, department, researchArea } = req.body;
  if (title) proposal.title = title;
  if (abstract) proposal.abstract = abstract;
  if (department) proposal.department = department;
  if (researchArea) proposal.researchArea = researchArea;

  if (req.file) {
    proposal.document = `/uploads/${req.file.filename}`;
  }

  await proposal.save();
  res.json({ proposal: sanitizeProposal(proposal) });
}

async function submitProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (String(proposal.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
    throw new AppError("Proposal cannot be submitted in its current status", 400);
  }

  if (proposal.status === PROPOSAL_STATUSES.REVISION_REQUESTED) {
    proposal.version += 1;
  }

  proposal.status = PROPOSAL_STATUSES.SUBMITTED;
  proposal.submittedAt = new Date();
  await proposal.save();

  res.json({ message: "Proposal submitted", proposal: sanitizeProposal(proposal) });
}

async function listProposals(req, res) {
  const { role } = req.user;

  if (role === "researcher") {
    const proposals = await Proposal.find({ researcherId: req.user.id }).sort({ createdAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  // Faculty Coordinator / Research Director view for review
  const proposals = await Proposal.find({
    status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED] },
  }).sort({ submittedAt: -1, createdAt: -1 });

  res.json({ proposals: proposals.map(sanitizeProposal) });
}

async function getProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);

  const isOwner = String(proposal.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ proposal: sanitizeProposal(proposal) });
}

async function coordinatorReview(req, res) {
  const { id } = req.params;
  const { action, comment } = req.body;
  if (!comment) throw new AppError("comment is required", 400);
  if (!["recommend_revision", "recommend_approval"].includes(action)) {
    throw new AppError("Invalid action", 400);
  }

  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW].includes(proposal.status)) {
    throw new AppError("Proposal is not reviewable in its current status", 400);
  }

  proposal.status = PROPOSAL_STATUSES.UNDER_REVIEW;
  proposal.reviewerComments.push({ role: "faculty_coordinator", comment });
  await proposal.save();

  res.json({ message: "Review saved", proposal: sanitizeProposal(proposal) });
}

async function directorDecision(req, res) {
  const { id } = req.params;
  const { decision, comment } = req.body;
  if (!comment) throw new AppError("comment is required", 400);
  if (![PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.REJECTED, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW].includes(proposal.status)) {
    throw new AppError("Proposal is not decision-ready in its current status", 400);
  }

  proposal.status = decision;
  proposal.reviewerComments.push({ role: "research_director", comment });
  await proposal.save();

  if (decision === PROPOSAL_STATUSES.APPROVED) {
    const existing = await Project.findOne({ proposalId: proposal._id });
    if (!existing) {
      await Project.create({
        proposalId: proposal._id,
        title: proposal.title,
        researcherId: proposal.researcherId,
        teamMembers: [],
        milestones: [],
        status: "active",
        progressReports: [],
      });
    }
  }

  res.json({ message: "Decision saved", proposal: sanitizeProposal(proposal) });
}

module.exports = {
  createProposal,
  updateProposal,
  submitProposal,
  listProposals,
  getProposal,
  coordinatorReview,
  directorDecision,
};

