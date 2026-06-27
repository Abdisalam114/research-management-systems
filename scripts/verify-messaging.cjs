/**
 * Verify messaging + per-user notifications.
 * Usage: node scripts/verify-messaging.cjs
 */
const BASE = "http://127.0.0.1:5000";

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Login failed for ${email}`);
  return data.accessToken;
}

async function api(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${path} failed (${res.status})`);
  return data;
}

async function main() {
  const senderToken = await login("director@rms.edu", "Director2024!");
  const receiverToken = await login("asha@rms.edu", "Researcher2024!");

  const usersRes = await api(senderToken, "/api/conversations/users");
  const receiver = (usersRes.users || []).find((u) => u.email === "asha@rms.edu");
  if (!receiver) throw new Error("Receiver not in messageable users");

  const convRes = await api(senderToken, "/api/conversations", {
    method: "POST",
    body: JSON.stringify({ participantIds: [receiver.id] }),
  });
  const convId = convRes.conversation?.id;
  if (!convId) throw new Error("No conversation id");

  const before = await api(receiverToken, "/api/notifications/me/unread-count");
  const marker = `verify-msg-${Date.now()}`;

  await api(senderToken, `/api/conversations/${convId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: marker }),
  });

  const after = await api(receiverToken, "/api/notifications/me/unread-count");
  const notes = await api(receiverToken, "/api/notifications/me");
  const hit = (notes.notifications || []).find((n) => n.body?.includes(marker) || n.title?.includes("New message"));

  console.log(
    JSON.stringify(
      {
        ok: Boolean(hit) && after.unread >= before.unread + 1,
        convId,
        receiverUnreadBefore: before.unread,
        receiverUnreadAfter: after.unread,
        messageNotification: hit
          ? { id: hit.id, title: hit.title, link: hit.link, type: hit.type }
          : null,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
