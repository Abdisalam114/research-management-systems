const { AppError } = require("../utils/AppError");
const { verifyAccessToken } = require("../services/tokenService");
const { User, USER_STATUSES } = require("../models/User");
const { resolveProgramTier, attachProgramTierHelpers } = require("../utils/programTierScope");

async function authenticateUser(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return next(new AppError("Missing access token", 401));

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch {
    return next(new AppError("Invalid access token", 401));
  }
}

async function requireActiveUser(req, res, next) {
  if (!req.user?.id) return next(new AppError("Unauthorized", 401));

  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));
  if (user.status !== USER_STATUSES.ACTIVE) return next(new AppError("Account is not active", 403));

  req.currentUser = user;
  try {
    req.programTier = resolveProgramTier(req, user);
    attachProgramTierHelpers(req);
  } catch (err) {
    return next(err);
  }
  return next();
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return next(new AppError("Unauthorized", 401));
    if (!roles.includes(req.user.role)) return next(new AppError("Forbidden", 403));
    return next();
  };
}

function isOwnerOrAuthorized(getOwnerId, ...roles) {
  return async (req, res, next) => {
    if (!req.user?.id) return next(new AppError("Unauthorized", 401));

    if (roles.includes(req.user.role)) return next();

    const ownerId = await getOwnerId(req);
    if (!ownerId) return next(new AppError("Owner not found", 403));

    if (String(ownerId) !== String(req.user.id)) return next(new AppError("Forbidden", 403));
    return next();
  };
}

module.exports = { authenticateUser, requireActiveUser, authorizeRoles, isOwnerOrAuthorized };

