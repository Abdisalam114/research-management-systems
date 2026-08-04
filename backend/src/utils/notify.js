const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");
const { sendEmailToUser } = require("./emailNotify");

async function notifyUser(userId, { title, body, link, downloadLink, type = "info", programTier }) {
  if (!userId) return;
  try {
    await Notification.create({
      userId,
      type,
      title: title || "Notification",
      body: body || "",
      link: link || "",
      downloadLink: downloadLink || "",
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
 * Shared staff (director, coordinator, finance, leadership) are system-wide —
 * never filter those accounts by programTier. Still stamp programTier on the
 * notification so the Open action can show the related UG/PG record.
 */
async function notifyUsersByRole(role, payload, programTier) {
  const filter = { role, status: USER_STATUSES.ACTIVE };
  const sharedStaff = [
    "research_director",
    "faculty_coordinator",
    "finance_officer",
    "leadership",
  ].includes(role);
  if (programTier && !sharedStaff) {
    filter.programTier = programTier;
  }
  const users = await User.find(filter).select("_id");
  const notifyTier = payload?.programTier || programTier;
  await Promise.all(users.map((u) => notifyUser(u._id, { ...payload, programTier: notifyTier })));
}

module.exports = { notifyUser, notifyUsersByRole };
