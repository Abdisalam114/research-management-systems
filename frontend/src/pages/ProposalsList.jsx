import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";

export function ProposalsListPage() {
  const { accessToken, user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");

  const canCreate = user?.role === "researcher";
  const isReviewer = ["faculty_coordinator", "research_director"].includes(user?.role);

  const title = useMemo(() => {
    if (user?.role === "researcher") return "My Proposals";
    return "Proposals (Review Queue)";
  }, [user?.role]);

  async function load() {
    setError("");
    const res = await proposalApi.listProposals(accessToken);
    setProposals(res.proposals || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposals"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {canCreate ? (
          <Link className="btn primary" to="/proposals/new">
            New Proposal
          </Link>
        ) : null}
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {proposals.length === 0 ? (
          <div className="muted">No proposals found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {proposals.map((p) => (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.title}</div>
                    <div className="muted">
                      Status: {p.status} • v{p.version} • {p.department}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link className="btn" to={`/proposals/${p.id}`}>
                      Details
                    </Link>
                    {isReviewer ? (
                      <Link className="btn primary" to={`/proposals/${p.id}/review`}>
                        Review
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

