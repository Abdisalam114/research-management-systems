import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

/** Finance queue: grant proposals assigned for finance review (voluntary excluded). */
export function FinanceProposalReviewsPage() {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);
  const isDirector = user?.role === "research_director";

  const load = useCallback(async () => {
    const res = await proposalApi.listMyFinanceAssignments(accessToken);
    setAssignments(res.assignments || []);
  }, [accessToken]);

  const { loading, error, reload } = useModuleLoad(accessToken, load, [location.pathname]);

  const stats = useMemo(
    () => [
      {
        label: isDirector ? "Awaiting finance" : "Assigned to you",
        value: assignments.length,
        filterKey: "all",
      },
    ],
    [assignments.length, isDirector]
  );

  return (
    <div>
      <PageHeader
        title="Finance review (Proposals)"
        subtitle={
          isDirector
            ? "Grant proposals awaiting Finance Officer review — voluntary proposals never appear here."
            : "Grant proposals assigned to you — submit finance review, then the Director approves and creates the project."
        }
        stats={stats}
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

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading finance assignments…</p> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {!loading && assignments.length === 0 ? (
          <div style={{ padding: 8, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>No proposals awaiting finance review</div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "Voluntary proposals skip finance. After finance completes, approve the proposal on the Review page to create the project."
                : "When the Research Director assigns you a grant proposal, it appears here until you submit your finance review."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {assignments.map((a) => {
              const officerNames = (a.assignedFinance || [])
                .map((r) => r.fullName || r.email)
                .filter(Boolean)
                .join(", ");
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
                      {isDirector && officerNames ? (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          Sent to finance: {officerNames}
                        </div>
                      ) : null}
                      <p
                        style={{
                          fontWeight: 600,
                          marginTop: 8,
                          marginBottom: 0,
                          color: "#fbbf24",
                        }}
                      >
                        {isDirector
                          ? "⏳ Awaiting Finance Officer review"
                          : "⏳ Finance review required — submit comment & decision"}
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
                      <Link className="btn primary" to={`/finance/reviews/${a.id}`}>
                        {isDirector ? "Open review" : "Submit finance review"}
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
