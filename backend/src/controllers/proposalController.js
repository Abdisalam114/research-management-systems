const fs = require("fs");
const path = require("path");
const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { User } = require("../models/User");
const { EthicsApplication } = require("../models/EthicsApplication");
const { AppError } = require("../utils/AppError");
const { notifyUsersByRole } = require("../utils/notify");
const {
  getEthicsForProposal,
  assertEthicsReadyForProposalSubmit,
  assertEthicsApprovedForDirectorApproval,
  isEthicsFormComplete,
  submitLinkedEthics,
} = require("../utils/proposalEthicsLink");
const { applyEthicsPayload, parseEthicsJson } = require("../utils/ethicsFormMerge");
const { ensureReviewPipeline, assertStagesBeforeDirector, getCurrentReviewStage, defaultReviewPipeline, STAGE_STATUS } = require("../utils/proposalReviewPipeline");
const { recordAudit } = require("../utils/audit");

function sanitizeProposal(p) {
  const researcher = p.researcherId;
  return {
    id: p._id,
    title: p.title,
    abstract: p.abstract,
    department: p.department,
    researchArea: p.researchArea,
    document: p.document,
    version: p.version,
    versionHistory: p.versionHistory || [],
    researcherId: researcher?._id ? researcher._id : researcher,
    researcherName: researcher?.fullName || null,
    status: p.status,
    requiresEthics: p.requiresEthics !== false,
    ethicsStatus: p.ethicsStatus,
    ethicsComments: p.ethicsComments || [],
    ethicsApplicationId: p.ethicsApplicationId,
    assignedReviewers: p.assignedReviewers || [],
    reviewerComments: p.reviewerComments,
    peerReviews: p.peerReviews || [],
    reviewPipeline: ensureReviewPipeline(p),
    currentReviewStage: getCurrentReviewStage(p),
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
  return proposal.ethicsStatus !== ETHICS_STATUSES.APPROVED;
}

async function attachEthicsSummary(proposal) {
  const base = sanitizeProposal(proposal);
  const ethics = await getEthicsForProposal(proposal._id);
  if (!ethics) {
    return {
      ...base,
      ethicsApplication: null,
      ethicsFormComplete: false,
    };
  }
  return {
    ...base,
    ethicsApplication: {
      id: ethics._id,
      status: ethics.status,
      projectTitle: ethics.projectTitle,
      formComplete: isEthicsFormComplete(ethics),
    },
    ethicsFormComplete: isEthicsFormComplete(ethics),
  };
}

async function createLinkedEthicsApplication(proposal, user) {
  const parts = (user.fullName || "").trim().split(/\s+/);
  const defaultLevel =
    proposal.programTier === "undergraduate" ? "undergraduate" : "";
  const ethics = await EthicsApplication.create({
    proposalId: proposal._id,
    researcherId: proposal.researcherId,
    programTier: proposal.programTier,
    projectTitle: proposal.title,
    projectLevel: defaultLevel,
    aimsObjectives: proposal.abstract || "",
    status: "draft",
    principal: {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      email: user.email || "",
      department: user.department || proposal.department || "",
    },
    applicantSignature: { name: user.fullName || "" },
  });
  proposal.ethicsApplicationId = ethics._id;
  await proposal.save();
  return ethics;
}

async function persistProposalEthics(proposal, user, reqBody) {
  if (!proposal.requiresEthics) return;
  let ethics = await getEthicsForProposal(proposal._id);
  if (!ethics) {
    ethics = await createLinkedEthicsApplication(proposal, user || {});
  }
  const parsed = parseEthicsJson(reqBody);
  if (parsed) {
    applyEthicsPayload(ethics, parsed);
  } else {
    ethics.projectTitle = proposal.title;
    if (proposal.department) ethics.principal = { ...(ethics.principal || {}), department: proposal.department };
  }
  await ethics.save();
  // #region agent log
  try {
    const logPath = path.join(process.cwd(), "debug-15a9cf.log");
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({
        sessionId: "15a9cf",
        location: "proposalController.js:persistProposalEthics",
        message: "ethics persisted",
        data: {
          proposalId: String(proposal._id),
          hasProjectTitle: Boolean(String(ethics.projectTitle || "").trim()),
          hasPiFirst: Boolean(String(ethics.principal?.firstName || "").trim()),
          hasPiLast: Boolean(String(ethics.principal?.lastName || "").trim()),
          hasProjectLevel: Boolean(String(ethics.projectLevel || "").trim()),
          hasAims: Boolean(String(ethics.aimsObjectives || "").trim()),
          hasDesign: Boolean(String(ethics.design || "").trim()),
          hasSignature: Boolean(String(ethics.applicantSignature?.name || "").trim()),
          formComplete: isEthicsFormComplete(ethics),
        },
        timestamp: Date.now(),
        hypothesisId: "E",
        runId: "pre-fix",
      })}\n`
    );
  } catch {
    /* ignore log errors */
  }
  // #endregion
}

async function createProposal(req, res) {
  const { title, abstract, department, researchArea, requiresEthics } = req.body;
  if (!title || !abstract || !department || !researchArea) {
    throw new AppError("title, abstract, department, and researchArea are required", 400);
  }

  const document = req.file ? `/uploads/${req.file.filename}` : null;
  const needsEthics = requiresEthics !== "false" && requiresEthics !== false;

  const proposal = await Proposal.create(req.tierAssign({
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
  }));

  if (needsEthics) {
    const user = await User.findById(req.user.id);
    await persistProposalEthics(proposal, user || {}, req.body);
  }

  res.status(201).json({ proposal: await attachEthicsSummary(proposal) });
}

async function updateProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
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

  if (title && proposal.ethicsApplicationId) {
    await EthicsApplication.updateOne(
      { _id: proposal.ethicsApplicationId },
      { $set: { projectTitle: title } }
    );
  }
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

  const user = await User.findById(req.user.id);
  await persistProposalEthics(proposal, user || {}, req.body);

  res.json({ proposal: await attachEthicsSummary(proposal) });
}

async function getProposalEthicsApplication(req, res) {
  const proposal = await Proposal.findOne(req.tierWhere({ _id: req.params.id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const isOwner = String(proposal.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  let ethics = await getEthicsForProposal(proposal._id);
  if (!ethics && isOwner && proposal.requiresEthics) {
    const user = await User.findById(req.user.id);
    ethics = await createLinkedEthicsApplication(proposal, user || {});
  }

  if (!ethics) {
    return res.json({ application: null });
  }

  res.json({
    application: {
      id: ethics._id,
      status: ethics.status,
      projectTitle: ethics.projectTitle,
      principal: ethics.principal,
      coResearcher: ethics.coResearcher,
      otherInvestigators: ethics.otherInvestigators,
      projectLevel: ethics.projectLevel,
      startDate: ethics.startDate,
      endDate: ethics.endDate,
      backgroundLiterature: ethics.backgroundLiterature,
      aimsObjectives: ethics.aimsObjectives,
      rationale: ethics.rationale,
      design: ethics.design,
      subjectTypes: ethics.subjectTypes,
      subjectTypesSpecify: ethics.subjectTypesSpecify,
      inclusionCriteria: ethics.inclusionCriteria,
      exclusionCriteria: ethics.exclusionCriteria,
      risk: ethics.risk,
      riskPrecautions: ethics.riskPrecautions,
      settings: ethics.settings,
      instruments: ethics.instruments,
      instrumentsOther: ethics.instrumentsOther,
      dataCollectionDate: ethics.dataCollectionDate,
      sampleSize: ethics.sampleSize,
      dataHandling: ethics.dataHandling,
      fundingSource: ethics.fundingSource,
      consent: ethics.consent,
      dataSafety: ethics.dataSafety,
      privacy: ethics.privacy,
      conflictOfInterest: ethics.conflictOfInterest,
      applicantSignature: ethics.applicantSignature,
      approval: ethics.approval,
      proposalId: ethics.proposalId,
      formComplete: isEthicsFormComplete(ethics),
    },
  });
}

async function submitProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (String(proposal.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
    throw new AppError("Proposal cannot be submitted in its current status", 400);
  }

  if (proposal.requiresEthics) {
    try {
      const ethics = await assertEthicsReadyForProposalSubmit(proposal);
      await submitLinkedEthics(ethics);
    } catch (e) {
      throw new AppError(e.message, 400);
    }
  }

  if (proposal.status === PROPOSAL_STATUSES.REVISION_REQUESTED) {
    pushVersionHistory(proposal, "Submitted after revision");
    proposal.version += 1;
  }

  proposal.status = PROPOSAL_STATUSES.SUBMITTED;
  proposal.submittedAt = new Date();
  proposal.reviewPipeline = defaultReviewPipeline();
  await proposal.save();

  try {
    await notifyUsersByRole("research_director", {
      type: "proposal",
      title: proposal.requiresEthics
        ? "Proposal + ethics form submitted for review"
        : "Proposal submitted for director review",
      body: proposal.title,
      link: `/proposals/${proposal._id}/review`,
    }, req.programTier);
  } catch {
    /* notifications best-effort */
  }

  res.json({
    message: proposal.requiresEthics
      ? "Proposal and ethics form submitted to Director"
      : "Proposal submitted to Director",
    proposal: await attachEthicsSummary(proposal),
  });
}

async function listProposals(req, res) {
  const { role } = req.user;
  const { scope } = req.query || {};

  if (role === "researcher") {
    const proposals = await Proposal.find(req.tierWhere({ researcherId: req.user.id }))
      .populate("researcherId", "fullName email department")
      .sort({ createdAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  if (scope === "all" && role === "research_director") {
    const proposals = await Proposal.find(req.tierWhere({}))
      .populate("researcherId", "fullName email department")
      .sort({ updatedAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  const proposals = await Proposal.find(req.tierWhere({
    status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED] },
  }))
    .populate("researcherId", "fullName email department")
    .sort({ submittedAt: -1, createdAt: -1 });

  res.json({ proposals: proposals.map(sanitizeProposal) });
}

async function getProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findOne(req.tierWhere({ _id: id })).populate("assignedReviewers.userId", "fullName email role department");
  if (!proposal) throw new AppError("Proposal not found", 404);

  const isOwner = String(proposal.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ proposal: await attachEthicsSummary(proposal) });
}

async function coordinatorReview(req, res) {
  const { id } = req.params;
  const { action, comment } = req.body;
  if (!comment) throw new AppError("comment is required", 400);
  if (!["recommend_revision", "recommend_approval"].includes(action)) {
    throw new AppError("Invalid action", 400);
  }

  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW].includes(proposal.status)) {
    throw new AppError("Proposal is not reviewable in its current status", 400);
  }

  proposal.status = PROPOSAL_STATUSES.UNDER_REVIEW;
  proposal.reviewerComments.push({ role: "faculty_coordinator", comment });
  const pipe = ensureReviewPipeline(proposal);
  if (pipe.adminScreening.status === "pending") {
    pipe.adminScreening = {
      status: action === "recommend_approval" ? "passed" : "in_progress",
      completedAt: new Date(),
      completedBy: req.user.id,
      comment,
    };
  }
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

  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW].includes(proposal.status)) {
    throw new AppError("Proposal is not decision-ready in its current status", 400);
  }

  if (decision === PROPOSAL_STATUSES.APPROVED) {
    const pipe = ensureReviewPipeline(proposal);
    const pipelineStarted = [pipe.adminScreening, pipe.peerReview, pipe.committeeReview, pipe.financeReview].some(
      (s) => s.status !== STAGE_STATUS.PENDING
    );
    if (pipelineStarted) {
      try {
        assertStagesBeforeDirector(proposal);
      } catch (e) {
        throw new AppError(e.message, e.statusCode || 400);
      }
    }
  }

  if (decision === PROPOSAL_STATUSES.APPROVED && proposal.requiresEthics) {
    try {
      await assertEthicsApprovedForDirectorApproval(proposal);
    } catch (e) {
      throw new AppError(e.message, 400);
    }
  } else if (decision === PROPOSAL_STATUSES.APPROVED && ethicsBlocksSubmission(proposal)) {
    throw new AppError("Ethics must be approved before final proposal decision", 400);
  }

  proposal.status = decision;
  proposal.reviewerComments.push({ role: "research_director", comment });
  await proposal.save();

  await recordAudit({
    entityType: "proposal",
    entityId: proposal._id,
    action: decision === PROPOSAL_STATUSES.APPROVED ? "director_approved" : decision,
    label: `Director decision: ${decision}`,
    detail: proposal.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  if (decision === PROPOSAL_STATUSES.APPROVED) {
    const existing = await Project.findOne(req.tierWhere({ proposalId: proposal._id }));
    if (!existing) {
      await Project.create(req.tierAssign({
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
      }));
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

  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
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

  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }));
  if (!proposal) throw new AppError("Proposal not found", 404);

  const users = await User.find(req.tierWhere({ _id: { $in: reviewerIds }, status: "active" }));
  if (users.length !== reviewerIds.length) throw new AppError("One or more reviewers not found", 400);

  proposal.assignedReviewers = reviewerIds.map((userId) => ({
    userId,
    assignedBy: req.user.id,
    assignedAt: new Date(),
  }));
  ensureReviewPipeline(proposal);
  await proposal.save();

  res.json({ message: "Reviewers assigned", proposal: sanitizeProposal(proposal) });
}

module.exports = {
  createProposal,
  updateProposal,
  submitProposal,
  listProposals,
  getProposal,
  getProposalEthicsApplication,
  coordinatorReview,
  directorDecision,
  ethicsDecision,
  assignReviewers,
};
