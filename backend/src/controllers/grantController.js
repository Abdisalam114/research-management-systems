const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Project } = require("../models/Project");
const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { AppError } = require("../utils/AppError");
const { ensureBudgetForGrant } = require("../utils/ensureBudgetForGrant");
const {
  ensureProjectForAcceptedGrant,
  attachOpenProjectOnGrantAccept,
} = require("../utils/ensureProjectForAcceptedGrant");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");

const { normalizeBudgetBreakdown } = require("../utils/budgetBreakdown");
const { assertEligibleForCall, findOpenEligibleCall } = require("../utils/fundingCallEligibility");
const { resolveProjectStartDate } = require("../utils/projectStartDate");
const {
  buildRequirementChecklist,
  assertRequirementsMet,
  parseCallRequirementLabels,
} = require("../utils/fundingCallRequirements");
const { closeExpiredOpenCalls, closeCallAfterGrantAccepted } = require("../utils/fundingCallAutoClose");
const { isDeadlinePassed } = require("../utils/dateConstraints");
const { ROLES } = require("../models/User");
const { canViewProjectAwards } = require("../utils/researchJourney");

async function redactGrantAwardsIfNeeded(out, req) {
  if (!out?.amountAwarded) return out;
  if (["research_director", "finance_officer", "leadership"].includes(req.user.role)) {
    return out;
  }
  const projectId = out.projectId;
  if (!projectId) {
    out.amountAwarded = null;
    out.awardsHidden = true;
    return out;
  }
  const pubFilter = {
    projectId,
    status: { $in: [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED] },
  };
  const hasPub = await Publication.exists(
    req.user.role === "researcher" ? pubFilter : req.tierWhere(pubFilter)
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
  const project = await Project.findOne({ _id: projectId, researcherId });
  if (!project) throw new AppError("Research project not found or does not belong to you", 404);
  return project._id;
}

async function resolveGrantProposalId(req, proposalId, researcherId, call) {
  if (!proposalId) throw new AppError("A research proposal is required for funding call applications", 400);
  const proposal = await Proposal.findOne({ _id: proposalId, researcherId });
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
  const project = await Project.findOne({ proposalId: proposal._id, researcherId });
  return { proposal, projectId: project?._id || null };
}

function parseRequirementChecklist(body, call, existing = []) {
  const expected = buildRequirementChecklist(call?.requiredDocuments || "", existing);
  if (body?.requirementChecklist === undefined) {
    return expected;
  }

  let raw = body.requirementChecklist;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new AppError("Invalid requirementChecklist JSON", 400);
    }
  }
  if (!Array.isArray(raw)) throw new AppError("requirementChecklist must be an array", 400);

  const byLabel = new Map();
  for (const item of raw) {
    if (!item?.label) continue;
    byLabel.set(String(item.label).trim(), {
      label: String(item.label).trim(),
      met: Boolean(item.met),
      note: item.note ? String(item.note).trim() : "",
    });
  }

  const merged = expected.map((item) => byLabel.get(item.label) || item);
  return merged;
}

function assertCallRequirementsComplete(call, checklist) {
  const requiredLabels = parseCallRequirementLabels(call?.requiredDocuments || "");
  if (!requiredLabels.length) return;
  const merged = buildRequirementChecklist(call.requiredDocuments, checklist);
  if (merged.length < requiredLabels.length) {
    throw new AppError(
      `Complete all funding call requirements (${requiredLabels.length} required).`,
      400
    );
  }
  try {
    assertRequirementsMet(merged);
  } catch (e) {
    throw new AppError(e.message, e.statusCode || 400);
  }
}

async function assertGrantReadyForSubmit(grant, req) {
  if (!grant.proposalId) {
    throw new AppError("Link a research proposal before submitting this grant application", 400);
  }

  const proposal = await Proposal.findOne({
    _id: grant.proposalId,
    researcherId: grant.researcherId,
  });
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
  if (call) {
    await closeExpiredOpenCalls({
      actorId: req.user?.id,
      actorRole: req.user?.role,
      programTier: req.programTier,
    });
    const fresh = await FundingCall.findById(grant.callId);
    assertEligibleForCall(req, fresh || call);
  }
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
  if (isDeadlinePassed(call.deadline)) {
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
    startDate: resolveProjectStartDate(project),
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
  let grants = await Grant.find(role === "researcher" ? filter : req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("projectId", "title status")
    .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId")
    .populate("callId", "title status fundingSource requiredDocuments deadline amountCap currency callType eligibilityTier")
    .populate("researcherId", "fullName department");
  const sanitized = await Promise.all(grants.map(async (g) => redactGrantAwardsIfNeeded(sanitizeGrant(g), req)));
res.json({ grants: sanitized });
}

async function getGrant(req, res) {
  const baseGrant =
    req.user.role === "researcher"
      ? await req.findOwned(Grant, req.params.id)
      : await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!baseGrant) throw new AppError("Grant not found", 404);
  const grant = await Grant.findById(baseGrant._id)
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
  const checklist = parseRequirementChecklist(req.body, call);
  assertCallRequirementsComplete(call, checklist);

  const existing = await Grant.findOne({
    researcherId: req.user.id,
    callId: call._id,
    proposalId: proposal._id,
    status: { $ne: GRANT_STATUSES.REJECTED },
  });
  if (existing) {
    if (existing.status !== GRANT_STATUSES.DRAFT) {
      throw new AppError("You already applied to this funding call with this proposal", 409);
    }
    const populatedExisting = await Grant.findById(existing._id)
      .populate("projectId", "title status")
      .populate("proposalId", "title status ethicsStatus requiresEthics fundingCallId")
      .populate("callId", "title status fundingSource requiredDocuments deadline");
    return res.json({
      grant: sanitizeGrant(populatedExisting),
      message: "Opened your existing draft for this call.",
    });
  }

  const grant = await Grant.create(
    req.createWithTier(
      {
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
        requirementChecklist: checklist,
        ...(budgetFields || { budgetBreakdown: [], budgetTotal: 0 }),
      },
      "grant program tier"
    )
  );

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
  const grant = await req.findOwned(Grant, req.params.id);
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
    if (callForChecklist) {
      assertCallRequirementsComplete(callForChecklist, grant.requirementChecklist);
    }
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
  const grant = await req.findOwned(Grant, req.params.id);
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
    }, grant.programTier || req.programTier);
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
  if (req.user?.role !== ROLES.RESEARCH_DIRECTOR) {
    throw new AppError("Only the Research Director can accept or reject grants", 403);
  }
  const { decision, amountAwarded, complianceNotes } = req.body || {};
  if (![GRANT_STATUSES.APPROVED, GRANT_STATUSES.REJECTED].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const grant = await req.findOwned(Grant, req.params.id);
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
  let fundCallLinks = null;
  if (decision === GRANT_STATUSES.APPROVED) {
    const attached = await attachOpenProjectOnGrantAccept(grant, req);
    fundCallLinks = attached.fundCallLinks;
    projectResult = attached.projectResult;
  }

  // When a grant under a funding call is accepted, close the call (no further applications)
  if (decision === GRANT_STATUSES.APPROVED && grant.callId) {
    await closeCallAfterGrantAccepted(grant.callId, {
      actorId: req.user.id,
      actorRole: req.user.role,
      programTier: grant.programTier || req.programTier,
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
      programTier: grant.programTier || req.programTier,
    });
    if (decision === GRANT_STATUSES.APPROVED) {
      await notifyUsersByRole("finance_officer", {
        type: "grant",
        title: "Grant pending finance approval",
        body: grant.title,
        link: "/finance/grant-approvals",
      }, grant.programTier || req.programTier);
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

  res.json({
    message:
      decision === GRANT_STATUSES.APPROVED
        ? fundCallLinks?.message
          ? `Grant accepted. An Open project was created for the researcher. ${fundCallLinks.message}`
          : projectResult?.project
            ? "Grant accepted. An Open project was created for the researcher and is listed under Projects."
            : "Grant accepted. Finance still authorizes the allocated budget."
        : "Decision saved",
    grant: sanitizeGrant(grant),
    project: projectResult?.project
      ? { id: projectResult.project._id, title: projectResult.project.title, status: projectResult.project.status }
      : null,
    links: fundCallLinks,
  });
}

async function financeDecision(req, res) {
  const { decision, comment } = req.body || {};
  if (!["approve", "reject"].includes(decision)) throw new AppError("Invalid decision", 400);

  const grant = await req.findOwned(Grant, req.params.id);
  if (!grant) throw new AppError("Grant not found", 404);
  if (grant.status !== GRANT_STATUSES.PENDING_FINANCE) {
    throw new AppError("Grant is not pending finance approval", 400);
  }

  grant.financeComment = comment ? String(comment) : "";
  grant.financeApprovedBy = req.user.id;
  grant.financeApprovedAt = new Date();

  let budgetResult = null;
  let projectResult = null;
  let fundCallLinks = null;
  if (decision === "approve") {
    grant.status = GRANT_STATUSES.ACTIVE;
    if (/awaiting finance approval/i.test(grant.complianceNotes || "")) {
      grant.complianceNotes = "Funding-call award authorized by finance — budget allocated (not paid).";
    }
    await grant.save();
    const attached = await attachOpenProjectOnGrantAccept(grant, req);
    fundCallLinks = attached.fundCallLinks;
    projectResult = attached.projectResult;
    budgetResult = attached.budgetResult || null;
    if (!budgetResult?.budget) {
      try {
        budgetResult = await ensureBudgetForGrant(grant);
      } catch { /* best-effort */ }
    }

    // Keep related proposal / call data consistent
    if (grant.callId) {
      try {
        const { closeCallAfterGrantAccepted } = require("../utils/fundingCallAutoClose");
        await closeCallAfterGrantAccepted(grant.callId, {
          actorId: req.user.id,
          actorRole: req.user.role,
          programTier: grant.programTier || req.programTier,
          grantTitle: grant.title,
        });
      } catch { /* best-effort */ }
    }
    if (grant.proposalId) {
      // Do not soft-pass proposal financeReview from grant budget auth —
      // Phase-3 finance assign/review stays independent of grant authorization.
    }
try {
      const projectId = projectResult?.project?._id || grant.projectId;
      await notifyUser(grant.researcherId, {
        type: "grant",
        title: "Grant authorized — records linked",
        body: `${fundCallLinks?.message || "Budget allocated."} Open the project to continue; payments are made later from Budgets.`,
        link: projectId ? `/projects/${projectId}` : "/budgets",
        programTier: grant.programTier || req.programTier,
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
        programTier: grant.programTier || req.programTier,
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
        ? "Budget authorized (allocated). An Open project is listed under Projects. This is not a payment — disburse later via Budgets."
        : "Finance decision saved",
    grant: sanitizeGrant(grant),
    project: projectResult?.project
      ? { id: projectResult.project._id, title: projectResult.project.title, status: projectResult.project.status }
      : null,
    links: fundCallLinks,
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
