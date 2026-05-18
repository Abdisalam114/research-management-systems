const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = Object.freeze({
  RESEARCH_DIRECTOR: "research_director",
  FACULTY_COORDINATOR: "faculty_coordinator",
  FINANCE_OFFICER: "finance_officer",
  RESEARCHER: "researcher",
});

const USER_STATUSES = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
});

function normalizeResearchInterests(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .filter((item) => item != null && String(item).trim())
      .map((item) => String(item).trim())
      .join(", ");
  }
  return String(value).trim();
}

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.RESEARCHER,
    },
    department: { type: String, required: true, trim: true },
    rank: { type: String, required: true, trim: true },
    researchInterests: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(USER_STATUSES),
      default: USER_STATUSES.PENDING,
      required: true,
    },
    // Institutional safeguard: protected accounts (e.g., seeded admins) require elevated handling.
    isProtected: { type: Boolean, default: false, index: true },
    refreshToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.path("researchInterests").cast(normalizeResearchInterests);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre("save", function normalizeResearchInterestsOnSave() {
  if (this.isModified("researchInterests")) {
    this.researchInterests = normalizeResearchInterests(this.researchInterests);
  }
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = { User, ROLES, USER_STATUSES, normalizeResearchInterests };

