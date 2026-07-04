import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";

const STAGE_LABELS = {
  admin_screening: "Admin screening",
  peer_review: "Peer review",
  committee_review: "Committee review",
  finance_review: "Finance review",
  ready_for_director: "Ready for director",
};

function StageBadge({ status }) {
  return <span className="badge" style={{ marginLeft: 8 }}>{status || "pending"}</span>;
}

export function ProposalMultiStageReview({ proposal, onReload }) {
  const { accessToken, user } = useAuth();
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pipe = proposal.reviewPipeline || {};
  const stage = proposal.currentReviewStage || "admin_screening";
  const isDirector = user?.role === "research_director";
  const isCoordinator = user?.role === "faculty_coordinator";
  const isFinance = user?.role === "finance_officer";
  const assigned = (proposal.assignedReviewers || []).some((r) => String(r.userId?.id || r.userId) === String(user?.id));
  const peerDone = (proposal.peerReviews || []).some((r) => String(r.userId) === String(user?.id));

  async function run(fn) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setComment("");
      await onReload();
    } catch (e) {
      setErr(e?.response?.data?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Multi-stage review (URGMS Step 3)</div>
      <p className="muted" style={{ fontSize: 13 }}>Current stage: <strong>{STAGE_LABELS[stage] || stage}</strong></p>
      {err ? <div className="bannerErr">{err}</div> : null}

      <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 12 }}>
        <div>1. Admin screening <StageBadge status={pipe.adminScreening?.status} /></div>
        <div>2. Peer review <StageBadge status={pipe.peerReview?.status} /> ({(proposal.peerReviews || []).length} reviews)</div>
        <div>3. Committee <StageBadge status={pipe.committeeReview?.status} /></div>
        <div>4. Finance <StageBadge status={pipe.financeReview?.status} /></div>
      </div>

      {(isCoordinator || isDirector) && pipe.adminScreening?.status === "pending" ? (
        <div style={{ marginBottom: 12 }}>
          <input placeholder="Admin screening comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn primary" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.adminScreening(accessToken, proposal.id, "pass", comment.trim()))}>Pass screening</button>
            <button type="button" className="btn" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.adminScreening(accessToken, proposal.id, "fail", comment.trim()))}>Fail screening</button>
          </div>
        </div>
      ) : null}

      {(assigned || isDirector) && !peerDone && pipe.adminScreening?.status === "passed" ? (
        <div style={{ marginBottom: 12 }}>
          <label>Peer score (1–5)
            <input type="number" min={1} max={5} value={score} onChange={(e) => setScore(Number(e.target.value))} />
          </label>
          <input placeholder="Peer review comment" value={comment} onChange={(e) => setComment(e.target.value)} style={{ marginTop: 8 }} />
          <button type="button" className="btn primary" style={{ marginTop: 8 }} disabled={busy} onClick={() => run(() => proposalApi.submitPeerReview(accessToken, proposal.id, score, comment))}>Submit peer review</button>
        </div>
      ) : null}

      {isDirector && pipe.peerReview?.status !== "passed" && (proposal.peerReviews || []).length > 0 ? (
        <button type="button" className="btn" style={{ marginBottom: 12 }} disabled={busy} onClick={() => run(() => proposalApi.completePeerReview(accessToken, proposal.id))}>Complete peer review stage</button>
      ) : null}

      {(isCoordinator || isDirector) && pipe.peerReview?.status === "passed" && pipe.committeeReview?.status === "pending" ? (
        <div style={{ marginBottom: 12 }}>
          <input placeholder="Committee comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn primary" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.committeeReview(accessToken, proposal.id, "recommend_approval", comment.trim()))}>Recommend approval</button>
            <button type="button" className="btn" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.committeeReview(accessToken, proposal.id, "recommend_revision", comment.trim()))}>Recommend revision</button>
            <button type="button" className="btn" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.committeeReview(accessToken, proposal.id, "reject", comment.trim()))}>Reject</button>
          </div>
        </div>
      ) : null}

      {isFinance && pipe.committeeReview?.status === "passed" && pipe.financeReview?.status === "pending" ? (
        <div>
          <input placeholder="Finance review comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn primary" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.financeProposalReview(accessToken, proposal.id, "approve", comment.trim()))}>Finance approve</button>
            <button type="button" className="btn" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.financeProposalReview(accessToken, proposal.id, "reject", comment.trim()))}>Finance reject</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
