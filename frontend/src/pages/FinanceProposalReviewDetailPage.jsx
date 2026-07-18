import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import { ProposalMultiStageReview } from "../components/ProposalMultiStageReview";

/** Finance-only proposal review — funding/finance stage only, no full research dossier. */
export function FinanceProposalReviewDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await proposalApi.getProposal(accessToken, id);
    setProposal(res.proposal);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal for finance review"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!proposal) return <div style={{ padding: 8 }}>{error || "Loading finance review…"}</div>;

  const kind = proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary");
  const amount = proposal.budgetTotal ?? proposal.amountRequested ?? proposal.requestedAmount;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginTop: 0 }}>Finance review</h2>
        <Link className="btn" to="/finance/reviews">
          Back to finance review queue
        </Link>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        Limited finance view — research abstract, ethics, and full proposal dossier are hidden.
      </p>

      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
          <div>Type: <strong>{kind === "grant_fund_call" ? "Grant fund call" : "Voluntary"}</strong></div>
          <div>Status: <strong>{proposal.status}</strong> • Stage: {proposal.currentReviewStage || "—"}</div>
          <div>Department: {proposal.department || "—"}</div>
          {proposal.researcherName ? <div>PI: {proposal.researcherName}</div> : null}
          {amount != null ? (
            <div>
                Requested amount:{" "}
                <strong>
                  {proposal.budgetCurrency || proposal.currency || "USD"} {Number(amount).toLocaleString()}
                </strong>
            </div>
          ) : null}
          {proposal.fundingSource ? <div>Funding source: {proposal.fundingSource}</div> : null}
        </div>
      </div>

      {kind === "voluntary" ? (
        <div className="card" style={{ marginTop: 12 }}>
          Voluntary proposals skip finance review.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <ProposalMultiStageReview proposal={proposal} onReload={load} />
        </div>
      )}
    </div>
  );
}
