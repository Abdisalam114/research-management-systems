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

/** Finance queue: grant proposals assigned for finance review (voluntary excluded). */
export function FinanceProposalReviewsPage() {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const isDirector = user?.role === "research_director";
  const isFinance = user?.role === "finance_officer";

  const load = useCallback(async () => {
    const res = await proposalApi.listMyFinanceAssignments(accessToken);
    setAssignments(res.assignments || []);
  }, [accessToken]);

  const { loading, error, reload } = useModuleLoad(accessToken, load, [location.pathname]);

  const pending = useMemo(
    () =>
      assignments.filter((a) =>
        isDirector
          ? a.financeStage === "pending" || a.financeStage === "in_progress"
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
        title="Finance review (Proposals)"
        subtitle={
          isDirector
            ? "Grant proposals you sent to Finance. Total = Received + Pending. Received = reviews that came back."
            : "Grant proposals sent to you for finance review. Total = Received + Pending. Received = reviews you finished."
        }
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {!isDirector ? (
              <Link className="btn" to="/finance/closures">
                Project closures
              </Link>
            ) : null}
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
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading finance assignments…</p> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {!loading && filtered.length === 0 ? (
          <div style={{ padding: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>
              {assignments.length === 0
                ? isDirector
                  ? "No active proposals sent to finance"
                  : "No finance reviews yet"
                : "No items match this filter"}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "Voluntary proposals skip finance. When finance finishes, the proposal stays here as Received so you can approve and create the project."
                : "When the Research Director assigns you a grant proposal, it appears here. After you submit, it stays as Received."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((a) => {
              const officerNames = (a.assignedFinance || [])
                .map((r) => r.fullName || r.email)
                .filter(Boolean)
                .join(", ");
              const needsAction = isDirector
                ? a.financeStage === "pending" || a.financeStage === "in_progress"
                : Boolean(a.actionRequired);
              const isReceived = !needsAction;
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
                        Grant fund call • {a.department || "—"}
                        {a.researcherName ? ` · PI: ${a.researcherName}` : ""}
                        {a.requestedAmount
                          ? ` · ${a.budgetCurrency || "USD"} ${Number(a.requestedAmount).toLocaleString()}`
                          : ""}
                      </div>
                      {officerNames ? (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          {isDirector ? "Sent to finance: " : "Assigned to: "}
                          {officerNames}
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
                        {isDirector
                          ? needsAction
                            ? "⏳ Pending — waiting for Finance Officer"
                            : "✓ Received — approve to create the project"
                          : needsAction
                            ? "⏳ Pending — action required"
                            : "✓ Received"}
                      </p>
                      {isFinance && !needsAction ? (
                        <WorkDoneBox
                          stageLabel="Finance review"
                          comment={a.financeComment}
                          decision={a.financeDecision}
                        />
                      ) : null}
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
                      <Link className="btn primary" to={`/finance/reviews/${a.id}`}>
                        {isDirector
                          ? "Open review"
                          : needsAction
                            ? "Submit finance review"
                            : "View review"}
                      </Link>
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
