import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as groupApi from "../services/groupApi";
import * as conversationApi from "../services/conversationApi";
import { PageHeader } from "../components/PageHeader";

const CREATE_ROLES = ["researcher", "faculty_coordinator", "research_director"];

function isMember(group, userId) {
  return (group.members || []).some((m) => String(m.userId) === String(userId));
}

export function GroupsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState({ total: 0, thesis: 0, collaboration: 0 });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const canCreate = CREATE_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    const res = await groupApi.listGroups(accessToken);
    setGroups(res.groups || []);
    try {
      const st = await groupApi.groupStats(accessToken);
      setStats(st.stats || { total: 0, thesis: 0, collaboration: 0 });
    } catch (_) {
      setStats({ total: 0, thesis: 0, collaboration: 0 });
    }
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const headerStats = useMemo(() => {
    const mine = groups.filter((g) => isMember(g, user?.id)).length;
    return [
      { label: "Total groups", value: stats.total, accent: "#0ea5e9" },
      { label: "Thesis groups", value: stats.thesis, accent: "#38bdf8" },
      { label: "Research groups", value: stats.collaboration, accent: "#1d4ed8" },
      { label: "My groups", value: mine, accent: "#7dd3fc" },
    ];
  }, [groups, user?.id, stats]);

  async function openChat(groupId) {
    try {
      const res = await conversationApi.openGroupChat(accessToken, groupId);
      navigate(`/messages?conversationId=${res.conversation.id}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to open group chat");
    }
  }

  return (
    <div>
      <PageHeader
        title="Groups"
        subtitle="Research collaboration groups (join/leave + chat). Thesis supervision is in the Thesis module."
        stats={headerStats}
        actions={
          <>
            {canCreate ? (
              <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close form" : "+ New group"}
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => navigate("/thesis")}>🎓 Thesis module</button>
            <button type="button" className="btn" onClick={() => navigate("/messages")}>💬 Messages</button>
          </>
        }
      />
      {loading ? <p className="muted">Loading groups…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginBottom: 10 }}>{error}</div> : null}

      {canCreate && showForm ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Create research group</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  await groupApi.createGroup(accessToken, { name });
                  setName("");
                  setShowForm(false);
                  await reload();
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to create group");
                }
              }}
            >
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div style={{ fontWeight: 800 }}>Research groups</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {groups.map((g) => {
            const member = isMember(g, user?.id);
            return (
              <div key={g.id} className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{g.name}</div>
                    <div className="muted">Members: {g.members?.length || 0}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {member ? (
                      <button type="button" className="btn" onClick={() => openChat(g.id)}>Open chat</button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          try {
                            setError("");
                            await groupApi.joinGroup(accessToken, g.id);
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to join");
                          }
                        }}
                      >
                        Join
                      </button>
                    )}
                    {member ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          try {
                            setError("");
                            await groupApi.leaveGroup(accessToken, g.id);
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to leave");
                          }
                        }}
                      >
                        Leave
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {groups.length === 0 ? <div className="muted">No research groups yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
