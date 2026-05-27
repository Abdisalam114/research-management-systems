import { api } from "./api";

export async function listConversations(accessToken) {
  const res = await api.get("/api/conversations", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function getConversation(accessToken, id) {
  const res = await api.get(`/api/conversations/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function createConversation(accessToken, participantIds) {
  const res = await api.post(
    "/api/conversations",
    { participantIds },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

export async function openGroupChat(accessToken, groupId) {
  const res = await api.get(`/api/conversations/group/${groupId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function sendMessage(accessToken, conversationId, body) {
  const res = await api.post(
    `/api/conversations/${conversationId}/messages`,
    { body },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}
