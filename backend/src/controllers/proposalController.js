const fs = require("fs");
const path = require("path");
const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES, PROPOSAL_KINDS } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { User, ROLES } = require("../models/User");
const { EthicsApplication } = require("../models/EthicsApplication");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { AppError } = require("../utils/AppError");
const { assertEligibleForCall } = require("../utils/fundingCallEligibility");
const { notifyUsersByRole, notifyUser } = require("../utils/notify");
const {
  getEthicsForProposal,
  assertEthicsReadyForProposalSubmit,
  assertEthicsApprovedForDirectorApproval,
  isEthicsFormComplete,
  submitLinkedEthics,
} = require("../utils/proposalEthicsLink");
const { applyEthicsPayload, parseEthicsJson } = require("../utils/ethicsFormMerge");
const { ensureReviewPipeline, getCurrentReviewStage, defaultReviewPipeline, STAGE_STATUS, isVoluntaryProposal } = require("../utils/proposalReviewPipeline");
const { recordAudit } = require("../utils/audit");

function resolveProposalKind(doc) {
  if (doc.proposalKind && Object.values(PROPOSAL_KINDS).includes(doc.proposalKind)) {
    return doc.proposalKind;
  }
  return doc.fundingCallId ? PROPOSAL_KINDS.GRANT_FUND_CALL : PROPOSAL_KINDS.VOLUNTARY;
}

function refId(ref) {
  if (ref == null) return null;
  if (typeof ref === "object") return String(ref._id || ref.id || "");
  return String(ref);
}

function sanitizeAssignedReviewers(list = []) {
  return (list || []).map((r) => ({
    userId: refId(r.userId),
    fullName: r.userId?.fullName || r.fullName || null,
    email: r.userId?.email || r.email || null,
    assignedBy: refId(r.assignedBy),
    assignedAt: r.assignedAt,
  }));
}

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
    budgetBreakdown: p.budgetBreakdown || [],
    budgetTotal: p.budgetTotal || 0,
    budgetCurrency: p.budgetCurrency || "USD",
    complianceDocuments: p.complianceDocuments || [],
    supportingDocuments: p.supportingDocuments || [],
    researcherId: researcher?._id ? researcher._id : researcher,
    researcherName: researcher?.fullName || null,
    status: p.status,
    requiresEthics: p.requiresEthics !== false,
    ethicsStatus: p.ethicsStatus,
    ethicsComments: p.ethicsComments || [],
    ethicsApplicationId: p.ethicsApplicationId,
    assignedReviewers: sanitizeAssignedReviewers(p.assignedReviewers),
    reviewerComments: p.reviewerComments,
    peerReviews: (p.peerReviews || []).map((r) => ({
      userId: refId(r.userId),
      reviewerName: r.userId?.fullName || null,
      reviewerEmail: r.userId?.email || null,
      score: r.score,
      comment: r.comment || "",
      at: r.at,
    })),
    reviewPipeline: ensureReviewPipeline(p),
    currentReviewStage: getCurrentReviewStage(p),
    proposalKind: resolveProposalKind(p),
    fundingCallId: p.fundingCallId?._id
      ? String(p.fundingCallId._id)
      : p.fundingCallId || null,
    fundingCall: p.fundingCallId?._id
      ? {
          id: String(p.fundingCallId._id),
          title: p.fundingCallId.title || "",
          status: p.fundingCallId.status || null,
        }
      : null,
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
  const voluntary =
    proposal.proposalKind === PROPOSAL_KINDS.VOLUNTARY ||
    (!proposal.fundingCallId && proposal.proposalKind !== PROPOSAL_KINDS.GRANT_FUND_CALL);
  if (voluntary) {
    ethics.fundingSource = "";
    ethics.conflictOfInterest = {
      ...(ethics.conflictOfInterest || {}),
      financialHas: false,
      financialDescription: "",
    };
    if (ethics.consent?.items) {
      ethics.consent.items = ethics.consent.items.filter(
        (v) => v !== "compensation" && v !== "cost_reimbursement"
      );
    }
  }
  await ethics.save();
}

function parseJsonField(raw, fallback = null) {
  if (raw == null || raw === "") return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function applyProposalDocuments(proposal, req) {
  const complianceMeta = parseJsonField(req.body?.complianceMeta, null);
  const supportingMeta = parseJsonField(req.body?.supportingMeta, null);
  if (complianceMeta === null && supportingMeta === null) return;

  const complianceFiles = req.files?.complianceFiles || [];
  const supportingFiles = req.files?.supportingFiles || [];
  const singleDoc = req.files?.document?.[0] || req.file;

  if (singleDoc && !proposal.document) {
    proposal.document = `/uploads/${singleDoc.filename}`;
  }

  if (Array.isArray(complianceMeta)) {
    proposal.complianceDocuments = complianceMeta.map((m, idx) => ({
      docType: String(m.docType || "compliance").trim(),
      label: String(m.label || m.docType || "Compliance document").trim(),
      filePath: complianceFiles[idx] ? `/uploads/${complianceFiles[idx].filename}` : m.filePath || null,
      uploadedAt: complianceFiles[idx] || m.filePath ? new Date() : m.uploadedAt || null,
    }));
  }

  if (Array.isArray(supportingMeta)) {
    proposal.supportingDocuments = supportingMeta.map((m, idx) => ({
      docType: String(m.docType || "other").trim(),
      label: String(m.label || "Supporting document").trim(),
      filePath: supportingFiles[idx] ? `/uploads/${supportingFiles[idx].filename}` : m.filePath || null,
      uploadedAt: supportingFiles[idx] || m.filePath ? new Date() : m.uploadedAt || null,
    }));
  }
}

async function createProposal(req, res) {
  const { title, abstract, researchArea, requiresEthics, fundingCallId, proposalKind } = req.body;
  const department = String(req.body.department || req.user.department || "").trim();
  if (!title || !abstract || !department || !researchArea) {
    throw new AppError("title, abstract, department, and researchArea are required", 400);
  }

  const document = req.files?.document?.[0] ? `/uploads/${req.files.document[0].filename}` : (req.file ? `/uploads/${req.file.filename}` : null);
  const needsEthics = requiresEthics !== "false" && requiresEthics !== false;

  const requestedKind = String(proposalKind || "").trim();
  const wantsGrantCall = Boolean(fundingCallId) || requestedKind === PROPOSAL_KINDS.GRANT_FUND_CALL;

  let linkedCallId = null;
  let kind = PROPOSAL_KINDS.VOLUNTARY;

  if (wantsGrantCall) {
    if (!fundingCallId) {
      throw new AppError(
        "Grant fund call proposals can only be created from an open Funding Call. Open Funding Calls and apply there.",
        400
      );
    }
    const call = await FundingCall.findOne(req.tierWhere({ _id: fundingCallId, status: CALL_STATUSES.OPEN }));
    if (!call) throw new AppError("Funding call not found or not open", 404);
    if (req.user.role === ROLES.RESEARCHER) assertEligibleForCall(req, call);
    linkedCallId = call._id;
    kind = PROPOSAL_KINDS.GRANT_FUND_CALL;
  } else {
    // Voluntary path: research only, no funding — must not carry a funding call id
    if (fundingCallId) {
      throw new AppError("Voluntary proposals cannot be linked to a funding call", 400);
    }
    kind = PROPOSAL_KINDS.VOLUNTARY;
  }

  const proposal = await Proposal.create(req.tierAssign({
    title,
    abstract,
    department,
    researchArea,
    document,
    budgetBreakdown: [],
    budgetTotal: 0,
    budgetCurrency: "USD",
    researcherId: req.user.id,
    status: PROPOSAL_STATUSES.DRAFT,
    version: 1,
    requiresEthics: needsEthics,
    ethicsStatus: needsEthics ? ETHICS_STATUSES.PENDING : ETHICS_STATUSES.NOT_REQUIRED,
    proposalKind: kind,
    fundingCallId: linkedCallId,
    reviewPipeline: defaultReviewPipeline({ skipFinance: kind === PROPOSAL_KINDS.VOLUNTARY }),
  }));

  applyProposalDocuments(proposal, req);
  if (proposal.complianceDocuments?.length || proposal.supportingDocuments?.length) {
    await proposal.save();
  }

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

  applyProposalDocuments(proposal, req);

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

  if (req.files?.document?.[0]) {
    pushVersionHistory(proposal, "Document replaced before resubmit");
    proposal.document = `/uploads/${req.files.document[0].filename}`;
  } else if (req.file) {
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
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer"].includes(req.user.role);
  const isAssignedReviewer = (proposal.assignedReviewers || []).some(
    (r) => refId(r.userId) === String(req.user.id)
  );
  if (!isOwner && !isStaff && !isAssignedReviewer) throw new AppError("Forbidden", 403);

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
  proposal.reviewPipeline = defaultReviewPipeline({
    skipFinance:
      proposal.proposalKind === PROPOSAL_KINDS.VOLUNTARY ||
      (!proposal.fundingCallId && proposal.proposalKind !== PROPOSAL_KINDS.GRANT_FUND_CALL),
  });
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
    if (proposal.requiresEthics) {
      await notifyUsersByRole("research_director", {
        type: "ethics",
        title: "Proposal ethics ready for director review",
        body: proposal.title,
        link: proposal.ethicsApplicationId
          ? `/ethics?applicationId=${proposal.ethicsApplicationId}`
          : "/ethics",
      }, req.programTier);
    }
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
  const { scope, grantFundCall } = req.query || {};

  // Funding-call proposals (all statuses) — used by Funding Calls page so accepted ones stay visible
  if (grantFundCall === "1" || grantFundCall === "true") {
    const filter = {
      $or: [
        { fundingCallId: { $ne: null } },
        { proposalKind: PROPOSAL_KINDS.GRANT_FUND_CALL },
      ],
    };
    if (role === "researcher") filter.researcherId = req.user.id;
    else if (
      ![
        "research_director",
        "faculty_coordinator",
        "finance_officer",
        "leadership",
        "donor_agency",
      ].includes(role)
    ) {
      throw new AppError("Forbidden", 403);
    }

    const proposals = await Proposal.find(req.tierWhere(filter))
      .populate("researcherId", "fullName email department")
      .populate("fundingCallId", "title status deadline")
      .sort({ updatedAt: -1 });

    // #region agent log
    try {
      const line = `${JSON.stringify({
        sessionId: "f558f7",
        runId: "accepted-visibility",
        hypothesisId: "H4",
        location: "proposalController.listProposals",
        message: "grant fund call proposals listed",
        data: {
          role,
          count: proposals.length,
          approved: proposals.filter((p) => p.status === "approved").length,
          sample: proposals.slice(0, 5).map((p) => ({
            id: String(p._id),
            title: p.title,
            status: p.status,
            callId: p.fundingCallId?._id ? String(p.fundingCallId._id) : p.fundingCallId,
          })),
        },
        timestamp: Date.now(),
      })}\n`;
      fs.appendFileSync(path.join(__dirname, "../../../debug-f558f7.log"), line);
    } catch {
      /* ignore */
    }
    // #endregion

    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  if (role === "researcher") {
    const proposals = await Proposal.find(req.tierWhere({ researcherId: req.user.id }))
      .populate("researcherId", "fullName email department")
      .populate("fundingCallId", "title status deadline")
      .sort({ createdAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  if (role === "leadership") {
    const proposals = await Proposal.find(
      req.tierWhere({
        "assignedReviewers.userId": req.user.id,
        status: {
          $in: [
            PROPOSAL_STATUSES.SUBMITTED,
            PROPOSAL_STATUSES.UNDER_REVIEW,
            PROPOSAL_STATUSES.REVISION_REQUESTED,
            PROPOSAL_STATUSES.APPROVED,
          ],
        },
      })
    )
      .populate("researcherId", "fullName email department")
      .populate("fundingCallId", "title status deadline")
      .sort({ submittedAt: -1, createdAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  if (scope === "all" && role === "research_director") {
    const proposals = await Proposal.find(req.tierWhere({}))
      .populate("researcherId", "fullName email department")
      .populate("fundingCallId", "title status deadline")
      .sort({ updatedAt: -1 });
    res.json({ proposals: proposals.map(sanitizeProposal) });
    return;
  }

  const proposals = await Proposal.find(req.tierWhere({
    status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED] },
  }))
    .populate("researcherId", "fullName email department")
    .populate("fundingCallId", "title status deadline")
    .sort({ submittedAt: -1, createdAt: -1 });

  res.json({ proposals: proposals.map(sanitizeProposal) });
}

async function getProposal(req, res) {
  const { id } = req.params;
  const proposal = await Proposal.findOne(req.tierWhere({ _id: id }))
    .populate("assignedReviewers.userId", "fullName email role department")
    .populate("peerReviews.userId", "fullName email role");
  if (!proposal) throw new AppError("Proposal not found", 404);

  const isOwner = String(proposal.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer"].includes(req.user.role);
  const isAssignedReviewer = (proposal.assignedReviewers || []).some(
    (r) => refId(r.userId) === String(req.user.id)
  );
  if (!isOwner && !isStaff && !isAssignedReviewer) throw new AppError("Forbidden", 403);

  // #region agent log
  try {
    const p = require("path");
    const fs = require("fs");
    const line = `${JSON.stringify({ sessionId: "f558f7", hypothesisId: "H1", location: "proposalController.getProposal", message: "proposal access ok", data: { role: req.user.role, proposalId: String(id) }, timestamp: Date.now() })}\n`;
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", ".cursor", "debug-f558f7.log"), line);
  } catch (_) { /* debug */ }
  // #endregion

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
  if (![PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
    throw new AppError("Proposal is not decision-ready in its current status", 400);
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

  // Soft-pass incomplete oversight stages after ethics clearance so Director can create the project.
  // Never soft-pass a FAILED stage.
  if (decision === PROPOSAL_STATUSES.APPROVED) {
    const pipe = ensureReviewPipeline(proposal);
    const criticalStages = [pipe.adminScreening, pipe.peerReview, pipe.committeeReview];
    if (!isVoluntaryProposal(proposal)) criticalStages.push(pipe.financeReview);
    const failed = criticalStages.filter((s) => s?.status === STAGE_STATUS.FAILED);
    if (failed.length) {
      throw new AppError(
        "Cannot approve: a review stage failed. Request revision or reject the proposal.",
        400
      );
    }
    // #region agent log
    try {
      const fs = require("fs");
      const path = require("path");
      fs.appendFileSync(
        path.join(process.cwd(), "..", ".cursor", "debug-f558f7.log"),
        `${JSON.stringify({
          sessionId: "f558f7",
          hypothesisId: "L1",
          location: "proposalController.js:directorDecision",
          message: "soft-pass check",
          data: {
            voluntary: isVoluntaryProposal(proposal),
            stageStatuses: criticalStages.map((s) => s?.status),
            blockedFailed: false,
          },
          timestamp: Date.now(),
          runId: "post-fix",
        })}\n`
      );
    } catch { /* ignore */ }
    // #endregion
  }

  proposal.status = decision;
  proposal.reviewerComments.push({ role: "research_director", comment });
  // Keep proposal.ethicsStatus in sync if ethics app is approved
  if (decision === PROPOSAL_STATUSES.APPROVED && proposal.requiresEthics) {
    const ethicsDoc = await getEthicsForProposal(proposal._id);
    if (ethicsDoc?.status === "approved") {
      proposal.ethicsStatus = ETHICS_STATUSES.APPROVED;
    }
  }
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
      const project = await Project.create(req.tierAssign({
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
      try {
        await notifyUser(proposal.researcherId, {
          type: "proposal",
          title: "Proposal approved — project created",
          body: proposal.title,
          link: `/projects/${project._id}`,
          programTier: proposal.programTier,
        });
      } catch { /* best-effort */ }
    }

    // Fund-call proposal accepted → queue money for Finance + close the call
    if (proposal.fundingCallId) {
      try {
        const { ensurePendingFinanceGrantFromProposal } = require("../utils/ensurePendingFinanceGrantFromProposal");
        await ensurePendingFinanceGrantFromProposal(proposal, { notify: true });
      } catch { /* best-effort */ }
      try {
        const { closeCallAfterGrantAccepted } = require("../utils/fundingCallAutoClose");
        await closeCallAfterGrantAccepted(proposal.fundingCallId, {
          actorId: req.user.id,
          actorRole: req.user.role,
          programTier: req.programTier,
          grantTitle: proposal.title,
        });
      } catch { /* best-effort */ }
    }
  }

  const populated = await Proposal.findById(proposal._id).populate("fundingCallId", "title status deadline");
  res.json({ message: "Decision saved", proposal: sanitizeProposal(populated || proposal) });
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
  const notLeadership = users.filter((u) => u.role !== "leadership");
  if (notLeadership.length) {
    throw new AppError("Peer reviewers must be University Leadership accounts", 400);
  }

  const prevIds = new Set((proposal.assignedReviewers || []).map((r) => String(r.userId)));
  proposal.assignedReviewers = reviewerIds.map((userId) => ({
    userId,
    assignedBy: req.user.id,
    assignedAt: new Date(),
  }));
  const pipe = ensureReviewPipeline(proposal);
  // Unlock peer review for assignees: advance screening if still pending
  if (pipe.adminScreening?.status === "pending" || pipe.adminScreening?.status === "in_progress") {
    pipe.adminScreening = {
      status: STAGE_STATUS.PASSED,
      completedAt: new Date(),
      completedBy: req.user.id,
      comment: pipe.adminScreening?.comment || "Passed when peer reviewers were assigned",
    };
  }
  if ([PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
    proposal.status = PROPOSAL_STATUSES.UNDER_REVIEW;
  }
  await proposal.save();

  const newlyAssigned = users.filter((u) => !prevIds.has(String(u._id)));
  const toNotify = newlyAssigned.length ? newlyAssigned : users;
  let notified = 0;
  for (const u of toNotify) {
    try {
      await notifyUser(u._id, {
        type: "proposal",
        title: "Peer review assignment",
        body: `You were assigned to review: ${proposal.title}`,
        link: `/review-assignments`,
        programTier: req.programTier,
      });
      notified += 1;
    } catch (_) {
      /* best-effort */
    }
  }
  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const line = `${JSON.stringify({
      sessionId: "f558f7",
      runId: "peer-assign",
      hypothesisId: "PA2",
      location: "proposalController.assignReviewers",
      message: "reviewers assigned",
      data: {
        proposalId: String(proposal._id),
        title: proposal.title,
        status: proposal.status,
        programTier: req.programTier,
        reviewerIds: users.map((u) => ({ id: String(u._id), email: u.email, role: u.role })),
        notified,
      },
      timestamp: Date.now(),
    })}\n`;
    fs.appendFileSync(path.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
  } catch {
    /* ignore */
  }
  // #endregion
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
