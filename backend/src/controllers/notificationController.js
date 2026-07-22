const { Notification } = require("../models/Notification");
const { AppError } = require("../utils/AppError");

function sanitizeNotification(n) {
  return {
    id: n._id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    programTier: n.programTier || null,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

/** All roles (including Director) are scoped to the active portal tier. */
function notificationFilter(req) {
  return req.tierWhere({ userId: req.user.id });
}

async function listMyNotifications(req, res) {
  const notifications = await Notification.find(notificationFilter(req)).sort({ createdAt: -1 }).limit(100);
  res.json({ notifications: notifications.map(sanitizeNotification) });
}

async function markRead(req, res) {
  const { id } = req.params;
  const n = await Notification.findOne(req.tierWhere({ _id: id, userId: req.user.id }));
  if (!n) throw new AppError("Notification not found", 404);
  if (String(n.userId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (!n.readAt) n.readAt = new Date();
  await n.save();
  res.json({ notification: sanitizeNotification(n) });
}

async function unreadCount(req, res) {
  const count = await Notification.countDocuments({
    ...notificationFilter(req),
    readAt: null,
  });
  res.json({ unread: count });
}

module.exports = { listMyNotifications, markRead, unreadCount };
