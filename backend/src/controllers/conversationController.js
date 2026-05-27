const { Conversation } = require("../models/Conversation");
const { ResearchGroup } = require("../models/ResearchGroup");
const { AppError } = require("../utils/AppError");

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

async function listMyConversations(req, res) {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({ lastMessageAt: -1, updatedAt: -1 });
  res.json({ conversations: conversations.map(sanitizeConversation) });
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
      new Set([
        String(group.createdBy),
        ...(group.members || []).map((m) => String(m.userId)),
      ])
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

  res.json({ conversation: sanitizeConversation(conversation) });
}

async function createConversation(req, res) {
  const { participantIds } = req.body || {};
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new AppError("participantIds is required", 400);
  }

  const ids = Array.from(new Set([String(req.user.id), ...participantIds.map(String)])).slice(0, 20);

  // MVP: create new conversation always (no dedupe).
  const conversation = await Conversation.create({
    participants: ids,
    messages: [],
    lastMessageAt: null,
  });

  res.status(201).json({ conversation: sanitizeConversation(conversation) });
}

async function sendMessage(req, res) {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body) throw new AppError("body is required", 400);

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new AppError("Conversation not found", 404);

  const isParticipant = (conversation.participants || []).some((p) => String(p) === String(req.user.id));
  if (!isParticipant) throw new AppError("Forbidden", 403);

  conversation.messages.push({ senderId: req.user.id, body: String(body) });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  res.json({ message: "Sent", conversation: sanitizeConversation(conversation) });
}

async function getConversation(req, res) {
  const { id } = req.params;
  const conversation = await Conversation.findById(id);
  if (!conversation) throw new AppError("Conversation not found", 404);

  const isParticipant = (conversation.participants || []).some((p) => String(p) === String(req.user.id));
  if (!isParticipant) throw new AppError("Forbidden", 403);

  res.json({ conversation: sanitizeConversation(conversation) });
}

module.exports = { listMyConversations, createConversation, sendMessage, getConversation, openGroupChat };

