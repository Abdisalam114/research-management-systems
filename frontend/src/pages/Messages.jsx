import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as conversationApi from "../services/conversationApi";
import "./messages.css";

function formatWhen(at) {
  if (!at) return "";
  try {
    return new Date(at).toLocaleString();
  } catch {
    return "";
  }
}

export function MessagesPage() {
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activeId, setActiveId] = useState(searchParams.get("conversationId") || "");
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  const loadList = useCallback(async () => {
    const res = await conversationApi.listConversations(accessToken);
    setConversations(res.conversations || []);
  }, [accessToken]);

  const loadUsers = useCallback(async () => {
    const res = await conversationApi.listMessageableUsers(accessToken);
    setUsers(res.users || []);
  }, [accessToken]);

  const loadActive = useCallback(
    async (id) => {
      if (!id) {
        setActive(null);
        return;
      }
      const res = await conversationApi.getConversation(accessToken, id);
      setActive(res.conversation);
    },
    [accessToken]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError("");
        await Promise.all([loadList(), loadUsers()]);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load messages");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList, loadUsers]);

  useEffect(() => {
    loadActive(activeId).catch((e) => setError(e?.response?.data?.message || "Failed to load conversation"));
    if (activeId && searchParams.get("conversationId") !== activeId) {
      setSearchParams({ conversationId: activeId }, { replace: true });
    }
    if (!activeId && searchParams.get("conversationId")) {
      setSearchParams({}, { replace: true });
    }
  }, [activeId, accessToken, loadActive, searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadList().catch(() => {});
      if (activeId) loadActive(activeId).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [activeId, loadActive, loadList]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  async function startChat() {
    if (!selectedUserId) return;
    try {
      setError("");
      const res = await conversationApi.createConversation(accessToken, [selectedUserId]);
      setSelectedUserId("");
      setUserQuery("");
      await loadList();
      setActiveId(res.conversation.id);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to start conversation");
    }
  }

  async function handleSend() {
    if (!active?.id || !messageBody.trim()) return;
    try {
      setSending(true);
      setError("");
      await conversationApi.sendMessage(accessToken, active.id, messageBody.trim());
      setMessageBody("");
      await Promise.all([loadActive(active.id), loadList()]);
      // #region agent log
      fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
        body: JSON.stringify({
          sessionId: "6113cc",
          location: "Messages.jsx:handleSend",
          message: "message sent from UI",
          data: { conversationId: active.id, senderId: user?.id },
          timestamp: Date.now(),
          hypothesisId: "MSG1",
          runId: "collab-comms",
        }),
      }).catch(() => {});
      // #endregion
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="messagesPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Messages</h1>
        <p className="dashPageSub">
          Message all active users — each message goes to the recipient&apos;s notifications.
        </p>
      </header>

      {error ? <div className="card messagesError">{error}</div> : null}

      <div className="card messagesStartCard">
        <div className="dashboardSectionTitle">Start new chat</div>
        <div className="messagesStartRow">
          <input
            className="messagesSearch"
            placeholder="Search by name, email, department…"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <select
            className="messagesUserSelect"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select user…</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} — {u.role} ({u.department || "—"})
              </option>
            ))}
          </select>
          <button type="button" className="btn primary" onClick={startChat} disabled={!selectedUserId}>
            Start chat
          </button>
        </div>
      </div>

      <div className="messagesLayout">
        <aside className="card messagesSidebar">
          <div className="dashboardSectionTitle">Conversations</div>
          <div className="messagesConvList">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={activeId === c.id ? "messagesConvItem active" : "messagesConvItem"}
                onClick={() => setActiveId(c.id)}
              >
                <div className="messagesConvTitle">{c.label || "Chat"}</div>
                <div className="messagesConvPreview muted">{c.preview || "No messages yet"}</div>
              </button>
            ))}
            {conversations.length === 0 ? <div className="muted">No conversations yet.</div> : null}
          </div>
        </aside>

        <section className="card messagesThread">
          {active ? (
            <>
              <div className="messagesThreadHeader">
                <div>
                  <div style={{ fontWeight: 800 }}>{active.label}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {(active.participantProfiles || [])
                      .filter((p) => String(p.id) !== String(user?.id))
                      .map((p) => `${p.fullName}${p.department ? ` (${p.department})` : ""}`)
                      .join(" • ") || "Participants"}
                  </div>
                </div>
                {active.groupId ? (
                  <Link className="btn btnSm" to="/groups">
                    Groups
                  </Link>
                ) : null}
              </div>

              <div className="messagesBubbleList">
                {(active.messages || []).map((m) => (
                  <div key={m.id || `${m.at}-${m.senderId}`} className={m.isMine ? "messagesBubble mine" : "messagesBubble"}>
                    <div className="messagesBubbleMeta">
                      <strong>{m.isMine ? "You" : m.senderName}</strong>
                      <span className="muted">{formatWhen(m.at)}</span>
                    </div>
                    <div>{m.body}</div>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>

              <div className="messagesComposer">
                <input
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type a message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button type="button" className="btn primary" onClick={handleSend} disabled={sending || !messageBody.trim()}>
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <div className="messagesEmpty muted">Select a conversation or start a new chat.</div>
          )}
        </section>
      </div>
    </div>
  );
}
