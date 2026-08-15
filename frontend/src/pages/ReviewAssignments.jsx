import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { PeerReviewRoster } from "../components/PeerReviewRoster";
import { filterByStatKey, statFilterLabel, buildSentReceivedPendingStats } from "../utils/pageHeaderFilters";

export function ReviewAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const isDirector = user?.role === "research_director";

  const load = useCallback(async () => {
    const res = await proposalApi.listMyReviewAssignments(accessToken);
    const list = res.assignments || [];
    setAssignments(list);
}, [accessToken, user?.role, isDirector]);

  const { loading, error, reload } = useModuleLoad(accessToken, load, [location.pathname]);

  const pending = useMemo(
    () =>
      assignments.filter((a) =>
        isDirector ? a.awaitingLeadership || (a.pendingReviewers || 0) > 0 : !a.peerReviewSubmitted
      ),
    [assignments, isDirector]
  );
  const received = useMemo(
    () => assignments.filter((a) => !pending.includes(a)),
    [assignments, pending]
  );

  const stats = useMemo(
    () => buildSentReceivedPendingStats(assignments.length, received.length, pending.length),
    [assignments.length, received.length, pending.length]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "pending") return pending;
    if (statusFilter === "received") return received;
    if (statusFilter === "sent") return assignments;
    return filterByStatKey(assignments, statusFilter === "all" ? "all" : statusFilter);
  }, [assignments, statusFilter, pending, received]);

  return (
    <div>
      <PageHeader
        title="Peer Reviews"
        subtitle={
          isDirector
            ? "Proposals you sent to Leadership. Total = Received + Pending. Received = reviews that came back."
            : "Proposals sent to you for peer review. Total = Received + Pending. Received = reviews you finished."
        }
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            <Link className="btn" to="/proposals">
              Proposals
            </Link>
            <button type="button" className="btn" onClick={() => reload()} disabled={loading}>
              Refresh
            </button>
          </>
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filtered.length})
        </p>
      ) : null}

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading peer reviews…</p> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {!loading && filtered.length === 0 ? (
          <div style={{ padding: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>
              {assignments.length === 0
                ? isDirector
                  ? "No active proposals sent to reviewers"
                  : "No peer reviews yet"
                : "No items match this filter"}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "When Leadership finishes, the proposal stays here as Received so you can assign committee."
                : "When the Research Director sends a proposal to you, it appears here. Use the same portal (Undergraduate / Postgraduate)."}
            </p>
            {isDirector ? (
              <Link className="btn primary" to="/proposals" style={{ marginTop: 8, display: "inline-block" }}>
                Go to Proposals
              </Link>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((a) => {
              const isAwaiting = isDirector
                ? a.awaitingLeadership || (a.pendingReviewers || 0) > 0
                : !a.peerReviewSubmitted;
              return (
                <div key={a.id} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{a.title}</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                        {a.department || "—"}
                        {a.researcherName ? ` · PI: ${a.researcherName}` : ""}
                        {a.currentReviewStage ? ` · Stage: ${a.currentReviewStage}` : ""}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <span
                          style={{
                            display: "inline-block",
                            marginRight: 8,
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isAwaiting ? "rgba(56,189,248,0.18)" : "rgba(34,197,94,0.18)",
                            color: isAwaiting ? "#7dd3fc" : "#86efac",
                          }}
                        >
                          {isAwaiting ? "Sent to reviewer" : "Received"}
                        </span>
                      </div>
                      <PeerReviewRoster
                        assignedReviewers={a.assignedReviewers}
                        peerReviews={a.peerReviews}
                        compact
                        showComments={isDirector}
                        showScores={isDirector}
                      />
                      <p
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 0,
                          color: isAwaiting ? "#fbbf24" : "#22c55e",
                        }}
                      >
                        {isDirector
                          ? isAwaiting
                            ? "⏳ Pending — waiting for Leadership"
                            : "✓ Received — assign committee"
                          : isAwaiting
                            ? "⏳ Pending — action required"
                            : "✓ Received"}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      <StatusBadge status={a.status} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Link className="btn" to={`/proposals/${a.id}`}>
                          Details
                        </Link>
                        <Link className="btn primary" to={`/proposals/${a.id}/review`}>
                          {isDirector
                            ? "Open review"
                            : a.peerReviewSubmitted
                              ? "View review"
                              : "Open review"}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
