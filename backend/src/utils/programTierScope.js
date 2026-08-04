const { AppError } = require("./AppError");
const { ROLES } = require("../models/User");
const {
  PROGRAM_TIERS,
  PROGRAM_TIER_HEADER,
  isValidProgramTier,
} = require("../constants/programTier");

/** Shared institutional staff — one account each; must pick UG or PG portal per session. */
const CROSS_TIER_ROLES = Object.freeze([
  ROLES.RESEARCH_DIRECTOR,
  ROLES.FACULTY_COORDINATOR,
  ROLES.FINANCE_OFFICER,
  ROLES.LEADERSHIP,
]);

function isCrossTierRole(role) {
  return CROSS_TIER_ROLES.includes(role);
}

/**
 * Resolve active program-tier scope for the request.
 * Cross-tier staff: require valid X-Program-Tier (UG or PG portal).
 * Researchers (and other portal users): always locked to user.programTier.
 */
function resolveProgramTier(req, user) {
  const headerTier = String(req.headers[PROGRAM_TIER_HEADER] || "").toLowerCase();

  if (isCrossTierRole(user.role)) {
    if (!isValidProgramTier(headerTier)) {
      throw new AppError(
        "Program tier selection required. Choose Undergraduate or Postgraduate.",
        428,
        "PROGRAM_TIER_REQUIRED"
      );
    }
    return headerTier;
  }

  if (user.programTier && isValidProgramTier(user.programTier)) {
    return user.programTier;
  }

  if (user.role === ROLES.RESEARCHER) {
    throw new AppError(
      "Researcher account missing program tier (UG/PG). Contact Research Director.",
      400,
      "PROGRAM_TIER_REQUIRED"
    );
  }

  return PROGRAM_TIERS.UNDERGRADUATE;
}

function tierWhere(req, base = {}) {
  if (!req.programTier) return base;
  return { ...base, programTier: req.programTier };
}

/**
 * User collection filter: researchers are portal-scoped; shared staff (Leadership, Finance, …)
 * are one account for UG + PG — never hide them behind programTier.
 */
function userWhere(req, base = {}) {
  const role = base?.role;
  // Explicit shared-staff role (e.g. leadership for peer assign) — never portal-filter
  if (typeof role === "string" && isCrossTierRole(role)) {
    const { programTier: _drop, ...rest } = base;
    return rest;
  }
  // Director "all users" (role ≠ director): this portal's researchers + shared staff accounts
  if (role && typeof role === "object" && role.$ne) {
    const { programTier: _drop, role: _role, ...rest } = base;
    const sharedRoles = CROSS_TIER_ROLES.filter(
      (r) => r !== role.$ne && r !== ROLES.RESEARCH_DIRECTOR
    );
    return {
      $or: [
        {
          ...rest,
          role: ROLES.RESEARCHER,
          ...(req.programTier ? { programTier: req.programTier } : {}),
        },
        { ...rest, role: { $in: sharedRoles } },
      ],
    };
  }
  if (base?._id || base?.id) {
    const id = base._id || base.id;
    const { programTier: _p, _id, id: _i, ...rest } = base;
    return {
      $or: [
        { _id: id, ...rest, ...(req.programTier ? { programTier: req.programTier } : {}) },
        { _id: id, ...rest, role: { $in: [...CROSS_TIER_ROLES] } },
      ],
    };
  }
  return tierWhere(req, base);
}

function tierAssign(req, data = {}) {
  if (data.programTier && isValidProgramTier(data.programTier)) {
    return data;
  }
  if (req.programTier) {
    return { ...data, programTier: req.programTier };
  }
  return data;
}

/**
 * Resolve programTier for writes. Prefer an existing document / body value,
 * then the request filter. Throws if still missing (avoids silent UG default).
 */
function requireWriteProgramTier(req, preferred, label = "programTier") {
  const candidates = [
    preferred,
    preferred?.programTier,
    req.body?.programTier,
    req.programTier,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && isValidProgramTier(c)) return c;
  }
  throw new AppError(
    `${label} is required (undergraduate or postgraduate)`,
    400
  );
}

/** Best-effort notify stamp: document tier first, then request filter. */
function notifyProgramTier(doc, req) {
  const fromDoc = doc?.programTier;
  if (isValidProgramTier(fromDoc)) return fromDoc;
  if (isValidProgramTier(req?.programTier)) return req.programTier;
  return undefined;
}

function assertTierDocument(req, doc) {
  if (!doc) return;
  if (!req.programTier) return;
  if (doc.programTier && doc.programTier !== req.programTier) {
    throw new AppError("Not found", 404);
  }
}

function attachProgramTierHelpers(req) {
  req.isCrossTierStaff = isCrossTierRole(req.user?.role);
  req.tierWhere = (base = {}) => tierWhere(req, base);
  req.userWhere = (base = {}) => userWhere(req, base);
  req.tierAssign = (data = {}) => tierAssign(req, data);
  req.requireWriteProgramTier = (preferred, label) =>
    requireWriteProgramTier(req, preferred, label);
  req.notifyProgramTier = (doc) => notifyProgramTier(doc, req);
  req.assertTierDocument = (doc) => assertTierDocument(req, doc);
}

module.exports = {
  CROSS_TIER_ROLES,
  isCrossTierRole,
  resolveProgramTier,
  tierWhere,
  userWhere,
  tierAssign,
  requireWriteProgramTier,
  notifyProgramTier,
  assertTierDocument,
  attachProgramTierHelpers,
};
