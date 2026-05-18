import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import * as proposalApi from "../services/proposalApi";

export function CoordinatorDashboardPage() {
  const { accessToken, user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([
          analyticsApi.dashboardMetrics(accessToken),
          proposalApi.listProposals(accessToken),
        ]);
        setMetrics(m.metrics);
        const dept = user?.department;
        setQueue((p.proposals || []).filter((x) => !dept || x.department === dept));
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load faculty dashboard");
      }
    })();
  }, [accessToken, user?.department]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Faculty research monitoring</h2>
      <p className="muted">Faculty Coordinator — {user?.department || "your faculty"}</p>
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>{error}</div> : null}

      {metrics ? (
        <div className="overviewGrid" style={{ marginTop: 12 }}>
          <div className="overviewTile">
            <div className="label">Proposals (queue)</div>
            <div className="value">{queue.length}</div>
          </div>
          <div className="overviewTile">
            <div className="label">All proposals</div>
            <div className="value">{metrics.proposals?.total ?? 0}</div>
          </div>
          <div className="overviewTile">
            <div className="label">Projects</div>
            <div className="value">{metrics.projects?.total ?? 0}</div>
          </div>
          <div className="overviewTile">
            <div className="label">Publications</div>
            <div className="value">{metrics.publications?.total ?? 0}</div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800 }}>Proposal pre-review queue</div>
        {queue.length === 0 ? (
          <p className="muted">No proposals awaiting review in your faculty.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {queue.map((p) => (
              <Link key={p.id} to={`/proposals/${p.id}/review`} className="card" style={{ textDecoration: "none" }}>
                <strong>{p.title}</strong>
                <div className="muted">
                  {p.status} • {p.department} • ethics: {p.ethicsStatus || "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn primary" to="/proposals">
          Proposals
        </Link>
        <Link className="btn" to="/publications">
          Validate publications
        </Link>
        <Link className="btn" to="/groups">
          Research groups
        </Link>
      </div>
    </div>
  );
}
