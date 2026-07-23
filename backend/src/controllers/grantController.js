const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Project } = require("../models/Project");
const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { AppError } = require("../utils/AppError");
const { ensureBudgetForGrant } = require("../utils/ensureBudgetForGrant");
const { ensureProjectForAcceptedGrant } = require("../utils/ensureProjectForAcceptedGrant");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");

const { normalizeBudgetBreakdown } = require("../utils/budgetBreakdown");
const { assertEligibleForCall, findOpenEligibleCall } = require("../utils/fundingCallEligibility");
const { buildRequirementChecklist, assertRequirementsMet } = require("../utils/fundingCallRequirements");
const { closeExpiredOpenCalls, closeCallAfterGrantAccepted } = require("../utils/fundingCallAutoClose");
const { ROLES } = require("../models/User");
const { canViewProjectAwards } = require("../utils/researchJourney");

async function redactGrantAwardsIfNeeded(out, req) {
  if (!out?.amountAwarded) return out;
  if (["research_director", "finance_officer", "donor_agency", "leadership"].includes(req.user.role)) {
    return out;
  }
  const projectId = out.projectId;
  if (!projectId) {
    out.amountAwarded = null;
    out.awardsHidden = true;
    return out;
  }
  const hasPub = await Publication.exists(
    req.tierWhere({
      projectId,
      status: { $in: [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED] },
    })
  );
  const canView = canViewProjectAwards({
    role: req.user.role,
    hasProjectPublication: Boolean(hasPub),
  });
  if (!canView) {
    out.amountAwarded = null;
    out.awardsHidden = true;
  }
  return out;
}

function parseBudgetField(body) {
  if (!body?.budgetBreakdown) return null;
  if (typeof body.budgetBreakdown === "string") {
    try {
      return normalizeBudgetBreakdown(JSON.parse(body.budgetBreakdown));
    } catch {
      return null;
    }
  }
  return normalizeBudgetBreakdown(body.budgetBreakdown);
}

function sanitizeFundingCallSummary(callRef) {
  if (!callRef?._id) return null;
  return {
    id: callRef._id,
    title: callRef.title,
    status: callRef.status,
    fundingSource: callRef.fundingSource,
    callType: callRef.callType,
    amountCap: callRef.amountCap,
    currency: callRef.currency,
    deadline: callRef.deadline,
    requiredDocuments: callRef.requiredDocuments || "",
    eligibilityTier: callRef.eligibilityTier,
  };
}

function sanitizeProposalSummary(proposalRef) {
  if (!proposalRef?._id) return null;
  return {
    id: proposalRef._id,
    title: proposalRef.title,
    status: proposalRef.status,
    ethicsStatus: proposalRef.ethicsStatus,
    requiresEthics: proposalRef.requiresEthics !== false,
    fundingCallId: proposalRef.fundingCallId || null,
  };
}

function sanitizeGrant(g) {
  const researcherRef = g.researcherId;
  const projectRef = g.projectId;
  const callRef = g.callId;
  const proposalRef = g.proposalId;
  const out = {
    id: g._id,
    title: g.title,
    fundingSource: g.fundingSource,
    donorRef: g.donorRef,
    currency: g.currency,
    amountRequested: g.amountRequested,
    amountAwarded: g.amountAwarded,
    status: g.status,
    complianceNotes: g.complianceNotes,
    researcherId: researcherRef?._id ? String(researcherRef._id) : researcherRef,
    projectId: projectRef?._id ? String(projectRef._id) : projectRef || null,
    proposalId: proposalRef?._id ? String(proposalRef._id) : proposalRef || null,
    callId: callRef?._id ? String(callRef._id) : callRef || null,
    requirementChecklist: g.requirementChecklist || [],
    financeApprovedAt: g.financeApprovedAt,
    financeComment: g.financeComment,
    submittedAt: g.submittedAt,
    decidedAt: g.decidedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    programTier: g.programTier,
    budgetBreakdown: g.budgetBreakdown || [],
    budgetTotal: g.budgetTotal || 0,
  };
  if (projectRef?._id) out.project = sanitizeProjectSummary(projectRef);
  if (callRef?._id) out.fundingCall = sanitizeFundingCallSummary(callRef);
  if (proposalRef?._id) out.proposal = sanitizeProposalSummary(proposalRef);
  return out;
}

async function resolveGrantProjectId(req, projectId, researcherId) {
  if (!projectId) return null;
  const project = await Project.findOne(req.tierWhere({ _id: projectId, researcherId }));
  if (!project) throw new AppError("Research project not found or does not belong to you", 404);
  return project._id;
}

async function resolveGrantProposalId(req, proposalId, researcherId, call) {
  if (!proposalId) throw new AppError("A research proposal is required for funding call applications", 400);
  const proposal = await Proposal.findOne(req.tierWhere({ _id: proposalId, researcherId }));
  if (!proposal) throw new AppError("Research proposal not found or does not belong to you", 404);

  const kind = proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary");
  if (kind === "voluntary" || !proposal.fundingCallId) {
    throw new AppError(
      "Voluntary proposals cannot be used for funding calls. Create a Grant Fund Call proposal from Funding Calls only.",
      400
    );
  }
  if (call && String(proposal.fundingCallId) !== String(call._id)) {
    throw new AppError("This proposal is linked to a different funding call", 400);
  }
  const project = await Project.findOne(req.tierWhere({ proposalId: proposal._id, researcherId }));
  return { proposal, projectId: project?._id || null };
}

function parseRequirementChecklist(body, call, existing = []) {
  if (body?.requirementChecklist !== undefined) {
    let raw = body.requirementChecklist;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        throw new AppError("Invalid requirementChecklist JSON", 400);
      }
    }
    if (!Array.isArray(raw)) throw new AppError("requirementChecklist must be an array", 400);
    const labels = buildRequirementChecklist(call?.requiredDocuments || "", []).map((item) => item.label);
    const labelSet = new Set(labels);
    return raw
      .filter((item) => item?.label && labelSet.has(String(item.label).trim()))
      .map((item) => ({
        label: String(item.label).trim(),
        met: Boolean(item.met),
        note: item.note ? String(item.note).trim() : "",
      }));
  }
  return buildRequirementChecklist(call?.requiredDocuments || "", existing);
}

async function assertGrantReadyForSubmit(grant, req) {
  if (!grant.proposalId) {
    throw new AppError("Link a research proposal before submitting this grant application", 400);
  }

  const proposal = await Proposal.findOne(
    req.tierWhere({ _id: grant.proposalId, researcherId: grant.researcherId })
  );
  if (!proposal) throw new AppError("Linked research proposal not found", 404);

  if (proposal.status !== PROPOSAL_STATUSES.APPROVED) {
    throw new AppError(
      "Your research proposal must be approved before grant submission. Complete proposal → ethics → review workflow first.",
      400
    );
  }

  if (proposal.requiresEthics !== false && proposal.ethicsStatus !== ETHICS_STATUSES.APPROVED) {
    throw new AppError("Ethics (REC) approval is required before grant submission", 400);
  }

  const call = grant.callId ? await FundingCall.findById(grant.callId) : null;
  const checklist = buildRequirementChecklist(call?.requiredDocuments || "", grant.requirementChecklist || []);
  try {
    assertRequirementsMet(checklist);
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }

  const amount = Number(grant.budgetTotal || grant.amountRequested || 0);
  if (amount <= 0) throw new AppError("Grant budget / amount requested must be greater than zero", 400);
}

async function resolveOpenCall(req, callId) {
  if (!callId) return null;
  await closeExpiredOpenCalls({
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });
  const call = await findOpenEligibleCall(req, callId);
  if (!call) throw new AppError("Funding call not found or not open", 404);
  if (call.deadline && new Date(call.deadline) < new Date()) {
    throw new AppError("Funding call deadline has passed", 400);
  }
  if (req.user.role === "researcher") assertEligibleForCall(req, call);
  return call;
}

function sanitizeResearcherProfile(user) {
  if (!user || !user._id) return null;
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    rank: user.rank,
    researchInterests: user.researchInterests || "",
  };
}

function sanitizeProjectSummary(project) {
  if (!project || !project._id) return null;
  return {
    id: project._id,
    title: project.title,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
  };
}

function sanitizeGrantDetail(g) {
  const base = sanitizeGrant(g);
  return {
    ...base,
    researcher: sanitizeResearcherProfile(g.researcherId),
    project: sanitizeProjectSummary(g.projectId),
  };
}

async function listGrants(req, res) {
  const { role } = req.user;
  const { status, projectId, callId } = req.query || {};
  // Prefer linking legacy grants to calls (seed data often missing callId)
  try {
    const { linkGrantsMissingCallId } = require("../utils/linkGrantsToFundingCalls");
    await linkGrantsMissingCallId(req.programTier);
  } catch {
    /* best-effort */
  }

  // Finance / staff: ensure accepted fund-call proposals have a pending_finance grant to approve
  if (["finance_officer", "research_director", "leadership"].includes(role)) {
    try {
      const { backfillPendingFinanceGrantsFromProposals } = require("../utils/ensurePendingFinanceGrantFromProposal");
      await backfillPendingFinanceGrantsFromProposals(req.tierWhere({}));
    } catch {
      /* best-effort */
    }
  }

  const filter = {};
  if (status && Object.values(GRANT_STATUSES).includes(status)) filter.status = status;
  if (projectId) {
    const { validateProjectQuery } = require("../utils/projectScopedRecords");
    await validateProjectQuery(req, projectId, { ownerOnly: role === "researcher" });
    filter.projectId = projectId;
  }
  if (callId) filter.callId = callId;
  if (role === "researcher") filter.researcherId = req.user.id;
  // Donor agency: monitor funded / submitted grants (no drafts)
  if (role === "donor_agency") {
    filter.status = { $nin: ["draft"] };
  }
  const grants = await Grant.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("projectId", "title status")
    .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId")
    .populate("callId", "title status fundingSource requiredDocuments deadline amountCap currency callType eligibilityTier");
  const sanitized = await Promise.all(grants.map(async (g) => redactGrantAwardsIfNeeded(sanitizeGrant(g), req)));

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(__dirname, "../../../debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "accepted-visibility",
        hypothesisId: "H4",
        location: "grantController.listGrants",
        message: "grants list result",
        data: {
          role,
          total: sanitized.length,
          withCallId: sanitized.filter((g) => g.callId).length,
        },
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  res.json({ grants: sanitized });
}

async function getGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }))
    .populate("researcherId", "fullName email department rank researchInterests")
    .populate("projectId", "title status startDate endDate")
    .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId submittedAt")
    .populate("callId", "title status fundingSource amountCap deadline requiredDocuments callType eligibilityTier currency");
  if (!grant) throw new AppError("Grant not found", 404);
  if (!grant.callId) {
    throw new AppError("Grant not found — only funding-call applications are available", 404);
  }

  const isOwner = String(grant.researcherId?._id || grant.researcherId) === String(req.user.id);
  const isStaff = [
    "research_director",
    "finance_officer",
    "faculty_coordinator",
    "leadership",
    "donor_agency",
  ].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const detail = sanitizeGrantDetail(grant);
  await redactGrantAwardsIfNeeded(detail, req);
  res.json({ grant: detail });
}

async function createGrant(req, res) {
  const { title, amountRequested, currency, donorRef, complianceNotes, projectId, callId, proposalId } = req.body || {};
  if (!callId) {
    throw new AppError("Grant applications must be created through an open funding call", 400);
  }

  const call = await resolveOpenCall(req, callId);
  if (req.user.role === ROLES.RESEARCHER) {
    assertEligibleForCall(req, call);
  }

  const { proposal, projectId: linkedProjectFromProposal } = await resolveGrantProposalId(
    req,
    proposalId,
    req.user.id,
    call
  );

  // Grant application title = funding call title (required). Researcher = logged-in applicant.
  // Research proposal keeps its own title via proposalId.
  const resolvedTitle = String(call.title || title || proposal.title || "").trim();
  if (!resolvedTitle) {
    throw new AppError("Funding call has no title. Publish/edit the call with a title first.", 400);
  }

  const budgetFields = parseBudgetField(req.body);
  let requested = typeof amountRequested === "number" ? amountRequested : Number(amountRequested) || 0;
  if (budgetFields?.budgetTotal > 0) requested = budgetFields.budgetTotal;
  if (requested < 0) throw new AppError("amountRequested must be a non-negative number", 400);

  const explicitProjectId = projectId ? await resolveGrantProjectId(req, projectId, req.user.id) : null;
  const linkedProjectId = explicitProjectId || linkedProjectFromProposal;

  // #region agent log
  try {
    const p = require("path");
    const fs = require("fs");
    const line = `${JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "H8",
      location: "grantController.createGrant",
      message: "auto title + researcher on grant create",
      data: {
        resolvedTitle,
        proposalId: String(proposal._id),
        researcherId: String(req.user.id),
        callId: String(call._id),
      },
      timestamp: Date.now(),
    })}\n`;
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", ".cursor", "debug-f558f7.log"), line);
  } catch (_) { /* debug */ }
  // #endregion

  const grant = await Grant.create(req.tierAssign({
    title: resolvedTitle,
    fundingSource: String(call.fundingSource).trim(),
    amountRequested: requested,
    currency: currency ? String(currency).trim().toUpperCase() : budgetFields?.budgetCurrency || call.currency || "USD",
    donorRef: donorRef ? String(donorRef).trim() : call.donorRef || "",
    complianceNotes: complianceNotes ? String(complianceNotes) : "",
    projectId: linkedProjectId,
    proposalId: proposal._id,
    callId: call._id,
    researcherId: req.user.id,
    status: GRANT_STATUSES.DRAFT,
    requirementChecklist: parseRequirementChecklist(req.body, call),
    ...(budgetFields || { budgetBreakdown: [], budgetTotal: 0 }),
  }));

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: "created",
    label: "Grant application created",
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const populated = await Grant.findById(grant._id)
    .populate("projectId", "title status")
    .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId")
    .populate("callId", "title status fundingSource requiredDocuments deadline");
  res.status(201).json({ grant: sanitizeGrant(populated) });
}

async function updateGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (![GRANT_STATUSES.DRAFT, GRANT_STATUSES.REJECTED].includes(grant.status)) {
    throw new AppError("Only draft or rejected grants can be edited", 400);
  }

  const { title, amountRequested, currency, donorRef, complianceNotes, projectId, callId, proposalId } = req.body || {};
  if (title !== undefined) grant.title = String(title).trim();
  if (amountRequested !== undefined) {
    if (typeof amountRequested !== "number" || amountRequested < 0) throw new AppError("Invalid amountRequested", 400);
    grant.amountRequested = amountRequested;
  }
  if (currency !== undefined) grant.currency = String(currency).trim().toUpperCase();
  if (donorRef !== undefined) grant.donorRef = String(donorRef).trim();
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);

  const callForChecklist = grant.callId ? await FundingCall.findById(grant.callId) : null;

  if (proposalId !== undefined) {
    const call = callForChecklist || (grant.callId ? await resolveOpenCall(req, grant.callId) : null);
    const { proposal, projectId: autoProjectId } = await resolveGrantProposalId(req, proposalId, req.user.id, call);
    grant.proposalId = proposal._id;
    if (!projectId && autoProjectId) grant.projectId = autoProjectId;
  }

  if (projectId !== undefined) {
    if (!grant.callId) {
      throw new AppError("Project link is only available for funding call applications", 400);
    }
    grant.projectId = projectId ? await resolveGrantProjectId(req, projectId, req.user.id) : null;
  }
  if (callId !== undefined) {
    if (!callId) {
      throw new AppError("Funding call cannot be removed from a grant application", 400);
    }
    const call = await resolveOpenCall(req, callId);
    grant.callId = call._id;
    grant.fundingSource = call.fundingSource;
    grant.donorRef = call.donorRef || grant.donorRef;
  }

  const budgetFields = parseBudgetField(req.body);
  if (budgetFields) {
    if (budgetFields.budgetBreakdown?.length && !grant.callId) {
      throw new AppError("Line-item budget is only allowed for funding call applications", 400);
    }
    grant.budgetBreakdown = budgetFields.budgetBreakdown;
    grant.budgetTotal = budgetFields.budgetTotal;
    if (budgetFields.budgetTotal > 0) grant.amountRequested = budgetFields.budgetTotal;
  }

  if (req.body?.requirementChecklist !== undefined) {
    grant.requirementChecklist = parseRequirementChecklist(req.body, callForChecklist, grant.requirementChecklist);
  } else if (!grant.requirementChecklist?.length && callForChecklist) {
    grant.requirementChecklist = buildRequirementChecklist(callForChecklist.requiredDocuments, []);
  }

  await grant.save();
  const populated = await Grant.findById(grant._id)
    .populate("projectId", "title status")
    .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId")
    .populate("callId", "title status fundingSource requiredDocuments deadline");
  res.json({ grant: sanitizeGrant(populated) });
}

async function submitGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (!grant.callId) {
    throw new AppError("Only grant applications linked to a funding call can be submitted", 400);
  }
  if (grant.status !== GRANT_STATUSES.DRAFT) throw new AppError("Only draft grants can be submitted", 400);

  await assertGrantReadyForSubmit(grant, req);

  grant.status = GRANT_STATUSES.SUBMITTED;
  grant.submittedAt = new Date();
  await grant.save();

  try {
    await notifyUsersByRole("research_director", {
      type: "grant",
      title: "Grant submitted for review",
      body: grant.title,
      link: `/grants/${grant._id}`,
    }, req.programTier);
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: "submitted",
    label: "Grant submitted",
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Grant submitted", grant: sanitizeGrant(grant) });
}

async function directorDecision(req, res) {
  const { decision, amountAwarded, complianceNotes } = req.body || {};
  if (![GRANT_STATUSES.APPROVED, GRANT_STATUSES.REJECTED].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (grant.status !== GRANT_STATUSES.SUBMITTED) throw new AppError("Grant is not decision-ready", 400);

  grant.decidedAt = new Date();
  if (decision === GRANT_STATUSES.REJECTED) {
    grant.status = GRANT_STATUSES.REJECTED;
  } else {
    let awarded = Number(amountAwarded);
    if (!Number.isFinite(awarded) || awarded < 0) throw new AppError("amountAwarded required", 400);
    if (awarded === 0) awarded = Number(grant.amountRequested || 0);
    if (awarded <= 0) throw new AppError("amountAwarded must be greater than zero", 400);
    grant.amountAwarded = awarded;
    grant.status = GRANT_STATUSES.PENDING_FINANCE;
  }
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);
  await grant.save();

  let projectResult = null;
  // Accepted grant must enter Projects (create/link), not stay only on Grants
  if (decision === GRANT_STATUSES.APPROVED) {
    try {
      projectResult = await ensureProjectForAcceptedGrant(grant, { programTier: req.programTier });
    } catch { /* best-effort — finance approve will retry */ }
  }

  // When a grant under a funding call is accepted, close the call (no further applications)
  if (decision === GRANT_STATUSES.APPROVED && grant.callId) {
    await closeCallAfterGrantAccepted(grant.callId, {
      actorId: req.user.id,
      actorRole: req.user.role,
      programTier: req.programTier,
      grantTitle: grant.title,
    });
  }

  const projectLink = projectResult?.project?._id
    ? `/projects/${projectResult.project._id}`
    : grant.projectId
      ? `/projects/${grant.projectId}`
      : "/grants";

  try {
    await notifyUser(grant.researcherId, {
      type: "grant",
      title: decision === GRANT_STATUSES.APPROVED ? "Grant approved — project ready (pending finance)" : "Grant rejected",
      body: grant.title,
      link: decision === GRANT_STATUSES.APPROVED ? projectLink : "/grants",
      programTier: req.programTier,
    });
    if (decision === GRANT_STATUSES.APPROVED) {
      await notifyUsersByRole("finance_officer", {
        type: "grant",
        title: "Grant pending finance approval",
        body: grant.title,
        link: "/finance/grant-approvals",
      }, req.programTier);
    }
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: decision === GRANT_STATUSES.APPROVED ? "director_approved" : "director_rejected",
    label: `Director ${decision === GRANT_STATUSES.APPROVED ? "approved" : "rejected"} grant`,
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Decision saved", grant: sanitizeGrant(grant) });
}

async function financeDecision(req, res) {
  const { decision, comment } = req.body || {};
  if (!["approve", "reject"].includes(decision)) throw new AppError("Invalid decision", 400);

  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (grant.status !== GRANT_STATUSES.PENDING_FINANCE) {
    throw new AppError("Grant is not pending finance approval", 400);
  }

  grant.financeComment = comment ? String(comment) : "";
  grant.financeApprovedBy = req.user.id;
  grant.financeApprovedAt = new Date();

  let budgetResult = null;
  let projectResult = null;
  if (decision === "approve") {
    grant.status = GRANT_STATUSES.ACTIVE;
    if (/awaiting finance approval/i.test(grant.complianceNotes || "")) {
      grant.complianceNotes = "Funding-call award authorized by finance — budget allocated (not paid).";
    }
    await grant.save();
    // Ensure grant has a Project so it appears under Projects, not only Grants
    try {
      projectResult = await ensureProjectForAcceptedGrant(grant, { programTier: req.programTier });
    } catch { /* best-effort */ }
    budgetResult = await ensureBudgetForGrant(grant);

    // Keep related proposal / call data consistent
    if (grant.callId) {
      try {
        const { closeCallAfterGrantAccepted } = require("../utils/fundingCallAutoClose");
        await closeCallAfterGrantAccepted(grant.callId, {
          actorId: req.user.id,
          actorRole: req.user.role,
          programTier: req.programTier,
          grantTitle: grant.title,
        });
      } catch { /* best-effort */ }
    }
    if (grant.proposalId) {
      try {
        const { STAGE_STATUS } = require("../utils/proposalReviewPipeline");
        const proposal = await Proposal.findById(grant.proposalId);
        if (proposal?.reviewPipeline?.financeReview) {
          const fr = proposal.reviewPipeline.financeReview;
          if (fr.status !== STAGE_STATUS.PASSED && fr.status !== STAGE_STATUS.FAILED) {
            proposal.reviewPipeline.financeReview = {
              status: STAGE_STATUS.PASSED,
              completedAt: new Date(),
              completedBy: req.user.id,
              decision: "budget_authorized",
              comment: comment ? String(comment) : "Budget authorized (allocation only — not paid)",
            };
            proposal.markModified("reviewPipeline");
            await proposal.save();
          }
        }
      } catch { /* best-effort */ }
    }

    // #region agent log
    try {
      const fs = require("fs");
      const path = require("path");
      const b = budgetResult?.budget;
      fs.appendFileSync(
        path.join(__dirname, "../../../debug-f558f7.log"),
        `${JSON.stringify({
          sessionId: "f558f7",
          runId: "finance-approve-not-paid",
          hypothesisId: "F2",
          location: "grantController.financeDecision",
          message: "finance authorize award — allocation only, not paid",
          data: {
            grantId: String(grant._id),
            amountAwarded: grant.amountAwarded,
            budgetId: b?._id ? String(b._id) : null,
            totalAllocated: b ? Number(b.totalAllocated || 0) : null,
            totalDisbursed: b ? Number(b.totalDisbursed || 0) : null,
            isPaidIncorrectly: b ? Number(b.totalDisbursed || 0) > 0 : null,
          },
          timestamp: Date.now(),
        })}\n`
      );
    } catch {
      /* ignore */
    }
    // #endregion
    try {
      const projectId = projectResult?.project?._id || grant.projectId;
      await notifyUser(grant.researcherId, {
        type: "grant",
        title: "Grant authorized — project funded",
        body: `${grant.title} — funds are allocated; open the project to continue work.`,
        link: projectId ? `/projects/${projectId}` : "/budgets",
        programTier: req.programTier,
      });
    } catch { /* best-effort */ }
  } else {
    grant.status = GRANT_STATUSES.REJECTED;
    await grant.save();
    try {
      await notifyUser(grant.researcherId, {
        type: "grant",
        title: "Grant rejected by finance",
        body: grant.title,
        link: `/grants/${grant._id}`,
        programTier: req.programTier,
      });
    } catch { /* best-effort */ }
  }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: decision === "approve" ? "finance_approved" : "finance_rejected",
    label: `Finance ${decision === "approve" ? "approved" : "rejected"} grant`,
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({
    message:
      decision === "approve"
        ? "Budget authorized (allocated). This is not a payment — disburse later via Budgets."
        : "Finance decision saved",
    grant: sanitizeGrant(grant),
    budget: budgetResult?.budget
      ? {
          id: budgetResult.budget._id,
          created: budgetResult.created,
          totalAllocated: budgetResult.budget.totalAllocated,
          totalDisbursed: budgetResult.budget.totalDisbursed || 0,
        }
      : null,
  });
}

module.exports = {
  listGrants,
  getGrant,
  createGrant,
  updateGrant,
  submitGrant,
  directorDecision,
  financeDecision,
};
