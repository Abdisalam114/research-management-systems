import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

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

  const awaiting = useMemo(
    () =>
      assignments.filter((a) =>
        isDirector ? a.awaitingLeadership || (a.pendingReviewers || 0) > 0 : !a.peerReviewSubmitted
      ),
    [assignments, isDirector]
  );
  const received = useMemo(
    () =>
      assignments.filter((a) =>
        isDirector ? !(a.awaitingLeadership || (a.pendingReviewers || 0) > 0) : a.peerReviewSubmitted
      ),
    [assignments, isDirector]
  );

  const stats = useMemo(
    () => [
      {
        label: isDirector ? "Sent to reviewers" : "Assigned",
        value: assignments.length,
        filterKey: "all",
      },
      {
        label: isDirector ? "Awaiting Leadership" : "Pending review",
        value: awaiting.length,
        filterKey: "pending",
        accent: "#fbbf24",
      },
      {
        label: isDirector ? "Reviews received" : "Submitted",
        value: received.length,
        filterKey: "done",
        accent: "#22c55e",
      },
    ],
    [assignments.length, awaiting.length, received.length, isDirector]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "pending") return awaiting;
    if (statusFilter === "done") return received;
    return filterByStatKey(assignments, statusFilter === "all" ? "all" : statusFilter);
  }, [assignments, statusFilter, awaiting, received]);

  return (
    <div>
      <PageHeader
        title="Peer Reviews"
        subtitle={
          isDirector
            ? "Active proposals you sent to Leadership — tile count matches this list."
            : "Proposals the Research Director sent to you — submit score (1–5) and comments."
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
                  : "No peer review assignments"
                : "No items match this filter"}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "Open a proposal → Review → Assign & send to reviewer. Active ones appear here and on the dashboard Peer Reviews tile."
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
              const reviewerNames = (a.assignedReviewers || [])
                .map((r) => r.fullName || r.email)
                .filter(Boolean)
                .join(", ");
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
                      {reviewerNames ? (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          <span
                            style={{
                              display: "inline-block",
                              marginRight: 8,
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: "rgba(56,189,248,0.18)",
                              color: "#7dd3fc",
                            }}
                          >
                            Sent to reviewer
                          </span>
                          {reviewerNames}
                          {isDirector ? (
                            <span className="muted">
                              {" "}
                              · {a.peerReviewCount || 0} review(s) in · {a.pendingReviewers || 0} pending
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {(a.peerReviews || []).length > 0 ? (
                        <div style={{ marginTop: 8, fontSize: 13, display: "grid", gap: 6 }}>
                          {(a.peerReviews || []).map((r, idx) => (
                            <div key={`${r.reviewerId || idx}-${idx}`}>
                              <strong>{r.reviewerName || r.reviewerEmail || "Reviewer"}</strong>
                              {" · "}
                              Score: <strong>{r.score}/5</strong>
                              {r.comment?.trim() ? (
                                <span className="muted"> — {r.comment.trim().slice(0, 120)}{r.comment.trim().length > 120 ? "…" : ""}</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
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
                            ? "⏳ Awaiting Leadership peer review"
                            : "✓ Leadership reviews received — continue pipeline"
                          : isAwaiting
                            ? "⏳ Peer review pending — action required"
                            : "✓ Peer review submitted"}
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
                              : "Open & submit review"}
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
