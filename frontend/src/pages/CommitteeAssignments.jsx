import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

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
    () => assignments.filter((a) => a.actionRequired),
    [assignments]
  );
  const done = useMemo(
    () => assignments.filter((a) => !a.actionRequired),
    [assignments]
  );

  const stats = useMemo(
    () => [
      {
        label: isDirector ? "Awaiting committee" : "Assigned to you",
        value: assignments.length,
        filterKey: "all",
      },
      ...(!isDirector
        ? [
            {
              label: "Action required",
              value: pending.length,
              filterKey: "pending",
              accent: "#fbbf24",
            },
            ...(done.length > 0
              ? [
                  {
                    label: "Done",
                    value: done.length,
                    filterKey: "done",
                    accent: "#22c55e",
                  },
                ]
              : []),
          ]
        : []),
    ],
    [assignments.length, pending.length, done.length, isDirector]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "pending") return pending;
    if (statusFilter === "done") return done;
    return filterByStatKey(assignments, statusFilter === "all" ? "all" : statusFilter);
  }, [assignments, statusFilter, pending, done]);

  return (
    <div>
      <PageHeader
        title="Committee Reviews"
        subtitle={
          isCoordinator
            ? "Proposals assigned to you — submit committee review here. Completed ones leave this list."
            : "Proposals awaiting Faculty Coordinator review — completed ones move to finance on the Review page."
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
                  ? "No committee assignments yet"
                  : "No active proposals sent to committee"
                : "No items match this filter"}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isCoordinator
                ? "When the Research Director assigns you, the proposal appears here until you submit your committee review."
                : "When the coordinator finishes committee review, the proposal leaves this list. Open Proposals → Review to assign finance."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((a) => {
              const memberNames = (a.assignedCommittee || [])
                .map((m) => m.fullName || m.email)
                .filter(Boolean)
                .join(", ");
              const needsAction = isCoordinator ? a.actionRequired : true;
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
                      {memberNames ? (
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
                          {memberNames}
                        </div>
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
                          ? "⏳ Committee review required — submit score & comment"
                          : "⏳ Awaiting Faculty Coordinator review"}
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
