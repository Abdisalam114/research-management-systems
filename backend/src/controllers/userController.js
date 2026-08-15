const { User, USER_STATUSES, ROLES } = require("../models/User");
const { SYSTEM_ROLES } = require("../constants/systemRoles");
const { AppError } = require("../utils/AppError");
const { PROGRAM_TIERS, isValidProgramTier } = require("../constants/programTier");
const mongoose = require("mongoose");

const SINGLETON_STAFF_ROLES = Object.freeze([
  ROLES.FACULTY_COORDINATOR,
  ROLES.FINANCE_OFFICER,
  ROLES.LEADERSHIP,
]);

function isAssignableRole(role) {
  return SYSTEM_ROLES.includes(role) && role !== ROLES.RESEARCH_DIRECTOR;
}

function assertValidObjectId(id, label = "User id") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`${label} is invalid`, 400);
  }
}

function sanitizeUser(userDoc) {
  const tier = userDoc.programTier;
  const programTierLabel =
    tier === "undergraduate" ? "Undergraduate" : tier === "postgraduate" ? "Postgraduate" : tier || "—";
  const isSharedStaff = [
    ROLES.RESEARCH_DIRECTOR,
    ROLES.FACULTY_COORDINATOR,
    ROLES.FINANCE_OFFICER,
    ROLES.LEADERSHIP,
  ].includes(userDoc.role);
  return {
    id: userDoc._id,
    fullName: userDoc.fullName,
    email: userDoc.email,
    role: userDoc.role,
    department: userDoc.department,
    rank: userDoc.rank,
    status: userDoc.status,
    programTier: tier,
    programTierLabel: isSharedStaff ? "All programs (UG + PG)" : programTierLabel,
    isSharedStaff,
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

function isDirectorReq(req) {
  return req.user?.role === ROLES.RESEARCH_DIRECTOR;
}

function userFind(req, filter) {
  return isDirectorReq(req) ? User.find(filter) : User.find(req.userWhere(filter));
}

function userFindOne(req, filter, select = "") {
  const q = isDirectorReq(req) ? User.findOne(filter) : User.findOne(req.userWhere(filter));
  return select ? q.select(select) : q;
}

async function listPendingUsers(req, res) {
  const users = await userFind(req, { status: USER_STATUSES.PENDING }).sort({ createdAt: -1 });
  res.json({ users: users.map(sanitizeUser) });
}

async function createUserByDirector(req, res) {
  const { fullName, email, password, role, department, rank, status, dualPlatform, programTier: bodyTier } =
    req.body || {};

  if (dualPlatform === true || dualPlatform === "true") {
    throw new AppError(
      "Staff accounts (Director, Coordinator, Finance, Leadership) are already system-wide. Assign researchers to UG or PG only.",
      400
    );
  }

  if (!fullName || !email || !password || !role || !department || !rank) {
    throw new AppError("All fields are required", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  if (!isAssignableRole(role)) {
    throw new AppError(
      role === ROLES.RESEARCH_DIRECTOR
        ? "Research Director accounts cannot be created here"
        : "Invalid role",
      400
    );
  }

  if (SINGLETON_STAFF_ROLES.includes(role)) {
    const existing = await User.findOne({
      role,
      status: { $in: [USER_STATUSES.ACTIVE, USER_STATUSES.PENDING] },
    });
    if (existing) {
      throw new AppError(
        `Only one ${role.replace(/_/g, " ")} account is allowed for the whole system (UG + PG).`,
        409
      );
    }
  }

  const nextStatus =
    status && Object.values(USER_STATUSES).includes(status) ? status : USER_STATUSES.ACTIVE;

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) throw new AppError("Email already in use", 409);

  let assignedTier = isValidProgramTier(bodyTier) ? bodyTier : req.programTier || null;
  if (role === ROLES.RESEARCHER) {
    if (!isValidProgramTier(assignedTier)) {
      throw new AppError("programTier is required for researchers (undergraduate or postgraduate)", 400);
    }
  } else if (!isValidProgramTier(assignedTier)) {
    assignedTier = PROGRAM_TIERS.UNDERGRADUATE;
  }

  const user = await User.create(
    req.tierAssign({
      fullName: String(fullName).trim(),
      email: String(email).toLowerCase().trim(),
      password,
      role,
      department: String(department).trim(),
      rank: String(rank).trim(),
      status: nextStatus,
      isProtected: false,
      programTier: assignedTier,
    })
  );

  const sanitized = sanitizeUser(user);
  res.status(201).json({
    message: `${nextStatus === USER_STATUSES.ACTIVE ? "User created and activated" : "User created (pending)"} — ${
      sanitized.isSharedStaff ? "system-wide staff (UG + PG)" : `assigned to ${sanitized.programTierLabel}`
    }`,
    user: sanitized,
  });
}


async function listUsers(req, res) {
  const { status, role, q } = req.query || {};
  const filter = {};
  const isDirector = req.user?.role === ROLES.RESEARCH_DIRECTOR;

  // Non-directors may only list active researchers (for supervisor / peer assignment).
  if (!isDirector) {
    filter.role = ROLES.RESEARCHER;
    filter.status = USER_STATUSES.ACTIVE;
  } else {
    if (status && Object.values(USER_STATUSES).includes(status)) filter.status = status;
    if (role && Object.values(ROLES).includes(role)) filter.role = role;
    else filter.role = { $ne: ROLES.RESEARCH_DIRECTOR };
  }

  if (q) {
    const qq = String(q).trim().toLowerCase();
    if (qq) {
      filter.$or = [{ email: { $regex: qq, $options: "i" } }, { fullName: { $regex: qq, $options: "i" } }];
    }
  }

  const users = await userFind(req, filter).sort({
    createdAt: -1,
  });
  let list = users;
  if (req.user?.role === ROLES.FACULTY_COORDINATOR) {
    const { coordinatorMatchesResearcherDept, resolveCoordinatorDepartment } = require("../utils/facultyMatcher");
    const dept = resolveCoordinatorDepartment(req);
    list = dept
      ? users.filter((u) => coordinatorMatchesResearcherDept(dept, u.department))
      : [];
  }
  res.json({ users: list.map(sanitizeUser) });
}

async function approveUser(req, res) {
  const { id } = req.params;
  const user = await userFindOne(req, { _id: id });
  if (!user) throw new AppError("User not found", 404);

  user.status = USER_STATUSES.ACTIVE;
  await user.save();

  res.json({ message: "User approved", user: sanitizeUser(user) });
}

async function rejectUser(req, res) {
  const { id } = req.params;
  const user = await userFindOne(req, { _id: id });
  if (!user) throw new AppError("User not found", 404);

  assertNotSelfTarget(req, user._id, "reject/deactivate");
  user.status = USER_STATUSES.REJECTED;
  user.refreshToken = null;
  await user.save();

  res.json({ message: "User rejected", user: sanitizeUser(user) });
}

async function updateUserByDirector(req, res) {
  const { id } = req.params;
  assertValidObjectId(id);
  const user = await userFindOne(req, { _id: id }, "+refreshToken");
  if (!user) throw new AppError("User not found", 404);

  const { role, status, fullName, department, rank, isProtected, programTier: bodyTier } = req.body || {};

  // Prevent administrators from locking themselves out via role/status edits.
  if (role !== undefined || status !== undefined || isProtected !== undefined) {
    assertNotSelfTarget(req, user._id, "change role/status/protection");
  }

  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (department !== undefined) user.department = String(department).trim();
  if (rank !== undefined) user.rank = String(rank).trim();

  if (role !== undefined) {
    if (!isAssignableRole(role) && role !== ROLES.RESEARCH_DIRECTOR) {
      throw new AppError("Invalid role", 400);
    }
    if (role === ROLES.RESEARCH_DIRECTOR) {
      throw new AppError("Cannot assign Research Director role here", 400);
    }
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

  if (bodyTier !== undefined && user.role === ROLES.RESEARCHER) {
    if (!isValidProgramTier(bodyTier)) throw new AppError("Invalid program tier (undergraduate or postgraduate)", 400);
    user.programTier = bodyTier;
  }

  await user.save();
  res.json({ message: "User updated", user: sanitizeUser(user) });
}

async function deleteUserByDirector(req, res) {
  const { id } = req.params;
  assertValidObjectId(id);
  const user = await userFindOne(req, { _id: id });
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
  if (department) {
    const nextDept = String(department).trim();
    if (user.role === "researcher") {
      const home = String(user.department || "").trim();
      const { coordinatorMatchesResearcherDept } = require("../utils/facultyMatcher");
      if (home && nextDept && !coordinatorMatchesResearcherDept(home, nextDept)) {
        throw new AppError("You can only stay in your own faculty", 400);
      }
    }
    user.department = nextDept;
  }
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

