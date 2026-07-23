const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant } = require("../models/Grant");
const { Proposal } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");
const { notifyUsersByRole, notifyUser } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");
const { tierMatchesCall } = require("../utils/fundingCallEligibility");
const { closeExpiredOpenCalls } = require("../utils/fundingCallAutoClose");
const { PROGRAM_TIERS } = require("../constants/programTier");

function defaultRequiredDocuments(callType) {
  if (callType === "external") {
    return [
      "Signed research proposal (PDF)",
      "Detailed budget breakdown",
      "Donor / agency compliance forms",
      "Ethics clearance (if human subjects)",
      "CV of Principal Investigator",
      "Letter of institutional support",
    ].join("\n");
  }
  return [
    "Signed research proposal (PDF)",
    "Detailed budget breakdown",
    "Ethics clearance (if human subjects)",
    "CV of Principal Investigator",
  ].join("\n");
}

function sanitizeCall(c) {
  return {
    id: c._id,
    title: c.title,
    description: c.description,
    fundingSource: c.fundingSource,
    callType: c.callType || "internal",
    donorRef: c.donorRef,
    amountCap: c.amountCap,
    currency: c.currency,
    deadline: c.deadline,
    eligibilityTier: c.eligibilityTier,
    requiredDocuments: c.requiredDocuments,
    status: c.status,
    publishedAt: c.publishedAt,
    closedAt: c.closedAt,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    programTier: c.programTier,
  };
}

function isCallOwner(call, userId) {
  return String(call.createdBy) === String(userId);
}

async function listFundingCalls(req, res) {
  await closeExpiredOpenCalls({
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const { status } = req.query || {};
  const filter = {};
  if (status && Object.values(CALL_STATUSES).includes(status)) filter.status = status;

  // Researcher: open calls + any calls they already applied to via Grant or Proposal
  let appliedCallIds = [];
  if (req.user.role === "researcher" && !status) {
    const [myApps, myProps] = await Promise.all([
      Grant.find(req.tierWhere({ researcherId: req.user.id, callId: { $ne: null } })).select(
        "callId status amountAwarded"
      ),
      Proposal.find(
        req.tierWhere({ researcherId: req.user.id, fundingCallId: { $ne: null } })
      ).select("fundingCallId status"),
    ]);
    appliedCallIds = [
      ...new Set([
        ...myApps.map((g) => String(g.callId)).filter(Boolean),
        ...myProps.map((p) => String(p.fundingCallId)).filter(Boolean),
      ]),
    ];
    filter.$or = [
      { status: CALL_STATUSES.OPEN },
      ...(appliedCallIds.length ? [{ _id: { $in: appliedCallIds } }] : []),
    ];
  } else if (req.user.role === "researcher") {
    // Explicit status filter (e.g. closed) — still only their applied calls when not open
    if (status === CALL_STATUSES.OPEN) {
      filter.status = CALL_STATUSES.OPEN;
    } else {
      const [myApps, myProps] = await Promise.all([
        Grant.find(req.tierWhere({ researcherId: req.user.id, callId: { $ne: null } })).select("callId"),
        Proposal.find(
          req.tierWhere({ researcherId: req.user.id, fundingCallId: { $ne: null } })
        ).select("fundingCallId"),
      ]);
      appliedCallIds = [
        ...new Set([
          ...myApps.map((g) => String(g.callId)).filter(Boolean),
          ...myProps.map((p) => String(p.fundingCallId)).filter(Boolean),
        ]),
      ];
      filter._id = { $in: appliedCallIds.length ? appliedCallIds : ["000000000000000000000000"] };
    }
  }

  // Donor sees external calls (all statuses) + open internal for awareness
  if (req.user.role === "donor_agency") {
    filter.$or = [
      { callType: "external" },
      { status: CALL_STATUSES.OPEN, callType: "internal" },
    ];
  }

  let calls;
  if (req.user.role === "researcher") {
    // Researchers see: (1) open calls they are eligible for (any portal), (2) calls they already applied to
    const eligCodes =
      req.programTier === "undergraduate" ? ["ug", "all"] : ["pg", "pgd", "all"];
    const researcherFilter = {
      $or: [
        {
          status: CALL_STATUSES.OPEN,
          $or: [
            { programTier: req.programTier },
            { eligibilityTier: { $in: eligCodes } },
          ],
        },
        ...(appliedCallIds.length ? [{ _id: { $in: appliedCallIds } }] : []),
      ],
    };
    if (status === CALL_STATUSES.OPEN) {
      calls = await FundingCall.find({
        status: CALL_STATUSES.OPEN,
        $or: [{ programTier: req.programTier }, { eligibilityTier: { $in: eligCodes } }],
      }).sort({ deadline: 1, createdAt: -1 });
    } else if (status && status !== CALL_STATUSES.OPEN) {
      calls = await FundingCall.find({
        _id: { $in: appliedCallIds.length ? appliedCallIds : ["000000000000000000000000"] },
        status,
      }).sort({ deadline: 1, createdAt: -1 });
    } else {
      calls = await FundingCall.find(researcherFilter).sort({ deadline: 1, createdAt: -1 });
    }
  } else {
    calls = await FundingCall.find(req.tierWhere(filter)).sort({ deadline: 1, createdAt: -1 });
  }

  const visible = req.user.role === "researcher"
    ? calls.filter((c) => tierMatchesCall(req, c) || appliedCallIds.includes(String(c._id)))
    : calls;

  res.json({ calls: visible.map(sanitizeCall) });
}

async function getFundingCall(req, res) {
  await closeExpiredOpenCalls({
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  let call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  // Researchers may open an eligible call from the other portal via notification deep-link
  if (!call && req.user.role === "researcher") {
    call = await FundingCall.findById(req.params.id);
  }
  if (!call) throw new AppError("Funding call not found", 404);
  if (req.user.role === "researcher") {
    const applied = await Grant.exists({
      researcherId: req.user.id,
      callId: call._id,
    });
    if (call.status !== CALL_STATUSES.OPEN && !applied) {
      throw new AppError("Funding call not available", 404);
    }
    if (call.status === CALL_STATUSES.OPEN && !tierMatchesCall(req, call) && !applied) {
      throw new AppError("Not eligible for this call", 403);
    }
  }
  if (req.user.role === "donor_agency" && call.callType !== "external" && call.status !== CALL_STATUSES.OPEN) {
    throw new AppError("Forbidden", 403);
  }
  res.json({ call: sanitizeCall(call) });
}

async function createFundingCall(req, res) {
  const {
    title, description, fundingSource, callType, donorRef, amountCap, currency,
    deadline, eligibilityTier, requiredDocuments,
  } = req.body || {};
  if (!title || !fundingSource) throw new AppError("title and fundingSource are required", 400);

  const role = req.user.role;
  let resolvedType = callType === "external" ? "external" : "internal";

  if (role === "donor_agency") {
    resolvedType = "external";
  } else if (role === "research_director") {
    // Director may create Internal or External institutional calls
    resolvedType = callType === "external" ? "external" : "internal";
  } else {
    throw new AppError("Forbidden", 403);
  }
  if (resolvedType === "external" && !(donorRef || "").trim()) {
    throw new AppError("Donor / agency reference is required for external funding calls", 400);
  }

  const eligibility = ["ug", "pg", "pgd", "all"].includes(eligibilityTier) ? eligibilityTier : "all";
  const docs =
    requiredDocuments && String(requiredDocuments).trim()
      ? String(requiredDocuments).trim()
      : defaultRequiredDocuments(resolvedType);
  // Stay on the portal the director is managing; eligibility controls who is notified/can apply
  const portalTier = req.programTier;

  const call = await FundingCall.create(
    req.tierAssign({
      title: String(title).trim(),
      description: description ? String(description) : "",
      fundingSource: String(fundingSource).trim(),
      callType: resolvedType,
      donorRef: donorRef ? String(donorRef).trim() : "",
      amountCap: typeof amountCap === "number" ? amountCap : Number(amountCap) || 0,
      currency: currency ? String(currency).trim().toUpperCase() : "USD",
      deadline: deadline ? new Date(deadline) : null,
      eligibilityTier: eligibility,
      requiredDocuments: docs,
      status: CALL_STATUSES.DRAFT,
      createdBy: req.user.id,
    })
  );

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "created",
    label: resolvedType === "external" ? "External funding call draft created" : "Internal funding call draft created",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: portalTier,
  });

  // Donor drafts notify Director to publish — Leadership is not required for funding calls
  if (role === "donor_agency") {
    try {
      await notifyUsersByRole(
        "research_director",
        {
          type: "grant",
          title: "External funding call draft ready",
          body: `${call.title} — open Funding Calls and Publish when ready (no Leadership step).`,
          link: `/funding-calls?callId=${call._id}`,
        },
        portalTier
      );
    } catch {
      /* best-effort */
    }
  }

  res.status(201).json({ call: sanitizeCall(call) });
}

async function updateFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be edited", 400);

  const role = req.user.role;
  if (role === "donor_agency") {
    if (call.callType !== "external") throw new AppError("Donors may only edit external funding calls", 403);
    if (!isCallOwner(call, req.user.id)) throw new AppError("You can only edit funding calls you created", 403);
  } else if (role !== "research_director") {
    throw new AppError("Only Research Director or the donor owner can edit draft funding calls", 403);
  }

  const fields = ["title", "description", "fundingSource", "donorRef", "amountCap", "currency", "deadline", "eligibilityTier", "requiredDocuments", "callType"];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      if (f === "deadline") call.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      else if (f === "amountCap") call.amountCap = Number(req.body.amountCap) || 0;
      else if (f === "currency") call.currency = String(req.body.currency).trim().toUpperCase();
      else if (f === "callType") {
        if (role === "donor_agency") call.callType = "external";
        else if (["internal", "external"].includes(req.body.callType)) call.callType = req.body.callType;
      }
      else call[f] = String(req.body[f]).trim();
    }
  }

  // Donor stays external; director may set internal or external
  if (role === "donor_agency") call.callType = "external";

  if (call.callType === "external" && !(call.donorRef || "").trim()) {
    throw new AppError("Donor / agency reference is required for external funding calls", 400);
  }

  if (!(call.requiredDocuments || "").trim()) {
    call.requiredDocuments = defaultRequiredDocuments(call.callType);
  }

  await call.save();
  res.json({ call: sanitizeCall(call) });
}

/** Research Director publishes draft calls (Leadership is not required). */
async function publishFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be published", 400);

  if (req.user.role !== "research_director") {
    throw new AppError("Only Research Director can publish funding calls", 403);
  }

  call.status = CALL_STATUSES.OPEN;
  call.publishedAt = new Date();
  if (!(call.requiredDocuments || "").trim()) {
    call.requiredDocuments = defaultRequiredDocuments(call.callType);
  }
  await call.save();

  const listLink = `/funding-calls?callId=${call._id}`;
  const applyLink = `/grants/apply?callId=${call._id}`;
  // Notify by eligibility — each portal gets its own researchers with that portal's programTier
  let tiersToNotify = [call.programTier || req.programTier];
  if (call.eligibilityTier === "all") {
    tiersToNotify = [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE];
  } else if (call.eligibilityTier === "ug") {
    tiersToNotify = [PROGRAM_TIERS.UNDERGRADUATE];
  } else if (call.eligibilityTier === "pg" || call.eligibilityTier === "pgd") {
    tiersToNotify = [PROGRAM_TIERS.POSTGRADUATE];
  }

  const notifyStats = { tiers: tiersToNotify, researcherNotified: 0, creatorNotified: false };
  try {
    for (const tier of tiersToNotify) {
      const before = await require("../models/User").User.countDocuments({
        role: "researcher",
        status: "active",
        programTier: tier,
      });
      await notifyUsersByRole(
        "researcher",
        {
          type: "grant",
          title: "New funding call open — apply now",
          body: `${call.title} (${call.callType === "external" ? "External" : "Internal"}) · Open to apply`,
          link: applyLink,
          programTier: tier,
        },
        tier
      );
      notifyStats.researcherNotified += before;
    }
    if (call.createdBy) {
      await notifyUser(call.createdBy, {
        type: "grant",
        title: "Funding call published",
        body: call.title,
        link: listLink,
        programTier: call.programTier || req.programTier,
      });
      notifyStats.creatorNotified = true;
    }
    // Also notify faculty coordinators on the same portal(s) so staff see the new call
    for (const tier of tiersToNotify) {
      await notifyUsersByRole(
        "faculty_coordinator",
        {
          type: "grant",
          title: "New funding call published",
          body: call.title,
          link: listLink,
          programTier: tier,
        },
        tier
      );
    }
  } catch { /* best-effort */ }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const payload = {
      sessionId: "f558f7",
      hypothesisId: "FC1",
      location: "fundingCallController.publishFundingCall",
      message: "funding call published — notifications",
      data: {
        callId: String(call._id),
        title: call.title,
        callProgramTier: call.programTier || null,
        reqTier: req.programTier || null,
        eligibilityTier: call.eligibilityTier,
        tiersToNotify,
        listLink,
        applyLink,
        ...notifyStats,
      },
      timestamp: Date.now(),
      runId: "fund-call-notify",
    };
    fs.appendFileSync(path.join(__dirname, "../../../debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) { /* debug */ }
  // #endregion

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "published",
    label: "Funding call published",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: call.programTier || req.programTier,
  });

  res.json({
    message: "Funding call published — eligible researchers notified",
    call: sanitizeCall(call),
    notified: notifyStats,
  });
}

async function closeFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.OPEN) throw new AppError("Only open calls can be closed", 400);

  const role = req.user.role;
  const allowed =
    role === "research_director" ||
    (role === "donor_agency" && call.callType === "external" && isCallOwner(call, req.user.id));
  if (!allowed) throw new AppError("Forbidden", 403);

  call.status = CALL_STATUSES.CLOSED;
  call.closedAt = new Date();
  await call.save();

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "closed",
    label: "Funding call closed",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Funding call closed", call: sanitizeCall(call) });
}

module.exports = {
  listFundingCalls,
  getFundingCall,
  createFundingCall,
  updateFundingCall,
  publishFundingCall,
  closeFundingCall,
};
