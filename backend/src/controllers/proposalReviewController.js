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
          link: `/proposals/${proposal._id}`,
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

  const existing = (proposal.peerReviews || []).find((r) => String(r.userId) === String(req.user.id));
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
  // Single leadership review (or director review) is enough to complete the stage
  const peerComplete =
    allAssignedDone ||
    (assignedIds.length === 0 && (proposal.peerReviews || []).length > 0) ||
    (isDirector && (proposal.peerReviews || []).length > 0);

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

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const payload = {
      sessionId: "f558f7",
      hypothesisId: "H1",
      location: "proposalReviewController.submitPeerReview",
      message: "peer submit after save",
      data: {
        proposalId: String(proposal._id),
        peerComplete,
        peerStatus: pipe.peerReview?.status,
        committeeStatus: pipe.committeeReview?.status,
        assignedCount: assignedIds.length,
        reviewedCount: reviewedIds.size,
        role: req.user.role,
      },
      timestamp: Date.now(),
      runId: "pre-fix",
    };
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) { /* debug */ }
  // #endregion

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
  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const payload = {
      sessionId: "f558f7",
      hypothesisId: "H1",
      location: "proposalReviewController.completePeerReview",
      message: "complete peer entry",
      data: {
        proposalId: req.params.id,
        reqTier: req.programTier || null,
        role: req.user.role,
      },
      timestamp: Date.now(),
      runId: "complete-debug",
    };
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) { /* debug */ }
  // #endregion

  const proposal = await Proposal.findOne(proposalScopeFilter(req, { _id: req.params.id }));
  if (!proposal) {
    // #region agent log
    try {
      const fs = require("fs");
      const path = require("path");
      const payload = {
        sessionId: "f558f7",
        hypothesisId: "H1",
        location: "proposalReviewController.completePeerReview",
        message: "proposal not found for tier",
        data: { proposalId: req.params.id, reqTier: req.programTier || null },
        timestamp: Date.now(),
        runId: "complete-debug",
      };
      fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (_) { /* debug */ }
    // #endregion
    throw new AppError("Proposal not found", 404);
  }
  if (req.user.role !== "research_director") throw new AppError("Forbidden", 403);

  const reviews = proposal.peerReviews || [];
  if (reviews.length === 0) throw new AppError("No peer reviews submitted yet", 400);

  const pipe = ensureReviewPipeline(proposal);
  pipe.peerReview.status = STAGE_STATUS.PASSED;
  pipe.peerReview.completedAt = new Date();
  pipe.peerReview.reviews = reviews.map((r) => ({ userId: r.userId, score: r.score, at: r.at }));
  proposal.markModified("reviewPipeline");
  await proposal.save();

  const fresh = await Proposal.findById(proposal._id).select("reviewPipeline programTier peerReviews");
  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const payload = {
      sessionId: "f558f7",
      hypothesisId: "H2",
      location: "proposalReviewController.completePeerReview",
      message: "complete peer after save",
      data: {
        proposalId: String(proposal._id),
        docTier: proposal.programTier || null,
        reqTier: req.programTier || null,
        savedPeer: pipe.peerReview?.status || null,
        dbPeer: fresh?.reviewPipeline?.peerReview?.status || null,
        peerReviewCount: reviews.length,
        currentStage: getCurrentReviewStage(fresh || proposal),
      },
      timestamp: Date.now(),
      runId: "complete-debug",
    };
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) { /* debug */ }
  // #endregion

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

  const pipe = ensureReviewPipeline(proposal);
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

  if (committeeStatus === STAGE_STATUS.PASSED) {
    try {
      const { notifyFinanceProposalReviewReady } = require("../utils/notifyFinanceProposalReview");
      const sent = await notifyFinanceProposalReviewReady(proposal, { force: true });
      // #region agent log
      try {
        const fs = require("fs");
        const path = require("path");
        const payload = {
          sessionId: "f558f7",
          hypothesisId: "F1",
          location: "proposalReviewController.committeeReview",
          message: "finance notify after committee pass",
          data: { proposalId: String(proposal._id), sent, programTier: proposal.programTier || null },
          timestamp: Date.now(),
          runId: "post-fix",
        };
        fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
      } catch (_) { /* debug */ }
      // #endregion
    } catch {
      /* best-effort */
    }
  }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const payload = {
      sessionId: "f558f7",
      hypothesisId: "H2",
      location: "proposalReviewController.committeeReview",
      message: "committee after save",
      data: {
        proposalId: String(proposal._id),
        decision,
        savedCommitteeStatus: pipe.committeeReview?.status,
        peerStatus: pipe.peerReview?.status,
        role: req.user.role,
        programTier: req.programTier || null,
      },
      timestamp: Date.now(),
      runId: "pre-fix",
    };
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) { /* debug */ }
  // #endregion

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

  const pipe = ensureReviewPipeline(proposal);
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
  const proposals = await Proposal.find(
    req.tierWhere({
      "assignedReviewers.userId": userId,
      status: {
        $nin: [PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REJECTED],
      },
    })
  )
    .sort({ submittedAt: -1 })
    .select("title status department submittedAt assignedReviewers peerReviews reviewPipeline");

  const items = proposals.map((p) => {
    const reviewed = (p.peerReviews || []).some((r) => String(r.userId) === String(userId));
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

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const line = `${JSON.stringify({
      sessionId: "f558f7",
      runId: "peer-assign",
      hypothesisId: "PA1",
      location: "proposalReviewController.listMyReviewAssignments",
      message: "review assignments listed",
      data: {
        role: req.user.role,
        userId: String(userId),
        programTier: req.programTier,
        count: items.length,
        pending: items.filter((i) => !i.peerReviewSubmitted).length,
        sample: items.slice(0, 5).map((i) => ({ id: String(i.id), title: i.title, status: i.status })),
      },
      timestamp: Date.now(),
    })}\n`;
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
  } catch {
    /* ignore */
  }
  // #endregion

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
