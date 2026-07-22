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
  if (typeof ref === "object") {
    if (ref._id != null) return String(ref._id);
    if (typeof ref.id === "string" || typeof ref.id === "number") return String(ref.id);
    return String(ref);
  }
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
  // #region agent log
  fetch('http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f558f7'},body:JSON.stringify({sessionId:'f558f7',hypothesisId:'H4',location:'ProposalMultiStageReview.jsx:render',message:'UI pipeline statuses',data:{proposalId:proposal?.id,role:user?.role,stage,admin:pipe.adminScreening?.status||null,peer:pipe.peerReview?.status||null,committee:pipe.committeeReview?.status||null,peerReviewCount:(proposal.peerReviews||[]).length,showCommitteeButtons:Boolean((user?.role==='research_director'||user?.role==='faculty_coordinator')&&pipe.peerReview?.status==='passed'&&pipe.committeeReview?.status==='pending')},timestamp:Date.now(),runId:'pre-fix'})}).catch(()=>{});
  // #endregion
  const isDirector = user?.role === "research_director";
  const isCoordinator = user?.role === "faculty_coordinator";
  const isFinance = user?.role === "finance_officer";
  const isLeadershipReviewer = user?.role === "leadership";
  const isVoluntary =
    proposal.proposalKind === "voluntary" ||
    (!proposal.fundingCallId && proposal.proposalKind !== "grant_fund_call");
  const assigned = (proposal.assignedReviewers || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const peerDone = (proposal.peerReviews || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  // Peer reviewer (Leadership): assigned → can score + comment
  const canSubmitPeerReview = assigned && !peerDone && (isLeadershipReviewer || isDirector);
  // Director may also submit if assigned; unassigned directors manage stage only
  const canDirectorSubmitPeer = isDirector && !peerDone && !isLeadershipReviewer;
  const showPeerSubmitForm = canSubmitPeerReview || canDirectorSubmitPeer;
  const canAssignReviewers = isDirector;
  useEffect(() => {
    if (!canAssignReviewers || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.listUsers(accessToken, { role: "leadership", status: "active" });
        if (cancelled) return;
        setPeerReviewers(res.users || []);
        const current = (proposal.assignedReviewers || []).map((r) => reviewerRefId(r.userId));
        setSelectedReviewerIds(current.filter(Boolean));
      } catch (e) {
        if (!cancelled) {
          setPeerReviewers([]);
          setErr(e?.response?.data?.message || "Could not load leadership reviewers");
        }
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
      // #region agent log
      fetch('http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f558f7'},body:JSON.stringify({sessionId:'f558f7',hypothesisId:'H5',location:'ProposalMultiStageReview.jsx:run',message:'action starting',data:{proposalId:proposal?.id,peerBefore:proposal?.reviewPipeline?.peerReview?.status||null,committeeBefore:proposal?.reviewPipeline?.committeeReview?.status||null},timestamp:Date.now(),runId:'pre-fix'})}).catch(()=>{});
      // #endregion
      const result = await fn();
      // #region agent log
      fetch('http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f558f7'},body:JSON.stringify({sessionId:'f558f7',hypothesisId:'H5',location:'ProposalMultiStageReview.jsx:run',message:'action ok before reload',data:{proposalId:proposal?.id,apiCommittee:result?.proposal?.reviewPipeline?.committeeReview?.status||null,apiPeer:result?.proposal?.reviewPipeline?.peerReview?.status||null,apiMsg:result?.message||null},timestamp:Date.now(),runId:'pre-fix'})}).catch(()=>{});
      // #endregion
      setComment("");
      await onReload();
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f558f7'},body:JSON.stringify({sessionId:'f558f7',hypothesisId:'H2',location:'ProposalMultiStageReview.jsx:run',message:'action failed',data:{proposalId:proposal?.id,err:e?.response?.data?.message||e?.message||'fail',status:e?.response?.status||null},timestamp:Date.now(),runId:'pre-fix'})}).catch(()=>{});
      // #endregion
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
        {isLeadershipReviewer ? "Your peer review" : "Multi-stage review (Phase 3)"}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Current stage: <strong>{STAGE_LABELS[stage] || stage}</strong></p>
      {err ? <div className="bannerErr">{err}</div> : null}
      {assignMsg ? (
        <div className="card" style={{ marginBottom: 10, borderColor: "rgba(56,189,248,0.45)", background: "rgba(56,189,248,0.08)", fontSize: 13 }}>
          {assignMsg}
        </div>
      ) : null}

      {!isLeadershipReviewer ? (
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
            <p className="muted" style={{ fontSize: 13 }}>No active leadership reviewers on this portal.</p>
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

      {isLeadershipReviewer && !assigned ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Ask the Research Director to assign you from the proposal review page.
        </div>
      ) : null}

      {(isDirector || isCoordinator) && (proposal.peerReviews || []).length > 0 ? (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Leadership peer reviews ({(proposal.peerReviews || []).length})
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(proposal.peerReviews || []).map((r, idx) => (
              <div key={`${r.userId}-${idx}`} style={{ fontSize: 13, paddingBottom: 8, borderBottom: "1px solid rgba(148,197,255,0.15)" }}>
                <div>
                  <strong>{r.reviewerName || r.reviewerEmail || "Reviewer"}</strong>
                  {" · "}
                  Score: <strong>{r.score}/5</strong>
                  {r.at ? (
                    <span className="muted"> · {new Date(r.at).toLocaleString()}</span>
                  ) : null}
                </div>
                <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                  {r.comment?.trim() ? r.comment : <span className="muted">No comment</span>}
                </div>
              </div>
            ))}
          </div>
          {isDirector && pipe.peerReview?.status !== "passed" ? (
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => run(() => proposalApi.completePeerReview(accessToken, proposal.id))}
            >
              Complete peer review stage
            </button>
          ) : null}
          {pipe.peerReview?.status === "passed" ? (
            <div className="muted" style={{ marginTop: 8, fontSize: 12, color: "#22c55e" }}>
              ✓ Peer review stage completed — continue with committee / director decision.
            </div>
          ) : null}
        </div>
      ) : null}

      {showPeerSubmitForm ? (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid rgba(56,189,248,0.35)", background: "rgba(56,189,248,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {isLeadershipReviewer ? "Your peer review — score & comment" : "Submit peer review (score 1–5)"}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Read the proposal above, then give a score (1–5) and a written comment.
          </p>
          <label>Score
            <input type="number" min={1} max={5} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ marginLeft: 8 }} />
          </label>
          <textarea
            placeholder="Peer review comment (required)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            style={{ marginTop: 8, width: "100%", display: "block" }}
          />
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 8 }}
            disabled={busy || !comment.trim() || score < 1 || score > 5}
            onClick={() =>
              run(() => proposalApi.submitPeerReview(accessToken, proposal.id, score, comment.trim()))
            }
          >
            Submit peer review
          </button>
        </div>
      ) : null}

      {isLeadershipReviewer && peerDone ? (
        <div className="card" style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)", fontSize: 13 }}>
          ✓ Your peer review was submitted. The Research Director can see your score and comments.
        </div>
      ) : null}

      {isDirector && pipe.peerReview?.status !== "passed" && (proposal.peerReviews || []).length === 0 ? (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Assign Leadership reviewers above. After they submit scores &amp; comments, complete the peer review stage here.
        </p>
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
