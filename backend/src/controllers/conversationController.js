const { Conversation } = require("../models/Conversation");
const { AppError } = require("../utils/AppError");

function sanitizeConversation(c) {
  return {
    id: c._id,
    participants: c.participants,
    lastMessageAt: c.lastMessageAt,
    messages: c.messages,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function listMyConversations(req, res) {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({ lastMessageAt: -1, updatedAt: -1 });
  res.json({ conversations: conversations.map(sanitizeConversation) });
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

module.exports = { listMyConversations, createConversation, sendMessage, getConversation };

