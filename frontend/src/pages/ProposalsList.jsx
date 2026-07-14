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
  const isPeerReviewer = user?.role === "peer_reviewer";

  const title = useMemo(() => {
    if (user?.role === "researcher") return "My Proposals";
    if (user?.role === "peer_reviewer") return "Assigned proposals (peer review)";
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

  function kindLabel(p) {
    const kind = p.proposalKind || (p.fundingCallId ? "grant_fund_call" : "voluntary");
    return kind === "grant_fund_call" ? "Grant Fund Call" : "Voluntary";
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Voluntary research proposals from here. Funded applications start from Funding Calls."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <>
                <Link className="btn primary" to="/proposals/new">
                  + New Voluntary Proposal
                </Link>
                <Link className="btn" to="/funding-calls">
                  Grant via Funding Call
                </Link>
              </>
            ) : null}
            <Link className="btn" to="/projects">Go to Projects</Link>
          </>
        }
      />

      {canCreate ? (
        <div className="card" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
          <strong>Voluntary</strong> — research proposal + ethics (create with <em>New Voluntary Proposal</em>).
          <br />
          <strong>Grant Fund Call</strong> — start only from{" "}
          <Link to="/funding-calls">Funding Calls</Link> → Apply.
        </div>
      ) : null}

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
                      <span
                        style={{
                          display: "inline-block",
                          marginRight: 8,
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          background:
                            kindLabel(p) === "Voluntary"
                              ? "rgba(56, 189, 248, 0.15)"
                              : "rgba(250, 204, 21, 0.18)",
                          color: kindLabel(p) === "Voluntary" ? "#7dd3fc" : "#fde047",
                        }}
                      >
                        {kindLabel(p)}
                      </span>
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
                    {isPeerReviewer ? (
                      <Link className="btn primary" to={`/proposals/${p.id}/review`}>
                        Peer review
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

