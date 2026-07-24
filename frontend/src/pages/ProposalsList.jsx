import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

export function ProposalsListPage() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const isReviewer = ["faculty_coordinator", "research_director"].includes(user?.role);
  const isFinance = user?.role === "finance_officer";
  const isLeadershipReviewer = user?.role === "leadership";

  const title = useMemo(() => {
    if (user?.role === "researcher") return "My Proposals";
    if (user?.role === "leadership") return "Assigned proposals (peer review)";
    if (user?.role === "finance_officer") return "Proposals (Finance review)";
    return "Proposals (Review Queue)";
  }, [user?.role]);

  const isStaffQueue = isReviewer || isFinance || isLeadershipReviewer;

  const stats = useMemo(() => {
    const by = (s) => proposals.filter((p) => p.status === s).length;
    if (isStaffQueue) {
      return [
        { label: "Total", value: proposals.length, filterKey: "all" },
        { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
        { label: "Under review", value: by("under_review"), filterKey: "under_review", accent: "#fcd34d" },
        { label: "Revision", value: by("revision_requested"), filterKey: "revision_requested", accent: "#fb923c" },
        { label: "Approved", value: by("approved"), filterKey: "approved", accent: "#16a34a" },
        { label: "Rejected", value: by("rejected"), filterKey: "rejected" },
      ];
    }
    return [
      { label: "Total", value: proposals.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      { label: "Under review", value: by("under_review"), filterKey: "under_review", accent: "#fcd34d" },
      { label: "Approved", value: by("approved"), filterKey: "approved", accent: "#16a34a" },
      { label: "Rejected", value: by("rejected"), filterKey: "rejected" },
    ];
  }, [proposals, isStaffQueue]);

  const filtered = useMemo(() => filterByStatKey(proposals, statusFilter), [proposals, statusFilter]);

  async function load() {
    setError("");
    const res =
      user?.role === "research_director"
        ? await proposalApi.listProposalsAll(accessToken)
        : await proposalApi.listProposals(accessToken);
    setProposals(res.proposals || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposals"));
  }, [accessToken, programTier, user?.role]);

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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{p.title}</div>
                    <div className="muted" style={{ marginTop: 4 }}>
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
                              : "rgba(245, 158, 11, 0.16)",
                          color: kindLabel(p) === "Voluntary" ? "#7dd3fc" : "#fbbf24",
                        }}
                      >
                        {kindLabel(p)}
                      </span>
                      v{p.version} • {p.department}
                      {p.researcherName ? ` • PI: ${p.researcherName}` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 8,
                    }}
                  >
                    <StatusBadge status={p.status} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link className="btn" to={`/proposals/${p.id}`}>
                        Details
                      </Link>
                      {isReviewer ? (
                        <Link className="btn primary" to={`/proposals/${p.id}/review`}>
                          Review
                        </Link>
                      ) : null}
                      {isFinance ? (
                        <Link className="btn primary" to={`/proposals/${p.id}/review`}>
                          Finance review
                        </Link>
                      ) : null}
                      {isLeadershipReviewer ? (
                        <Link className="btn primary" to={`/proposals/${p.id}/review`}>
                          Peer review
                        </Link>
                      ) : null}
                    </div>
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

