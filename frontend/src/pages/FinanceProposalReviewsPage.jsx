import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";

/** Finance-only queue: grant proposals waiting on finance review (not general proposals). */
export function FinanceProposalReviewsPage() {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    proposalApi
      .listProposals(accessToken)
      .then((res) => setProposals(res.proposals || []))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load finance review queue"));
  }, [accessToken, programTier]);

  const queue = useMemo(() => {
    return (proposals || []).filter((p) => {
      const kind = p.proposalKind || (p.fundingCallId ? "grant_fund_call" : "voluntary");
      if (kind === "voluntary") return false;
      const pipe = p.reviewPipeline || {};
      const financePending = pipe.financeReview?.status === "pending";
      const committeePassed = pipe.committeeReview?.status === "passed";
      const stage = p.currentReviewStage || "";
      return financePending || stage === "finance_review" || (committeePassed && pipe.financeReview?.status !== "passed" && pipe.financeReview?.status !== "failed");
    });
  }, [proposals]);

  const done = useMemo(() => {
    return (proposals || []).filter((p) => {
      const kind = p.proposalKind || (p.fundingCallId ? "grant_fund_call" : "voluntary");
      if (kind === "voluntary") return false;
      return p.reviewPipeline?.financeReview?.status === "passed" || p.reviewPipeline?.financeReview?.status === "failed";
    });
  }, [proposals]);

  return (
    <div>
      <PageHeader
        title="Finance review (Proposals)"
        subtitle="Kaliya proposals grant_fund_call ee sugaya finance review — ma aha liiska proposals guud."
        stats={[
          { label: "Awaiting finance", value: queue.length, accent: "#38bdf8" },
          { label: "Reviewed", value: done.length },
        ]}
        actions={
          <Link className="btn" to="/finance/closures">
            Project closure queue
          </Link>
        }
      />

      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Awaiting your finance review</div>
        {queue.length === 0 ? (
          <div className="muted">No proposals waiting for finance review.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Grant fund call • {p.department || "—"}
                    {p.researcherName ? ` • PI: ${p.researcherName}` : ""}
                    {p.budgetTotal || p.requestedAmount || p.fundingCall?.amountCap
                      ? ` • Requested: ${p.budgetCurrency || p.fundingCall?.currency || "USD"} ${Number(
                          p.requestedAmount || p.budgetTotal || p.fundingCall?.amountCap || 0
                        ).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <Link className="btn primary" to={`/finance/reviews/${p.id}`}>
                  Open finance review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {done.length ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Recently reviewed</div>
          <div style={{ display: "grid", gap: 8 }}>
            {done.slice(0, 10).map((p) => (
              <div key={p.id} className="muted" style={{ fontSize: 13 }}>
                {p.title} — finance: {p.reviewPipeline?.financeReview?.status}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
