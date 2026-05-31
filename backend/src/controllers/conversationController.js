const { Conversation } = require("../models/Conversation");
const { ResearchGroup } = require("../models/ResearchGroup");
const { User, USER_STATUSES } = require("../models/User");
const { NOTIFICATION_TYPES } = require("../models/Notification");
const { AppError } = require("../utils/AppError");
const { notifyUser } = require("../utils/notify");
const { userDisplayName } = require("../utils/userDisplay");

function sanitizeConversation(c) {
  return {
    id: c._id,
    participants: c.participants,
    lastMessageAt: c.lastMessageAt,
    messages: c.messages,
    groupId: c.groupId,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function loadUserMap(ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!unique.length) return {};
  const users = await User.find({ _id: { $in: unique } }).select("fullName name email role department");
  return Object.fromEntries(
    users.map((u) => [
      String(u._id),
      {
        id: u._id,
        fullName: userDisplayName(u),
        email: u.email,
        role: u.role,
        department: u.department,
      },
    ])
  );
}

async function enrichConversation(c, currentUserId) {
  const base = sanitizeConversation(c);
  const senderIds = (c.messages || []).map((m) => m.senderId);
  const byId = await loadUserMap([...(c.participants || []), ...senderIds]);

  base.participantProfiles = (c.participants || []).map(
    (id) => byId[String(id)] || { id, fullName: "Unknown user" }
  );
  base.messages = (c.messages || []).map((m) => ({
    id: m._id,
    senderId: m.senderId,
    senderName: byId[String(m.senderId)]?.fullName || "Unknown",
    body: m.body,
    at: m.at,
    isMine: String(m.senderId) === String(currentUserId),
  }));
  base.preview = c.messages?.length ? c.messages[c.messages.length - 1].body : "";
  base.label = c.groupId
    ? c.title || "Group chat"
    : base.participantProfiles
        .filter((p) => String(p.id) !== String(currentUserId))
        .map((p) => p.fullName)
        .join(", ") || "Direct chat";
  return base;
}

async function listMessageableUsers(req, res) {
  const users = await User.find({ status: USER_STATUSES.ACTIVE, _id: { $ne: req.user.id } })
    .select("fullName name email role department")
    .sort({ fullName: 1, name: 1 })
    .limit(300);

  res.json({
    users: users.map((u) => ({
      id: u._id,
      fullName: userDisplayName(u),
      email: u.email,
      role: u.role,
      department: u.department,
    })),
  });
}

async function listMyConversations(req, res) {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });
  const enriched = await Promise.all(conversations.map((c) => enrichConversation(c, req.user.id)));
  res.json({ conversations: enriched });
}

async function openGroupChat(req, res) {
  const { groupId } = req.params;
  const group = await ResearchGroup.findById(groupId);
  if (!group) throw new AppError("Group not found", 404);

  const isMember = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
  const isCreator = String(group.createdBy) === String(req.user.id);
  if (!isMember && !isCreator && req.user.role !== "research_director") {
    throw new AppError("Forbidden", 403);
  }

  let conversation = await Conversation.findOne({ groupId });
  if (!conversation) {
    const participantIds = Array.from(
      new Set([String(group.createdBy), ...(group.members || []).map((m) => String(m.userId))])
    );
    conversation = await Conversation.create({
      participants: participantIds,
      groupId,
      title: group.name,
      messages: [],
      lastMessageAt: null,
    });
  } else {
    const participantSet = new Set((conversation.participants || []).map(String));
    let changed = false;
    (group.members || []).forEach((m) => {
      const uid = String(m.userId);
      if (!participantSet.has(uid)) {
        conversation.participants.push(m.userId);
        participantSet.add(uid);
        changed = true;
      }
    });
    const creatorId = String(group.createdBy);
    if (!participantSet.has(creatorId)) {
      conversation.participants.push(group.createdBy);
      changed = true;
    }
    if (changed) await conversation.save();
  }

  res.json({ conversation: await enrichConversation(conversation, req.user.id) });
}

async function createConversation(req, res) {
  const { participantIds } = req.body || {};
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new AppError("participantIds is required", 400);
  }

  const others = participantIds.map(String).filter((id) => id && id !== String(req.user.id));
  if (!others.length) throw new AppError("Select at least one other user", 400);

  const activeUsers = await User.find({
    _id: { $in: others },
    status: USER_STATUSES.ACTIVE,
  }).select("_id");
  if (activeUsers.length !== others.length) {
    throw new AppError("One or more selected users are invalid or inactive", 400);
  }

  const ids = Array.from(new Set([String(req.user.id), ...others])).slice(0, 20);

  if (ids.length === 2) {
    const existing = await Conversation.findOne({
      groupId: null,
      participants: { $all: ids, $size: ids.length },
    });
    if (existing) {
      return res.json({ conversation: await enrichConversation(existing, req.user.id), reused: true });
    }
  }

  const conversation = await Conversation.create({
    participants: ids,
    messages: [],
    lastMessageAt: null,
  });

  res.status(201).json({ conversation: await enrichConversation(conversation, req.user.id) });
}

async function sendMessage(req, res) {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body || !String(body).trim()) throw new AppError("body is required", 400);

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new AppError("Conversation not found", 404);

  const isParticipant = (conversation.participants || []).some((p) => String(p) === String(req.user.id));
  if (!isParticipant) throw new AppError("Forbidden", 403);

  const sender = await User.findById(req.user.id).select("fullName name email");
  const senderName = userDisplayName(sender);
  const text = String(body).trim();

  conversation.messages.push({ senderId: req.user.id, body: text });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const link = `/messages?conversationId=${conversation._id}`;
  const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  let notified = 0;

  for (const pid of conversation.participants || []) {
    if (String(pid) === String(req.user.id)) continue;
    await notifyUser(pid, {
      type: NOTIFICATION_TYPES.MESSAGE,
      title: `New message from ${senderName}`,
      body: preview,
      link,
    });
    notified += 1;
  }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(__dirname, "../../../debug-6113cc.log"),
      `${JSON.stringify({
        sessionId: "6113cc",
        location: "conversationController.js:sendMessage",
        message: "message sent with notifications",
        data: { conversationId: String(conversation._id), notified, participantCount: conversation.participants?.length },
        timestamp: Date.now(),
        hypothesisId: "MSG1",
        runId: "collab-comms",
      })}\n`
    );
  } catch (_) {}
  // #endregion

  res.json({ message: "Sent", conversation: await enrichConversation(conversation, req.user.id) });
}

async function getConversation(req, res) {
  const { id } = req.params;
  const conversation = await Conversation.findById(id);
  if (!conversation) throw new AppError("Conversation not found", 404);

  const isParticipant = (conversation.participants || []).some((p) => String(p) === String(req.user.id));
  if (!isParticipant) throw new AppError("Forbidden", 403);

  res.json({ conversation: await enrichConversation(conversation, req.user.id) });
}

module.exports = {
  listMyConversations,
  listMessageableUsers,
  createConversation,
  sendMessage,
  getConversation,
  openGroupChat,
};
