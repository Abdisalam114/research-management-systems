/** Display name for User docs (supports legacy `name` field). */
function userDisplayName(user) {
  if (!user || typeof user !== "object") return "—";
  const label = (user.fullName || user.name || user.email || "").trim();
  return label || "—";
}

module.exports = { userDisplayName };
