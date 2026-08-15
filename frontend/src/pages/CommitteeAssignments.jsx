import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { WorkDoneBox } from "../components/WorkDoneBox";
import { filterByStatKey, statFilterLabel, buildSentReceivedPendingStats } from "../utils/pageHeaderFilters";

export function CommitteeAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const isDirector = user?.role === "research_director";
  const isCoordinator = user?.role === "faculty_coordinator";

  const load = useCallback(async () => {
    const res = await proposalApi.listMyCommitteeAssignments(accessToken);
    setAssignments(res.assignments || []);
  }, [accessToken]);

  const { loading, error, reload } = useModuleLoad(accessToken, load, [location.pathname]);

  const pending = useMemo(
    () =>
      assignments.filter((a) =>
        isDirector
          ? a.committeeStage === "pending" || a.committeeStage === "in_progress"
          : a.actionRequired
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
        title="Committee Reviews"
        subtitle={
          isCoordinator
            ? "Proposals sent to you for committee review. Total = Received + Pending. Received = reviews you finished."
            : "Proposals you sent to Faculty Coordinators. Total = Received + Pending. Received = reviews that came back."
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
      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading committee assignments…</p> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {!loading && filtered.length === 0 ? (
          <div style={{ padding: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>
              {assignments.length === 0
                ? isCoordinator
                  ? "No committee reviews yet"
                  : "No active proposals sent to committee"
                : "No items match this filter"}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isCoordinator
                ? "When the Research Director assigns you, the proposal appears here. Use the same portal (Undergraduate / Postgraduate)."
                : "When the coordinator finishes, the proposal stays here as Received so you can assign finance or approve."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((a) => {
              const members = a.assignedCommittee || [];
              const isReceived = isDirector
                ? a.committeeStage === "passed"
                : Boolean(a.committeeSubmitted || !a.actionRequired);
              const needsAction = isDirector
                ? a.committeeStage === "pending" || a.committeeStage === "in_progress"
                : Boolean(a.actionRequired);
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
                      {members.length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Committee members</div>
                          <p className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>
                            Sent to {members.length}
                            {isReceived ? (
                              <>
                                {" · "}
                                <span style={{ color: "#22c55e", fontWeight: 600 }}>received</span>
                              </>
                            ) : (
                              <>
                                {" · "}
                                <span style={{ color: "#fbbf24", fontWeight: 600 }}>pending</span>
                              </>
                            )}
                          </p>
                          <div style={{ display: "grid", gap: 6 }}>
                            {members.map((m) => (
                              <div
                                key={m.id || m.email}
                                style={{
                                  fontSize: 13,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>
                                  <strong>{m.fullName || m.email || "Coordinator"}</strong>
                                  {m.email && m.fullName ? (
                                    <span className="muted"> · {m.email}</span>
                                  ) : null}
                                </span>
                                {isReceived ? (
                                  <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ Received</span>
                                ) : (
                                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>⏳ Pending</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          <span
                            style={{
                              display: "inline-block",
                              marginRight: 8,
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: "rgba(34,197,94,0.18)",
                              color: "#86efac",
                            }}
                          >
                            Committee
                          </span>
                        </div>
                      )}
                      {isReceived && a.committeeScore != null && !isCoordinator ? (
                        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                          Score: <strong>{a.committeeScore}/5</strong>
                          {a.committeeDecision
                            ? ` · ${String(a.committeeDecision).replace(/_/g, " ")}`
                            : ""}
                        </div>
                      ) : null}
                      {isCoordinator && !needsAction ? (
                        <WorkDoneBox
                          stageLabel="Committee review"
                          comment={a.committeeComment}
                          score={a.committeeScore}
                          decision={a.committeeDecision}
                        />
                      ) : null}
                      <p
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 0,
                          color: needsAction ? "#fbbf24" : "#22c55e",
                        }}
                      >
                        {isCoordinator
                          ? needsAction
                            ? "⏳ Pending — action required"
                            : "✓ Received"
                          : needsAction
                            ? "⏳ Pending — waiting for committee"
                            : "✓ Received — assign finance or approve"}
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
                          {isCoordinator && needsAction ? "Submit committee review" : "Open review"}
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
