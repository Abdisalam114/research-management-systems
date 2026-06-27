const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");

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
}

async function notifyUsersByRole(role, payload, programTier) {
  const filter = { role, status: USER_STATUSES.ACTIVE };
  if (programTier) filter.programTier = programTier;
  const users = await User.find(filter).select("_id");
  await Promise.all(users.map((u) => notifyUser(u._id, { ...payload, programTier })));
}

module.exports = { notifyUser, notifyUsersByRole };
