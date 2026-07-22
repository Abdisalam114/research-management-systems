import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as proposalApi from "../services/proposalApi";
import { ProposalMultiStageReview } from "../components/ProposalMultiStageReview";

/** Finance-only proposal review — funding/finance stage only, no full research dossier. */
export function FinanceProposalReviewDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await proposalApi.getProposal(accessToken, id);
    setProposal(res.proposal);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal for finance review"));
  }, [id, accessToken, programTier]);

  if (!proposal) return <div style={{ padding: 8 }}>{error || "Loading finance review…"}</div>;

  const kind = proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary");
  const amount =
    Number(proposal.requestedAmount) > 0
      ? Number(proposal.requestedAmount)
      : Number(proposal.budgetTotal) > 0
        ? Number(proposal.budgetTotal)
        : Number(proposal.fundingCall?.amountCap) > 0
          ? Number(proposal.fundingCall.amountCap)
          : 0;
  const currency = proposal.budgetCurrency || proposal.fundingCall?.currency || "USD";

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
          <div>
            Requested amount:{" "}
            <strong>
              {currency} {Number(amount).toLocaleString()}
            </strong>
            {proposal.fundingCall?.amountCap && Number(proposal.budgetTotal) <= 0 ? (
              <span className="muted"> (from funding call ceiling)</span>
            ) : null}
          </div>
          {proposal.fundingCall?.title ? (
            <div>
              Funding call: {proposal.fundingCall.title}
              {proposal.fundingCall.amountCap
                ? ` • Cap: ${proposal.fundingCall.currency || currency} ${Number(proposal.fundingCall.amountCap).toLocaleString()}`
                : ""}
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
