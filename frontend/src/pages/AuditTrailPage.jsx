import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listRecentAudit } from "../services/searchApi";
import { formatRole } from "../utils/roleLabels";
import { PageHeader } from "../components/PageHeader";

const ENTITY_TYPES = [
  { value: "", label: "All entities" },
  { value: "proposal", label: "Proposals" },
  { value: "project", label: "Projects" },
  { value: "grant", label: "Grants" },
  { value: "ethics", label: "Ethics" },
  { value: "publication", label: "Publications" },
  { value: "funding_call", label: "Funding calls" },
];

export function AuditTrailPage() {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listRecentAudit(accessToken, {
        limit: 100,
        ...(entityType ? { entityType } : {}),
      });
      setEvents(res.events || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load audit trail");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Institutional activity log across proposals, projects, grants, and ethics."
        actions={
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="btn">
            {ENTITY_TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value}>{t.label}</option>
            ))}
          </select>
        }
      />

      {error ? <div className="card" style={{ borderColor: "rgba(239,68,68,0.55)", marginTop: 12 }}>{error}</div> : null}
      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading audit events…</p> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Recent activity ({events.length})</div>
        {events.length === 0 && !loading ? (
          <p className="muted">No audit events found.</p>
        ) : (
          <table className="dashTable">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}</td>
                  <td>{ev.label || ev.action}</td>
                  <td>{ev.entityType}{ev.entityId ? ` · ${String(ev.entityId).slice(-6)}` : ""}</td>
                  <td>{ev.actorName || "—"}{ev.actorRole ? ` (${formatRole(ev.actorRole)})` : ""}</td>
                  <td>{ev.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
