const { AppError } = require("./AppError");
const { ROLES } = require("../models/User");
const {
  PROGRAM_TIERS,
  PROGRAM_TIER_HEADER,
  isValidProgramTier,
} = require("../constants/programTier");

/** Shared institutional staff — one account each, see UG + PG together. */
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
 * Cross-tier staff: optional X-Program-Tier header filters to one portal;
 * omit header → null (all UG + PG).
 * Researchers (and other portal users): always locked to user.programTier.
 */
function resolveProgramTier(req, user) {
  const headerTier = String(req.headers[PROGRAM_TIER_HEADER] || "").toLowerCase();

  if (isCrossTierRole(user.role)) {
    if (isValidProgramTier(headerTier)) return headerTier;
    return null;
  }

  if (user.programTier && isValidProgramTier(user.programTier)) {
    return user.programTier;
  }

  return PROGRAM_TIERS.UNDERGRADUATE;
}

function tierWhere(req, base = {}) {
  if (!req.programTier) return base;
  return { ...base, programTier: req.programTier };
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
  tierAssign,
  requireWriteProgramTier,
  notifyProgramTier,
  assertTierDocument,
  attachProgramTierHelpers,
};
