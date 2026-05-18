import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as groupApi from "../services/groupApi";

const CREATE_ROLES = ["researcher", "faculty_coordinator", "research_director"];

function isMember(group, userId) {
  return (group.members || []).some((m) => String(m.userId) === String(userId));
}

export function GroupsPage() {
  const { accessToken, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");

  const canCreate = CREATE_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    const res = await groupApi.listGroups(accessToken);
    setGroups(res.groups || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Collaboration Groups</h2>
      {loading ? <p className="muted">Loading groups…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canCreate ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Create Group</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  await groupApi.createGroup(accessToken, { name });
                  setName("");
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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Groups</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {groups.map((g) => {
            const member = isMember(g, user?.id);
            return (
              <div key={g.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{g.name}</div>
                    <div className="muted">Members: {g.members?.length || 0}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!member ? (
                      <button
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
                    ) : (
                      <button
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
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {groups.length === 0 ? <div className="muted">No groups yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
