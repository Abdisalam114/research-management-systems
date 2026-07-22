import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as groupApi from "../services/groupApi";
import * as conversationApi from "../services/conversationApi";
import { PageHeader } from "../components/PageHeader";
import { GroupsModuleNav } from "../components/GroupsModuleNav";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import "./groups.css";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const canCreate = CREATE_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    const res = await groupApi.listGroups(accessToken);
    const list = res.groups || [];
    setGroups(list);
    try {
      const st = await groupApi.groupStats(accessToken);
      setStats(st.stats || { total: list.length, thesis: 0, collaboration: list.length });
    } catch (_) {
      // Keep list-derived counts — do not wipe to zeros when stats API fails
      setStats({
        total: list.length,
        thesis: list.filter((g) => g.kind === "thesis").length,
        collaboration: list.filter((g) => g.kind !== "thesis").length || list.length,
      });
    }
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const headerStats = useMemo(() => {
    const mine = groups.filter((g) => isMember(g, user?.id)).length;
    return [
      { label: "Research groups", value: groups.length, filterKey: "all", accent: "#0ea5e9" },
      { label: "My groups", value: mine, filterKey: "mine", accent: "#7dd3fc" },
    ];
  }, [groups, user?.id]);

  const filteredGroups = useMemo(
    () =>
      filterByStatKey(groups, statusFilter, {
        customFilters: {
          mine: (g) => isMember(g, user?.id),
        },
      }),
    [groups, statusFilter, user?.id]
  );

  async function openChat(groupId) {
    try {
      const res = await conversationApi.openGroupChat(accessToken, groupId);
      navigate(`/messages?conversationId=${res.conversation.id}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to open group chat");
    }
  }

  return (
    <div className="groupsPage">
      <GroupsModuleNav />

      <PageHeader
        title="Groups"
        subtitle="Research collaboration groups (join/leave + chat). Thesis supervision is in the Thesis module."
        stats={headerStats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close form" : "+ New group"}
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => navigate("/messages")}>
              💬 Messages
            </button>
          </>
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Showing: <strong>{statFilterLabel(headerStats, statusFilter)}</strong> ({filteredGroups.length})
        </p>
      ) : null}
      {loading ? <p className="muted">Loading groups…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>{error}</div> : null}

      {canCreate && showForm ? (
        <div className="card groupsCreateForm">
          <div style={{ fontWeight: 800 }}>Create research group</div>
          <div className="inlineFormRow">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
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
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {filteredGroups.map((g) => {
            const member = isMember(g, user?.id);
            return (
              <div key={g.id} className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                <div className="groupsListItem">
                  <div className="groupsListItemMain">
                    <div style={{ fontWeight: 800 }}>{g.name}</div>
                    <div className="muted">Members: {g.members?.length || 0}</div>
                  </div>
                  <div className="groupsListItemActions">
                    {member ? (
                      <button type="button" className="btn" onClick={() => openChat(g.id)}>
                        Open chat
                      </button>
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
          {filteredGroups.length === 0 ? (
            <div className="muted">{groups.length === 0 ? "No research groups yet." : "No groups match this filter."}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
