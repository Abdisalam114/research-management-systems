const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { User } = require("../models/User");
const { AppError } = require("../utils/AppError");
const { notifyUser } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");
const {
  STAGE_STATUS,
  ensureReviewPipeline,
  getCurrentReviewStage,
  isVoluntaryProposal,
  ACTIVE_PEER_REVIEW_STATUSES,
  peerReviewSentToReviewersFilter,
  peerReviewAssignedToUserFilter,
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
  proposal.markModified("reviewPipeline");
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

  if (decision === "pass" && (proposal.assignedReviewers || []).length) {
    for (const r of proposal.assignedReviewers) {
      try {
        await notifyUser(r.userId, {
          type: "proposal",
          title: "Proposal ready for peer review",
          body: `Admin screening passed: ${proposal.title}`,
          link: `/proposals/${proposal._id}/review`,
          programTier: req.programTier,
        });
      } catch (_) {
        /* best-effort */
      }
    }
  }
res.json({ message: "Admin screening saved", proposal: sanitizeProposalBrief(proposal) });
}

function reviewerUserId(ref) {
  if (ref == null) return "";
  if (typeof ref === "object") {
    if (ref._id != null) return String(ref._id);
    // ObjectId.id is a Buffer — never use it for comparisons
    if (typeof ref.toHexString === "function") return ref.toHexString();
    if (typeof ref.id === "string" || typeof ref.id === "number") return String(ref.id);
    return String(ref);
  }
  return String(ref);
}

function proposalScopeFilter(req, base = {}) {
  return req.tierWhere(base);
}

async function submitPeerReview(req, res) {
  const { score, comment } = req.body || {};
  if (typeof score !== "number" || score < 1 || score > 5) {
    throw new AppError("score must be 1–5", 400);
  }
  if (!comment || !String(comment).trim()) {
    throw new AppError("comment is required", 400);
  }

  const proposal = await Proposal.findOne(proposalScopeFilter(req, { _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const assigned = (proposal.assignedReviewers || []).some(
    (r) => reviewerUserId(r.userId) === String(req.user.id)
  );
  const isDirector = req.user.role === "research_director";
  if (!assigned && !isDirector) throw new AppError("You are not assigned as reviewer", 403);

  const pipe = ensureReviewPipeline(proposal);
  if (pipe.peerReview?.status === STAGE_STATUS.PASSED) {
    throw new AppError("Peer review stage already completed", 400);
  }

  const existing = (proposal.peerReviews || []).find(
    (r) => reviewerUserId(r.userId) === String(req.user.id)
  );
  if (existing) throw new AppError("You already submitted a peer review", 400);

  // Director may only submit a score when no peer reviews exist yet (otherwise complete stage)
  if (isDirector && !assigned && (proposal.peerReviews || []).length > 0) {
    throw new AppError("Peer reviews already submitted; complete the peer review stage instead", 400);
  }

  proposal.peerReviews = proposal.peerReviews || [];
  proposal.peerReviews.push({
    userId: req.user.id,
    score,
    comment: String(comment).trim(),
    at: new Date(),
  });

  pipe.peerReview.status = STAGE_STATUS.IN_PROGRESS;

  const assignedIds = (proposal.assignedReviewers || [])
    .map((r) => reviewerUserId(r.userId))
    .filter(Boolean);
  const reviewedIds = new Set(
    (proposal.peerReviews || []).map((r) => reviewerUserId(r.userId)).filter(Boolean)
  );
  const allAssignedDone =
    assignedIds.length > 0 && assignedIds.every((id) => reviewedIds.has(id));
  // Complete only when all assignees done, or when no assignees and at least one review exists.
  // Do NOT auto-complete just because the director submitted while Leadership assignees remain.
  const peerComplete =
    allAssignedDone ||
    (assignedIds.length === 0 && (proposal.peerReviews || []).length > 0);

  if (peerComplete) {
    pipe.peerReview.status = STAGE_STATUS.PASSED;
    pipe.peerReview.completedAt = new Date();
    pipe.peerReview.reviews = (proposal.peerReviews || []).map((r) => ({
      userId: r.userId,
      score: r.score,
      at: r.at,
    }));
  }

  proposal.markModified("reviewPipeline");
  proposal.markModified("peerReviews");
  await proposal.save();
await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: "peer_review",
    label: peerComplete ? "Peer review submitted — stage complete" : "Peer review submitted",
    detail: `Score ${score}`,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  // Always notify Director so Open works (Director inbox is cross-portal)
  try {
    const { notifyUsersByRole } = require("../utils/notify");
    await notifyUsersByRole(
      "research_director",
      {
        type: "proposal",
        title: peerComplete
          ? "Peer review complete — continue proposal review"
          : "Peer review submitted — awaiting remaining reviewers",
        body: `${proposal.title} (score ${score}/5)`,
        link: `/proposals/${proposal._id}/review`,
      },
      req.programTier
    );
  } catch {
    /* best-effort */
  }

  res.json({
    message: peerComplete
      ? "Peer review saved — stage complete; Director notified"
      : "Peer review saved — Director notified",
    proposal: sanitizeProposalBrief(proposal),
  });
}

async function completePeerReview(req, res) {
  const proposal = await Proposal.findOne(proposalScopeFilter(req, { _id: req.params.id }));
  if (!proposal) {
    throw new AppError("Proposal not found", 404);
  }
  if (req.user.role !== "research_director") throw new AppError("Forbidden", 403);

  const reviews = proposal.peerReviews || [];
  if (reviews.length === 0) throw new AppError("No peer reviews submitted yet", 400);

  const assignedIds = (proposal.assignedReviewers || [])
    .map((r) => reviewerUserId(r.userId))
    .filter(Boolean);
  const reviewedIds = new Set(reviews.map((r) => reviewerUserId(r.userId)).filter(Boolean));
  if (assignedIds.length > 0) {
    const pending = assignedIds.filter((id) => !reviewedIds.has(id));
    if (pending.length > 0) {
      throw new AppError(
        `Cannot complete peer review: ${pending.length} assigned reviewer(s) have not submitted yet`,
        400
      );
    }
  }

  const pipe = ensureReviewPipeline(proposal);
  pipe.peerReview.status = STAGE_STATUS.PASSED;
  pipe.peerReview.completedAt = new Date();
  pipe.peerReview.reviews = reviews.map((r) => ({ userId: r.userId, score: r.score, at: r.at }));
  proposal.markModified("reviewPipeline");
  await proposal.save();

  try {
    const { notifyUsersByRole } = require("../utils/notify");
    await notifyUsersByRole(
      "research_director",
      {
        type: "proposal",
        title: "Peer review complete — continue proposal review",
        body: proposal.title,
        link: `/proposals/${proposal._id}/review`,
      },
      req.programTier
    );
  } catch {
    /* best-effort */
  }

  res.json({ message: "Peer review stage completed", proposal: sanitizeProposalBrief(proposal) });
}

async function committeeReview(req, res) {
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["recommend_approval", "recommend_revision", "reject"].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const proposal = await Proposal.findOne(proposalScopeFilter(req, { _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const isDirector = req.user.role === "research_director";
  const assignedList = proposal.assignedCommittee || [];
  if (assignedList.length === 0) {
    throw new AppError("Assign committee members before committee review", 400);
  }
  const assigned = assignedList.some(
    (r) => reviewerUserId(r.userId) === String(req.user.id)
  );
  if (!isDirector && !assigned) {
    throw new AppError("You are not assigned to the committee for this proposal", 403);
  }

  const pipe = ensureReviewPipeline(proposal);
  if (pipe.peerReview?.status !== STAGE_STATUS.PASSED) {
    throw new AppError("Peer review must be completed first", 400);
  }
  if (
    pipe.committeeReview?.status === STAGE_STATUS.PASSED ||
    pipe.committeeReview?.status === STAGE_STATUS.FAILED
  ) {
    throw new AppError("Committee review stage already completed", 400);
  }

  let committeeStatus = STAGE_STATUS.PASSED;
  if (decision === "reject") committeeStatus = STAGE_STATUS.FAILED;
  else if (decision === "recommend_revision") committeeStatus = STAGE_STATUS.IN_PROGRESS;

  pipe.committeeReview = {
    status: committeeStatus,
    completedAt: decision === "recommend_revision" ? null : new Date(),
    completedBy: req.user.id,
    decision,
    comment: String(comment),
  };
  if (decision === "recommend_revision") {
    proposal.status = PROPOSAL_STATUSES.REVISION_REQUESTED;
  } else if (decision === "reject") {
    proposal.status = PROPOSAL_STATUSES.REJECTED;
  }
  proposal.reviewerComments.push({ role: req.user.role, comment: `[Committee: ${decision}] ${comment}` });
  proposal.markModified("reviewPipeline");
  await proposal.save();

  if (committeeStatus === STAGE_STATUS.PASSED && !isVoluntaryProposal(proposal)) {
    try {
      const { notifyFinanceProposalReviewReady } = require("../utils/notifyFinanceProposalReview");
      await notifyFinanceProposalReviewReady(proposal, { force: true });
    } catch {
      /* best-effort */
    }
  }
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
  if (isVoluntaryProposal(proposal)) {
    throw new AppError("Finance review is not required for voluntary research proposals", 400);
  }

  const assigned = (proposal.assignedFinance || []).some(
    (r) => reviewerUserId(r.userId) === String(req.user.id)
  );
  if (!assigned) {
    throw new AppError("You are not assigned to finance-review this proposal", 403);
  }

  const pipe = ensureReviewPipeline(proposal);
  if (pipe.committeeReview?.status !== STAGE_STATUS.PASSED) {
    throw new AppError("Committee must pass before finance review", 400);
  }
  pipe.financeReview = {
    status: decision === "approve" ? STAGE_STATUS.PASSED : STAGE_STATUS.FAILED,
    completedAt: new Date(),
    completedBy: req.user.id,
    decision,
    comment: String(comment),
  };
  proposal.reviewerComments.push({ role: "finance_officer", comment: `[Finance: ${decision}] ${comment}` });
  proposal.markModified("reviewPipeline");
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
  const userId = req.user.id;
  const isDirector = req.user.role === "research_director";

  // Self-heal: strip assignees left on closed proposals (updateMany bypasses pre-save).
  try {
    await Proposal.updateMany(
      {
        status: { $nin: [...ACTIVE_PEER_REVIEW_STATUSES] },
        $or: [
          { "assignedReviewers.0": { $exists: true } },
          { "assignedCommittee.0": { $exists: true } },
          { "assignedFinance.0": { $exists: true } },
        ],
      },
      { $set: { assignedReviewers: [], assignedCommittee: [], assignedFinance: [] } }
    );
  } catch {
    /* best-effort */
  }

  // Leadership + Director share the same active peer-review queue filter helpers.
  const filter = isDirector
    ? req.tierWhere(peerReviewSentToReviewersFilter())
    : req.tierWhere(peerReviewAssignedToUserFilter(userId));

  const proposals = await Proposal.find(filter)
    .sort({ submittedAt: -1, updatedAt: -1 })
    .populate("assignedReviewers.userId", "fullName email role")
    .populate("researcherId", "fullName email")
    .select(
      "title status department submittedAt assignedReviewers peerReviews reviewPipeline researcherId updatedAt"
    );

  const items = proposals.map((p) => {
    const reviewed = (p.peerReviews || []).some(
      (r) => reviewerUserId(r.userId) === String(userId)
    );
    const reviewers = (p.assignedReviewers || []).map((r) => ({
      id: reviewerUserId(r.userId),
      fullName: r.userId?.fullName || null,
      email: r.userId?.email || null,
      assignedAt: r.assignedAt || null,
      peerReviewSubmitted: (p.peerReviews || []).some(
        (pr) => reviewerUserId(pr.userId) === reviewerUserId(r.userId)
      ),
    }));
    const pendingReviewers = reviewers.filter((r) => !r.peerReviewSubmitted).length;
    const peerStage = p.reviewPipeline?.peerReview?.status || "pending";
    // Director "awaiting" = at least one assigned Leadership reviewer has not submitted yet
    const awaitingLeadership = pendingReviewers > 0;
    return {
      id: p._id,
      title: p.title,
      status: p.status,
      department: p.department,
      submittedAt: p.submittedAt,
      updatedAt: p.updatedAt,
      researcherName: p.researcherId?.fullName || null,
      currentReviewStage: getCurrentReviewStage(p),
      peerReviewSubmitted: reviewed,
      peerReviewCount: (p.peerReviews || []).length,
      peerStage,
      assignedReviewers: reviewers,
      sentToReviewers: reviewers.length > 0,
      pendingReviewers,
      awaitingLeadership,
      scope: isDirector ? "sent_to_reviewers" : "my_assignments",
    };
  });

  const awaitingCount = items.filter((i) =>
    isDirector ? i.awaitingLeadership : !i.peerReviewSubmitted
  ).length;
res.json({
    assignments: items,
    mode: isDirector ? "director_sent" : "reviewer",
    summary: {
      total: items.length,
      awaiting: awaitingCount,
      received: items.length - awaitingCount,
    },
  });
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
