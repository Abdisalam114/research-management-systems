import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import * as userApi from "../services/userApi";

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

function reviewerRefId(ref) {
  if (ref == null) return "";
  if (typeof ref === "object") return String(ref._id || ref.id || "");
  return String(ref);
}

export function ProposalMultiStageReview({ proposal, onReload }) {
  const { accessToken, user } = useAuth();
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [peerReviewers, setPeerReviewers] = useState([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState([]);
  const [assignMsg, setAssignMsg] = useState("");

  const pipe = proposal.reviewPipeline || {};
  const stage = proposal.currentReviewStage || "admin_screening";
  const isDirector = user?.role === "research_director";
  const isCoordinator = user?.role === "faculty_coordinator";
  const isFinance = user?.role === "finance_officer";
  const isPeerReviewer = user?.role === "peer_reviewer";
  const isVoluntary =
    proposal.proposalKind === "voluntary" ||
    (!proposal.fundingCallId && proposal.proposalKind !== "grant_fund_call");
  const assigned = (proposal.assignedReviewers || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const peerDone = (proposal.peerReviews || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  // Peer reviewer power: assigned → can score immediately (no screening wait)
  const canSubmitPeerReview = (assigned || isDirector) && !peerDone;
  const canAssignReviewers = isDirector;
  useEffect(() => {
    if (!canAssignReviewers || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.listUsers(accessToken, { role: "peer_reviewer", status: "active" });
        if (cancelled) return;
        setPeerReviewers(res.users || []);
        const current = (proposal.assignedReviewers || []).map((r) => reviewerRefId(r.userId));
        setSelectedReviewerIds(current.filter(Boolean));
      } catch {
        if (!cancelled) setPeerReviewers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignReviewers, accessToken, proposal.id, proposal.assignedReviewers]);
  async function run(fn) {
    setBusy(true);
    setErr("");
    setAssignMsg("");
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

  function toggleReviewer(id) {
    const sid = String(id);
    setSelectedReviewerIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  }

  async function assignSelected() {
    if (!selectedReviewerIds.length) {
      setErr("Select at least one peer reviewer");
      return;
    }
    setBusy(true);
    setErr("");
    setAssignMsg("");
    try {
      await proposalApi.assignReviewers(accessToken, proposal.id, selectedReviewerIds);
      setAssignMsg("Reviewers assigned — they will get a notification.");
await onReload();
    } catch (e) {
      setErr(e?.response?.data?.message || "Assign reviewers failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        {isPeerReviewer ? "Your peer review" : "Multi-stage review (Phase 3)"}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Current stage: <strong>{STAGE_LABELS[stage] || stage}</strong></p>
      {err ? <div className="bannerErr">{err}</div> : null}
      {assignMsg ? (
        <div className="card" style={{ marginBottom: 10, borderColor: "rgba(56,189,248,0.45)", background: "rgba(56,189,248,0.08)", fontSize: 13 }}>
          {assignMsg}
        </div>
      ) : null}

      {!isPeerReviewer ? (
        <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 12 }}>
          <div>1. Admin screening <StageBadge status={pipe.adminScreening?.status} /></div>
          <div>2. Peer review <StageBadge status={pipe.peerReview?.status} /> ({(proposal.peerReviews || []).length} reviews)</div>
          <div>3. Committee <StageBadge status={pipe.committeeReview?.status} /></div>
          {!isVoluntary ? (
            <div>4. Finance <StageBadge status={pipe.financeReview?.status} /></div>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 13, marginBottom: 12 }} className="muted">
          {assigned
            ? peerDone
              ? "You already submitted your peer review for this proposal."
              : "You are assigned — score the proposal (1–5) and submit your review below."
            : "You are not assigned to this proposal."}
        </div>
      )}

      {canAssignReviewers ? (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: "1px solid rgba(148,197,255,0.2)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Assign peer reviewers</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Select reviewers and click Assign — each gets a notification.
          </p>
          {peerReviewers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No active peer reviewers on this portal.</p>
          ) : (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {peerReviewers.map((u) => (
                <label key={u.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedReviewerIds.includes(String(u.id))}
                    onChange={() => toggleReviewer(u.id)}
                    disabled={busy}
                  />
                  <span>{u.fullName || u.email} <span className="muted">({u.email})</span></span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={busy || !selectedReviewerIds.length}
            onClick={assignSelected}
          >
            Assign &amp; notify reviewers
          </button>
        </div>
      ) : null}

      {(isCoordinator || isDirector) && pipe.adminScreening?.status === "pending" ? (
        <div style={{ marginBottom: 12 }}>
          <input placeholder="Admin screening comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn primary" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.adminScreening(accessToken, proposal.id, "pass", comment.trim()))}>Pass screening</button>
            <button type="button" className="btn" disabled={busy || !comment.trim()} onClick={() => run(() => proposalApi.adminScreening(accessToken, proposal.id, "fail", comment.trim()))}>Fail screening</button>
          </div>
        </div>
      ) : null}

      {isPeerReviewer && !assigned ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Ask the Research Director to assign you from the proposal review page.
        </div>
      ) : null}

      {canSubmitPeerReview ? (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid rgba(56,189,248,0.35)", background: "rgba(56,189,248,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Submit peer review (score 1–5)</div>
          <label>Score
            <input type="number" min={1} max={5} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ marginLeft: 8 }} />
          </label>
          <input placeholder="Peer review comment" value={comment} onChange={(e) => setComment(e.target.value)} style={{ marginTop: 8, width: "100%" }} />
          <button type="button" className="btn primary" style={{ marginTop: 8 }} disabled={busy} onClick={() => run(() => proposalApi.submitPeerReview(accessToken, proposal.id, score, comment))}>
            Submit peer review
          </button>
        </div>
      ) : null}

      {isPeerReviewer && peerDone ? (
        <div className="card" style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)", fontSize: 13 }}>
          ✓ Your peer review was submitted. Thank you.
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

      {!isVoluntary && isFinance && pipe.committeeReview?.status === "passed" && pipe.financeReview?.status === "pending" ? (
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
