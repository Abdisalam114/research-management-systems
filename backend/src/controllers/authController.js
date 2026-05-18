const { User, USER_STATUSES, normalizeResearchInterests } = require("../models/User");
const { AppError } = require("../utils/AppError");
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../services/tokenService");

function getRefreshCookieName() {
  return process.env.REFRESH_COOKIE_NAME || "just_rms_refresh";
}

function getRefreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth/refresh",
  };
}

function sanitizeUser(userDoc) {
  return {
    id: userDoc._id,
    fullName: userDoc.fullName,
    email: userDoc.email,
    role: userDoc.role,
    department: userDoc.department,
    rank: userDoc.rank,
    researchInterests: normalizeResearchInterests(userDoc.researchInterests),
    status: userDoc.status,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

async function register(_req, _res) {
  throw new AppError(
    "Public registration is disabled. Contact the Research Director to create your account.",
    403
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError("Email and password are required", 400);

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +refreshToken");
  if (!user) throw new AppError("Invalid credentials", 401);

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new AppError("Account is not active. Please wait for approval.", 403);
  }

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError("Invalid credentials", 401);

  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id) });

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptions());

  res.json({
    accessToken,
    user: sanitizeUser(user),
  });
}

async function logout(req, res) {
  const cookieName = getRefreshCookieName();
  const refreshToken = req.cookies?.[cookieName];

  if (refreshToken) {
    const user = await User.findOne({ refreshToken }).select("+refreshToken");
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
  }

  res.clearCookie(cookieName, getRefreshCookieOptions());
  res.json({ message: "Logged out" });
}

async function refresh(req, res) {
  const cookieName = getRefreshCookieName();
  const refreshToken = req.cookies?.[cookieName];
  if (!refreshToken) throw new AppError("Missing refresh token", 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findOne({ _id: decoded.sub, refreshToken }).select("+refreshToken");
  if (!user) throw new AppError("Invalid refresh token", 401);
  if (user.status !== USER_STATUSES.ACTIVE) throw new AppError("Account is not active", 403);

  const newAccessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const newRefreshToken = signRefreshToken({ sub: String(user._id) });

  user.refreshToken = newRefreshToken;
  await user.save();

  res.cookie(cookieName, newRefreshToken, getRefreshCookieOptions());
  res.json({ accessToken: newAccessToken });
}

async function me(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new AppError("Missing access token", 401);

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new AppError("Invalid access token", 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user) throw new AppError("User not found", 404);

  res.json({ user: sanitizeUser(user) });
}

module.exports = { register, login, logout, refresh, me };

