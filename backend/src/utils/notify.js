const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");
const { sendEmailToUser } = require("./emailNotify");

async function notifyUser(userId, { title, body, link, type = "info", programTier }) {
  if (!userId) return;
  try {
    await Notification.create({
      userId,
      type,
      title: title || "Notification",
      body: body || "",
      link: link || "",
      ...(programTier ? { programTier } : {}),
    });
  } catch (err) {
    throw err;
  }
  const appUrl = process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
  const emailBody = `${body || ""}\n\nOpen: ${appUrl}${link || ""}`;
  sendEmailToUser(userId, title || "Jamhuriya RMS", emailBody).catch(() => {});
}

/**
 * Notify all active users with a role.
 * Research Director is shared across UG/PG — never filter director accounts by programTier.
 * Still store programTier on the notification so Open can switch the Director portal.
 */
async function notifyUsersByRole(role, payload, programTier) {
  const filter = { role, status: USER_STATUSES.ACTIVE };
  const isDirectorRole = role === "research_director";
  if (programTier && !isDirectorRole) {
    filter.programTier = programTier;
  }
  const users = await User.find(filter).select("_id");
  // Prefer explicit payload.programTier, then the caller's tier arg
  const notifyTier = payload?.programTier || programTier;
  await Promise.all(users.map((u) => notifyUser(u._id, { ...payload, programTier: notifyTier })));
}

module.exports = { notifyUser, notifyUsersByRole };
