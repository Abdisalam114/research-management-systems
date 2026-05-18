const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");

async function notifyUser(userId, { title, body, link, type = "info" }) {
  if (!userId) return;
  await Notification.create({
    userId,
    type,
    title: title || "Notification",
    body: body || "",
    link: link || "",
  });
}

async function notifyUsersByRole(role, payload) {
  const users = await User.find({ role, status: USER_STATUSES.ACTIVE }).select("_id");
  await Promise.all(users.map((u) => notifyUser(u._id, payload)));
}

module.exports = { notifyUser, notifyUsersByRole };
