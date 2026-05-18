const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { User } = require("../models/User");
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
    versionHistory: p.versionHistory || [],
    researcherId: p.researcherId,
    status: p.status,
    requiresEthics: p.requiresEthics !== false,
    ethicsStatus: p.ethicsStatus,
    ethicsComments: p.ethicsComments || [],
    assignedReviewers: p.assignedReviewers || [],
    reviewerComments: p.reviewerComments,
    submittedAt: p.submittedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function pushVersionHistory(proposal, note = "") {
  if (!proposal.document) return;
  proposal.versionHistory.push({
    version: proposal.version,
    document: proposal.document,
    note,
    savedAt: new Date(),
  });
}

function ethicsBlocksSubmission(proposal) {
  if (!proposal.requiresEthics) return false;
  return ![ETHICS_STATUSES.APPROVED, ETHICS_STATUSES.NOT_REQUIRED].includes(proposal.ethicsStatus);
}

async function createProposal(req, res) {
  const { title, abstract, department, researchArea, requiresEthics } = req.body;
  if (!title || !abstract || !department || !researchArea) {
    throw new AppError("title, abstract, department, and researchArea are required", 400);
  }

  const document = req.file ? `/uploads/${req.file.filename}` : null;
  const needsEthics = requiresEthics !== "false" && requiresEthics !== false;

  const proposal = await Proposal.create({
    title,
    abstract,
    department,
    researchArea,
    document,
    researcherId: req.user.id,
    status: PROPOSAL_STATUSES.DRAFT,
    version: 1,
    requiresEthics: needsEthics,
    ethicsStatus: needsEthics ? ETHICS_STATUSES.PENDING : ETHICS_STATUSES.NOT_REQUIRED,
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

  const { title, abstract, department, researchArea, requiresEthics } = req.body;
  if (title) proposal.title = title;
  if (abstract) proposal.abstract = abstract;
  if (department) proposal.department = department;
  if (researchArea) proposal.researchArea = researchArea;
  if (requiresEthics !== undefined) {
    proposal.requiresEthics = requiresEthics !== "false" && requiresEthics !== false;
    if (!proposal.requiresEthics) proposal.ethicsStatus = ETHICS_STATUSES.NOT_REQUIRED;
    else if (proposal.ethicsStatus === ETHICS_STATUSES.NOT_REQUIRED) {
      proposal.ethicsStatus = ETHICS_STATUSES.PENDING;
    }
  }

  if (req.file) {
    pushVersionHistory(proposal, "Document replaced before resubmit");
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

  if (ethicsBlocksSubmission(proposal)) {
    throw new AppError("Ethics approval is required before submission", 400);
  }

  if (proposal.status === PROPOSAL_STATUSES.REVISION_REQUESTED) {
    pushVersionHistory(proposal, "Submitted after revision");
    proposal.version += 1;
  }

  proposal.status = PROPOSAL_STATUSES.SUBMITTED;
  proposal.submittedAt = new Date();
  await proposal.save();

  res.json({ message: "Proposal submitted", proposal: sanitizeProposal(proposal) });
}

async function listProposals(req, res) {
  const { role } = req.user;
  const { scope } = req.query || {};

  if (role === "researcher") {
    const proposals = await Proposal.find({ researcherId: req.user.id }).sort({ createdAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  if (scope === "all" && role === "research_director") {
    const proposals = await Proposal.find({}).sort({ updatedAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  const proposals = await Proposal.find({
    status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED] },
  }).sort({ submittedAt: -1, createdAt: -1 });

  res.json({ proposals: proposals.map(sanitizeProposal) });
}

async function getProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findById(id).populate("assignedReviewers.userId", "fullName email role department");
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

  if (ethicsBlocksSubmission(proposal)) {
    throw new AppError("Ethics must be approved before final proposal decision", 400);
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
        milestones: [
          { title: "Ethics clearance", dueDate: null, completed: proposal.ethicsStatus === ETHICS_STATUSES.APPROVED },
          { title: "Mid-term review", dueDate: null, completed: false },
          { title: "Final report", dueDate: null, completed: false },
        ],
        status: "active",
        progressReports: [],
      });
    }
  }

  res.json({ message: "Decision saved", proposal: sanitizeProposal(proposal) });
}

async function ethicsDecision(req, res) {
  const { id } = req.params;
  const { decision, comment } = req.body;
  if (!comment) throw new AppError("comment is required", 400);
  if (!Object.values(ETHICS_STATUSES).filter((s) => s !== ETHICS_STATUSES.NOT_REQUIRED).includes(decision)) {
    throw new AppError("Invalid ethics decision", 400);
  }

  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (!proposal.requiresEthics) throw new AppError("Ethics review not required for this proposal", 400);

  proposal.ethicsStatus = decision;
  proposal.ethicsComments.push({ role: req.user.role, comment });
  await proposal.save();

  res.json({ message: "Ethics decision saved", proposal: sanitizeProposal(proposal) });
}

async function assignReviewers(req, res) {
  const { id } = req.params;
  const { reviewerIds } = req.body;
  if (!Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    throw new AppError("reviewerIds array is required", 400);
  }

  const proposal = await Proposal.findById(id);
  if (!proposal) throw new AppError("Proposal not found", 404);

  const users = await User.find({ _id: { $in: reviewerIds }, status: "active" });
  if (users.length !== reviewerIds.length) throw new AppError("One or more reviewers not found", 400);

  proposal.assignedReviewers = reviewerIds.map((userId) => ({
    userId,
    assignedBy: req.user.id,
    assignedAt: new Date(),
  }));
  await proposal.save();

  res.json({ message: "Reviewers assigned", proposal: sanitizeProposal(proposal) });
}

module.exports = {
  createProposal,
  updateProposal,
  submitProposal,
  listProposals,
  getProposal,
  coordinatorReview,
  directorDecision,
  ethicsDecision,
  assignReviewers,
};
