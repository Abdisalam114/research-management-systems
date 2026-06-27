import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

export function ProposalsListPage() {
  const { accessToken, user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const isReviewer = ["faculty_coordinator", "research_director"].includes(user?.role);

  const title = useMemo(() => {
    if (user?.role === "researcher") return "My Proposals";
    return "Proposals (Review Queue)";
  }, [user?.role]);

  const stats = useMemo(() => {
    const by = (s) => proposals.filter((p) => p.status === s).length;
    return [
      { label: "Total", value: proposals.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      { label: "Approved", value: by("approved"), filterKey: "approved", accent: "#1d4ed8" },
      { label: "Rejected", value: by("rejected"), filterKey: "rejected" },
    ];
  }, [proposals]);

  const filtered = useMemo(() => filterByStatKey(proposals, statusFilter), [proposals, statusFilter]);

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
      <PageHeader
        title={title}
        subtitle="Complete ethics form, then submit proposal + ethics together to the Director."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <Link className="btn primary" to="/proposals/new">+ New Proposal</Link>
            ) : null}
            <Link className="btn" to="/projects">Go to Projects</Link>
          </>
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filtered.length})
        </p>
      ) : null}

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <div className="muted">{proposals.length === 0 ? "No proposals found." : "No proposals match this filter."}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((p) => (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.title}</div>
                    <div className="muted">
                      Status: {p.status} • v{p.version} • {p.department}
                      {p.researcherName ? ` • PI: ${p.researcherName}` : ""}
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

