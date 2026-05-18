import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as conversationApi from "../services/conversationApi";

export function MessagesPage() {
  const { accessToken, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [newParticipantId, setNewParticipantId] = useState("");
  const [messageBody, setMessageBody] = useState("");

  async function loadList() {
    const res = await conversationApi.listConversations(accessToken);
    setConversations(res.conversations || []);
  }

  async function loadActive(id) {
    if (!id) {
      setActive(null);
      return;
    }
    const res = await conversationApi.getConversation(accessToken, id);
    setActive(res.conversation);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError("");
        await loadList();
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load messages");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    loadActive(activeId).catch((e) => setError(e?.response?.data?.message || "Failed to load conversation"));
  }, [activeId, accessToken]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Messages</h2>
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Start conversation</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Other user ID"
            value={newParticipantId}
            onChange={(e) => setNewParticipantId(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              try {
                setError("");
                const res = await conversationApi.createConversation(accessToken, [newParticipantId.trim()]);
                setNewParticipantId("");
                await loadList();
                setActiveId(res.conversation.id);
              } catch (e) {
                setError(e?.response?.data?.message || "Failed to create conversation");
              }
            }}
          >
            Create
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Conversations</div>
          <div style={{ display: "grid", gap: 6 }}>
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={activeId === c.id ? "btn primary" : "btn"}
                onClick={() => setActiveId(c.id)}
              >
                Chat ({c.participants?.length || 0})
              </button>
            ))}
            {conversations.length === 0 ? <div className="muted">No conversations yet.</div> : null}
          </div>
        </div>

        <div className="card">
          {active ? (
            <>
              <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
                {(active.messages || []).map((m, idx) => (
                  <div key={idx} className="card">
                    <div className="muted" style={{ fontSize: 11 }}>
                      {String(m.senderId) === String(user?.id) ? "You" : m.senderId}
                    </div>
                    <div style={{ marginTop: 4 }}>{m.body}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  style={{ flex: 1 }}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type a message"
                />
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    try {
                      setError("");
                      await conversationApi.sendMessage(accessToken, active.id, messageBody);
                      setMessageBody("");
                      await loadActive(active.id);
                    } catch (e) {
                      setError(e?.response?.data?.message || "Failed to send");
                    }
                  }}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="muted">Select a conversation</div>
          )}
        </div>
      </div>
    </div>
  );
}
