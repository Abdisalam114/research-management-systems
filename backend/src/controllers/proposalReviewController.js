const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { User } = require("../models/User");
const { AppError } = require("../utils/AppError");
const { notifyUser } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");
const {
  STAGE_STATUS,
  ensureReviewPipeline,
  getCurrentReviewStage,
} = require("../utils/proposalReviewPipeline");

function sanitizeProposalBrief(p) {
  return {
    id: p._id,
    title: p.title,
    status: p.status,
    department: p.department,
    researcherId: p.researcherId,
    reviewPipeline: ensureReviewPipeline(p),
    currentReviewStage: getCurrentReviewStage(p),
    assignedReviewers: p.assignedReviewers || [],
    peerReviews: p.peerReviews || [],
    submittedAt: p.submittedAt,
  };
}

async function adminScreening(req, res) {
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["pass", "fail"].includes(decision)) throw new AppError("Invalid decision", 400);

  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW].includes(proposal.status)) {
    throw new AppError("Proposal not in reviewable status", 400);
  }

  const pipe = ensureReviewPipeline(proposal);
  pipe.adminScreening = {
    status: decision === "pass" ? STAGE_STATUS.PASSED : STAGE_STATUS.FAILED,
    completedAt: new Date(),
    completedBy: req.user.id,
    comment: String(comment),
  };
  proposal.status = PROPOSAL_STATUSES.UNDER_REVIEW;
  proposal.reviewerComments.push({ role: req.user.role, comment: `[Admin screening: ${decision}] ${comment}` });
  await proposal.save();

  await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: "admin_screening",
    label: `Admin screening ${decision}`,
    detail: proposal.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Admin screening saved", proposal: sanitizeProposalBrief(proposal) });
}

async function submitPeerReview(req, res) {
  const { score, comment } = req.body || {};
  if (typeof score !== "number" || score < 1 || score > 5) {
    throw new AppError("score must be 1–5", 400);
  }

  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const assigned = (proposal.assignedReviewers || []).some(
    (r) => String(r.userId) === String(req.user.id)
  );
  const isDirector = req.user.role === "research_director";
  if (!assigned && !isDirector) throw new AppError("You are not assigned as reviewer", 403);

  const existing = (proposal.peerReviews || []).find((r) => String(r.userId) === String(req.user.id));
  if (existing) throw new AppError("You already submitted a peer review", 400);

  proposal.peerReviews = proposal.peerReviews || [];
  proposal.peerReviews.push({
    userId: req.user.id,
    score,
    comment: comment ? String(comment) : "",
    at: new Date(),
  });

  const pipe = ensureReviewPipeline(proposal);
  pipe.peerReview.status = STAGE_STATUS.IN_PROGRESS;
  await proposal.save();

  await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: "peer_review",
    label: "Peer review submitted",
    detail: `Score ${score}`,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Peer review saved", proposal: sanitizeProposalBrief(proposal) });
}

async function completePeerReview(req, res) {
  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (req.user.role !== "research_director") throw new AppError("Forbidden", 403);

  const reviews = proposal.peerReviews || [];
  if (reviews.length === 0) throw new AppError("No peer reviews submitted yet", 400);

  const pipe = ensureReviewPipeline(proposal);
  pipe.peerReview.status = STAGE_STATUS.PASSED;
  pipe.peerReview.completedAt = new Date();
  pipe.peerReview.reviews = reviews.map((r) => ({ userId: r.userId, score: r.score, at: r.at }));
  await proposal.save();

  res.json({ message: "Peer review stage completed", proposal: sanitizeProposalBrief(proposal) });
}

async function committeeReview(req, res) {
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["recommend_approval", "recommend_revision", "reject"].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const pipe = ensureReviewPipeline(proposal);
  pipe.committeeReview = {
    status: decision === "reject" ? STAGE_STATUS.FAILED : STAGE_STATUS.PASSED,
    completedAt: new Date(),
    completedBy: req.user.id,
    decision,
    comment: String(comment),
  };
  proposal.reviewerComments.push({ role: req.user.role, comment: `[Committee: ${decision}] ${comment}` });
  await proposal.save();

  await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: "committee_review",
    label: `Committee ${decision}`,
    detail: proposal.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Committee review saved", proposal: sanitizeProposalBrief(proposal) });
}

async function financeProposalReview(req, res) {
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["approve", "reject"].includes(decision)) throw new AppError("Invalid decision", 400);

  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const pipe = ensureReviewPipeline(proposal);
  pipe.financeReview = {
    status: decision === "approve" ? STAGE_STATUS.PASSED : STAGE_STATUS.FAILED,
    completedAt: new Date(),
    completedBy: req.user.id,
    decision,
    comment: String(comment),
  };
  proposal.reviewerComments.push({ role: "finance_officer", comment: `[Finance: ${decision}] ${comment}` });
  await proposal.save();

  await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: "finance_review",
    label: `Finance ${decision}`,
    detail: proposal.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Finance review saved", proposal: sanitizeProposalBrief(proposal) });
}

async function listMyReviewAssignments(req, res) {
  const proposals = await Proposal.find(
    req.tierWhere({
      "assignedReviewers.userId": req.user.id,
      status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW] },
    })
  )
    .sort({ submittedAt: -1 })
    .select("title status department submittedAt assignedReviewers peerReviews reviewPipeline");

  const items = proposals.map((p) => {
    const reviewed = (p.peerReviews || []).some((r) => String(r.userId) === String(req.user.id));
    return {
      id: p._id,
      title: p.title,
      status: p.status,
      department: p.department,
      submittedAt: p.submittedAt,
      currentReviewStage: getCurrentReviewStage(p),
      peerReviewSubmitted: reviewed,
    };
  });

  res.json({ assignments: items });
}

module.exports = {
  adminScreening,
  submitPeerReview,
  completePeerReview,
  committeeReview,
  financeProposalReview,
  listMyReviewAssignments,
  sanitizeProposalBrief,
};
