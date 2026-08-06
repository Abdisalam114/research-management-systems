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
    downloadLink: n.downloadLink || "",
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

async function markAllRead(req, res) {
  const filter = { ...notificationFilter(req), readAt: null };
  const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  res.json({
    message: "All notifications marked as read",
    updated: result.modifiedCount ?? result.nModified ?? 0,
  });
}

async function clearAll(req, res) {
  const result = await Notification.deleteMany(notificationFilter(req));
  res.json({
    message: "Notifications cleared",
    deleted: result.deletedCount ?? 0,
  });
}

module.exports = { listMyNotifications, markRead, unreadCount, markAllRead, clearAll };
