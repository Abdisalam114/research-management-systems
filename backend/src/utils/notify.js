const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");
const { sendEmailToUser } = require("./emailNotify");

async function notifyUser(userId, { title, body, link, type = "info", programTier }) {
  if (!userId) return;
  await Notification.create({
    userId,
    type,
    title: title || "Notification",
    body: body || "",
    link: link || "",
    ...(programTier ? { programTier } : {}),
  });
  const appUrl = process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
  const emailBody = `${body || ""}\n\nOpen: ${appUrl}${link || ""}`;
  sendEmailToUser(userId, title || "Jamhuriya RMS", emailBody).catch(() => {});
}

async function notifyUsersByRole(role, payload, programTier) {
  const filter = { role, status: USER_STATUSES.ACTIVE };
  if (programTier) filter.programTier = programTier;
  const users = await User.find(filter).select("_id");
  await Promise.all(users.map((u) => notifyUser(u._id, { ...payload, programTier })));
}

module.exports = { notifyUser, notifyUsersByRole };
