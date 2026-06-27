const { User, USER_STATUSES, ROLES } = require("../models/User");
const { AppError } = require("../utils/AppError");

function sanitizeUser(userDoc) {
  return {
    id: userDoc._id,
    fullName: userDoc.fullName,
    email: userDoc.email,
    role: userDoc.role,
    department: userDoc.department,
    rank: userDoc.rank,
    status: userDoc.status,
    isProtected: Boolean(userDoc.isProtected),
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

function assertNotSelfTarget(req, targetUserId, actionLabel) {
  if (String(req.user?.id) === String(targetUserId)) {
    throw new AppError(`Self-lockout prevention: you cannot ${actionLabel} your own account`, 400);
  }
}

async function listPendingUsers(req, res) {
  const users = await User.find(req.tierWhere({ status: USER_STATUSES.PENDING })).sort({ createdAt: -1 });
  res.json({ users: users.map(sanitizeUser) });
}

async function createUserByDirector(req, res) {
  const { fullName, email, password, role, department, rank, status } = req.body || {};

  if (!fullName || !email || !password || !role || !department || !rank) {
    throw new AppError("All fields are required", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  if (!Object.values(ROLES).includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  if (role === ROLES.RESEARCH_DIRECTOR) {
    throw new AppError("Research Director accounts cannot be created here", 400);
  }

  const nextStatus =
    status && Object.values(USER_STATUSES).includes(status) ? status : USER_STATUSES.ACTIVE;

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) throw new AppError("Email already in use", 409);

  const user = await User.create(req.tierAssign({
    fullName: String(fullName).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    role,
    department: String(department).trim(),
    rank: String(rank).trim(),
    status: nextStatus,
    isProtected: false,
  }));

  res.status(201).json({
    message: nextStatus === USER_STATUSES.ACTIVE ? "User created and activated" : "User created (pending)",
    user: sanitizeUser(user),
  });
}

async function listUsers(req, res) {
  const { status, role, q } = req.query || {};
  const filter = {};

  if (status && Object.values(USER_STATUSES).includes(status)) filter.status = status;
  if (role && Object.values(ROLES).includes(role)) filter.role = role;
  else filter.role = { $ne: ROLES.RESEARCH_DIRECTOR };

  if (q) {
    const qq = String(q).trim().toLowerCase();
    if (qq) {
      filter.$or = [{ email: { $regex: qq, $options: "i" } }, { fullName: { $regex: qq, $options: "i" } }];
    }
  }

  const users = await User.find(req.tierWhere(filter)).sort({ createdAt: -1 });
  res.json({ users: users.map(sanitizeUser) });
}

async function approveUser(req, res) {
  const { id } = req.params;
  const user = await User.findOne(req.tierWhere({ _id: id }));
  if (!user) throw new AppError("User not found", 404);

  user.status = USER_STATUSES.ACTIVE;
  await user.save();

  res.json({ message: "User approved", user: sanitizeUser(user) });
}

async function rejectUser(req, res) {
  const { id } = req.params;
  const user = await User.findOne(req.tierWhere({ _id: id }));
  if (!user) throw new AppError("User not found", 404);

  assertNotSelfTarget(req, user._id, "reject/deactivate");
  user.status = USER_STATUSES.REJECTED;
  user.refreshToken = null;
  await user.save();

  res.json({ message: "User rejected", user: sanitizeUser(user) });
}

async function updateUserByDirector(req, res) {
  const { id } = req.params;
  const user = await User.findOne(req.tierWhere({ _id: id })).select("+refreshToken");
  if (!user) throw new AppError("User not found", 404);

  const { role, status, fullName, department, rank, isProtected } = req.body || {};

  // Prevent administrators from locking themselves out via role/status edits.
  if (role !== undefined || status !== undefined || isProtected !== undefined) {
    assertNotSelfTarget(req, user._id, "change role/status/protection");
  }

  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (department !== undefined) user.department = String(department).trim();
  if (rank !== undefined) user.rank = String(rank).trim();

  if (role !== undefined) {
    if (!Object.values(ROLES).includes(role)) throw new AppError("Invalid role", 400);
    user.role = role;
  }

  if (status !== undefined) {
    if (!Object.values(USER_STATUSES).includes(status)) throw new AppError("Invalid status", 400);
    user.status = status;
    if (status !== USER_STATUSES.ACTIVE) user.refreshToken = null;
  }

  if (isProtected !== undefined) {
    user.isProtected = Boolean(isProtected);
  }

  await user.save();
  res.json({ message: "User updated", user: sanitizeUser(user) });
}

async function deleteUserByDirector(req, res) {
  const { id } = req.params;
  const user = await User.findOne(req.tierWhere({ _id: id }));
  if (!user) throw new AppError("User not found", 404);

  // Never allow self-delete (prevents self-lockout and accidental removal).
  assertNotSelfTarget(req, user._id, "delete");

  if (user.isProtected) {
    throw new AppError("Protected deletion: this account cannot be deleted", 403);
  }

  await User.deleteOne({ _id: user._id });
  res.json({ message: "User deleted" });
}

async function updateMyProfile(req, res) {
  const user = req.currentUser;
  if (!user) throw new AppError("Unauthorized", 401);

  const { fullName, department, rank, researchInterests } = req.body;
  if (fullName) user.fullName = fullName;
  if (department) user.department = department;
  if (rank) user.rank = rank;
  if (researchInterests !== undefined) user.researchInterests = String(researchInterests).trim();

  await user.save();
  res.json({ message: "Profile updated", user: sanitizeUser(user) });
}

module.exports = {
  createUserByDirector,
  listPendingUsers,
  listUsers,
  approveUser,
  rejectUser,
  updateUserByDirector,
  deleteUserByDirector,
  updateMyProfile,
};

