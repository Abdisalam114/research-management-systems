import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as proposalApi from "../services/proposalApi";
import * as userApi from "../services/userApi";
import { StatusBadge } from "./StatusBadge";

const STAGE_LABELS = {
  admin_screening: "Admin screening",
  peer_review: "Peer review",
  committee_review: "Committee review",
  finance_review: "Finance review",
  ready_for_director: "Ready for director",
};

function StageBadge({ status }) {
  return <StatusBadge status={status || "pending"} style={{ marginLeft: 8 }} />;
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

function stageOpen(status) {
  return status !== "passed" && status !== "failed";
}

export function ProposalMultiStageReview({ proposal, onReload }) {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [peerReviewers, setPeerReviewers] = useState([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState([]);
  const [committeeMembers, setCommitteeMembers] = useState([]);
  const [selectedCommitteeIds, setSelectedCommitteeIds] = useState([]);
  const [financeOfficers, setFinanceOfficers] = useState([]);
  const [selectedFinanceIds, setSelectedFinanceIds] = useState([]);
  const [assignMsg, setAssignMsg] = useState("");

  const pipe = proposal.reviewPipeline || {};
  const stage = proposal.currentReviewStage || "admin_screening";
  const isDirector = user?.role === "research_director";
  const isCoordinator = user?.role === "faculty_coordinator";
  const isFinance = user?.role === "finance_officer";
  const isLeadershipReviewer = user?.role === "leadership";
  const isVoluntary =
    proposal.proposalKind !== "grant_fund_call" && !proposal.fundingCallId;
  const assigned = (proposal.assignedReviewers || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const assignedToCommittee = (proposal.assignedCommittee || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const assignedToFinance = (proposal.assignedFinance || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const peerDone = (proposal.peerReviews || []).some(
    (r) => reviewerRefId(r.userId) === String(user?.id)
  );
  const peerStageOpen = pipe.peerReview?.status !== "passed";
  const peerReviewPassed = pipe.peerReview?.status === "passed";
  const hasPeerReviews = (proposal.peerReviews || []).length > 0;
  const hasAssignedReviewers = (proposal.assignedReviewers || []).length > 0;
  const hasCommitteeAssignees = (proposal.assignedCommittee || []).length > 0;
  const canSubmitPeerReview =
    assigned && !peerDone && peerStageOpen && (isLeadershipReviewer || isDirector);
  const canDirectorSubmitPeer =
    isDirector && !peerDone && peerStageOpen && !hasPeerReviews && !isLeadershipReviewer;
  const showPeerSubmitForm = canSubmitPeerReview || canDirectorSubmitPeer;
  const canAssignReviewers =
    isDirector && !peerReviewPassed && !hasAssignedReviewers && !hasPeerReviews;
  const showPeerAwaitingDirector =
    isDirector && !peerReviewPassed && (hasAssignedReviewers || hasPeerReviews);
  const canAssignCommittee =
    isDirector &&
    pipe.peerReview?.status === "passed" &&
    stageOpen(pipe.committeeReview?.status) &&
    !hasCommitteeAssignees;
  const committeeStageOpen = stageOpen(pipe.committeeReview?.status);
  const committeePassed = pipe.committeeReview?.status === "passed";
  const committeeFailed = pipe.committeeReview?.status === "failed";
  const committeeCompletedByMe =
    String(pipe.committeeReview?.completedBy || "") === String(user?.id);
  const canDecideCommittee =
    pipe.peerReview?.status === "passed" &&
    committeeStageOpen &&
    ((isCoordinator && assignedToCommittee) || isDirector);
  const showCommitteeAwaitingDirector =
    isDirector && committeeStageOpen && hasCommitteeAssignees && !canDecideCommittee;
  /** Director: committee stage UI (status/awaiting/outcome) only after sent to committee — like peer review. */
  const showCommitteeStageForDirector =
    hasCommitteeAssignees || committeePassed || committeeFailed;
  const hasFinanceAssignees = (proposal.assignedFinance || []).length > 0;
  const financeStageOpen = stageOpen(pipe.financeReview?.status);
  const financePassed = pipe.financeReview?.status === "passed";
  const financeFailed = pipe.financeReview?.status === "failed";
  const financeCompletedByMe =
    String(pipe.financeReview?.completedBy || "") === String(user?.id);
  const directorReady = proposal.currentReviewStage === "ready_for_director";
  const canAssignFinance =
    isDirector &&
    !isVoluntary &&
    pipe.committeeReview?.status === "passed" &&
    financeStageOpen &&
    !hasFinanceAssignees;
  const showFinanceAwaitingDirector =
    isDirector && !isVoluntary && financeStageOpen && hasFinanceAssignees;
  /** Director: finance stage UI only after sent to finance — same pattern as committee. */
  const showFinanceStageForDirector =
    hasFinanceAssignees || financePassed || financeFailed;
  const canDecideFinance =
    isFinance &&
    assignedToFinance &&
    !isVoluntary &&
    pipe.committeeReview?.status === "passed" &&
    financeStageOpen;

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
  }, [canAssignReviewers, accessToken, proposal.id, proposal.assignedReviewers, programTier]);

  useEffect(() => {
    if (!canAssignCommittee || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.listUsers(accessToken, {
          role: "faculty_coordinator",
          status: "active",
        });
        if (cancelled) return;
        setCommitteeMembers(res.users || []);
        const current = (proposal.assignedCommittee || []).map((r) => reviewerRefId(r.userId));
        setSelectedCommitteeIds(current.filter(Boolean));
      } catch (e) {
        if (!cancelled) {
          setCommitteeMembers([]);
          setErr(e?.response?.data?.message || "Could not load committee members");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignCommittee, accessToken, proposal.id, proposal.assignedCommittee, programTier]);

  useEffect(() => {
    if (!canAssignFinance || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.listUsers(accessToken, {
          role: "finance_officer",
          status: "active",
        });
        if (cancelled) return;
        setFinanceOfficers(res.users || []);
        const current = (proposal.assignedFinance || []).map((r) => reviewerRefId(r.userId));
        setSelectedFinanceIds(current.filter(Boolean));
      } catch (e) {
        if (!cancelled) {
          setFinanceOfficers([]);
          setErr(e?.response?.data?.message || "Could not load finance officers");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignFinance, accessToken, proposal.id, proposal.assignedFinance, programTier, isVoluntary]);

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

  function toggleId(setter) {
    return (id) => {
      const sid = String(id);
      setter((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
    };
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
      const res = await proposalApi.assignReviewers(accessToken, proposal.id, selectedReviewerIds);
      const names = (res.proposal?.assignedReviewers || [])
        .map((r) => r.fullName || r.email)
        .filter(Boolean)
        .join(", ");
      setAssignMsg(
        res.message ||
          (names
            ? `Sent to reviewer(s): ${names}. Peer Reviews dashboard will update.`
            : "Sent to reviewer — Peer Reviews dashboard will update.")
      );
      await onReload();
    } catch (e) {
      setErr(e?.response?.data?.message || "Assign reviewers failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignCommitteeSelected() {
    if (!selectedCommitteeIds.length) {
      setErr("Select at least one committee member");
      return;
    }
    setBusy(true);
    setErr("");
    setAssignMsg("");
    try {
      const res = await proposalApi.assignCommittee(accessToken, proposal.id, selectedCommitteeIds);
      setAssignMsg(res.message || "Sent to committee");
      await onReload();
    } catch (e) {
      setErr(e?.response?.data?.message || "Assign committee failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignFinanceSelected() {
    if (!selectedFinanceIds.length) {
      setErr("Select at least one finance officer");
      return;
    }
    setBusy(true);
    setErr("");
    setAssignMsg("");
    try {
      const res = await proposalApi.assignFinance(accessToken, proposal.id, selectedFinanceIds);
      setAssignMsg(res.message || "Sent to finance");
      await onReload();
    } catch (e) {
      setErr(e?.response?.data?.message || "Assign finance failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        {isLeadershipReviewer ? "Your peer review" : "Multi-stage review (Phase 3)"}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Current stage: <strong>{STAGE_LABELS[stage] || stage}</strong>
      </p>
      {err ? <div className="bannerErr">{err}</div> : null}
      {assignMsg ? (
        <div
          className="card"
          style={{
            marginBottom: 10,
            borderColor: "rgba(56,189,248,0.45)",
            background: "rgba(56,189,248,0.08)",
            fontSize: 13,
          }}
        >
          {assignMsg}
        </div>
      ) : null}

      {!isLeadershipReviewer ? (
        <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 12 }}>
          <div>
            1. Peer review <StageBadge status={pipe.peerReview?.status} /> (
            {(proposal.peerReviews || []).length} reviews)
          </div>
          {(!isDirector || showCommitteeStageForDirector) && (
            <div>
              2. Committee <StageBadge status={pipe.committeeReview?.status} />
            </div>
          )}
          {!isVoluntary && (!isDirector || showFinanceStageForDirector) ? (
            <div>
              3. Finance <StageBadge status={pipe.financeReview?.status} />
            </div>
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
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(148,197,255,0.2)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Assign peer reviewers</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Select Leadership reviewers and click Assign — status becomes{" "}
            <strong>Sent to reviewer</strong> and their Peer Reviews dashboard updates.
          </p>
          {peerReviewers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              No active leadership reviewers on this portal.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {peerReviewers.map((u) => (
                <label
                  key={u.id}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedReviewerIds.includes(String(u.id))}
                    onChange={() => toggleId(setSelectedReviewerIds)(u.id)}
                    disabled={busy}
                  />
                  <span>
                    {u.fullName || u.email} <span className="muted">({u.email})</span>
                  </span>
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
            Assign &amp; send to reviewer
          </button>
        </div>
      ) : null}

      {showPeerAwaitingDirector ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(251,191,36,0.45)",
            background: "rgba(251,191,36,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Sent to Leadership — awaiting peer review.</strong>
          {(proposal.assignedReviewers || []).length > 0 ? (
            <span>
              {" "}
              Reviewer(s):{" "}
              {(proposal.assignedReviewers || [])
                .map((r) => r.fullName || r.email || "Leadership")
                .join(", ")}
            </span>
          ) : null}
          {hasPeerReviews ? (
            <span className="muted">
              {" "}
              · {(proposal.peerReviews || []).length} review(s) received — waiting for remaining
              reviewer(s) or stage completion.
            </span>
          ) : (
            <span className="muted"> · This proposal leaves Peer Reviews once Leadership submits.</span>
          )}
        </div>
      ) : null}

      {isDirector && peerReviewPassed ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(34,197,94,0.45)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          <strong>✓ Leadership peer review complete.</strong>
          {(proposal.peerReviews || []).length > 0 ? (
            <span>
              {" "}
              {(proposal.peerReviews || [])
                .map((r) => `${r.reviewerName || r.reviewerEmail || "Reviewer"} (${r.score}/5)`)
                .join(" · ")}
            </span>
          ) : null}
          <span className="muted"> Continue with committee assignment below.</span>
        </div>
      ) : null}

      {isLeadershipReviewer && !assigned ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Ask the Research Director to assign you from the proposal review page.
        </div>
      ) : null}

      {(isCoordinator || (isDirector && !peerReviewPassed)) && (proposal.peerReviews || []).length > 0 ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(34,197,94,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Leadership peer reviews ({(proposal.peerReviews || []).length})
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(proposal.peerReviews || []).map((r, idx) => (
              <div
                key={`${r.userId}-${idx}`}
                style={{
                  fontSize: 13,
                  paddingBottom: 8,
                  borderBottom: "1px solid rgba(148,197,255,0.15)",
                }}
              >
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
          {isDirector && pipe.peerReview?.status !== "passed" && hasPeerReviews ? (
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
        </div>
      ) : null}

      {showPeerSubmitForm ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(56,189,248,0.35)",
            background: "rgba(56,189,248,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {isLeadershipReviewer
              ? "Your peer review — score & comment"
              : "Submit peer review (score 1–5)"}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Read the proposal above, then give a score (1–5) and a written comment.
          </p>
          <label>
            Score
            <input
              type="number"
              min={1}
              max={5}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              style={{ marginLeft: 8 }}
            />
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
              run(() =>
                proposalApi.submitPeerReview(accessToken, proposal.id, score, comment.trim())
              )
            }
          >
            Submit peer review
          </button>
        </div>
      ) : null}

      {isLeadershipReviewer && peerDone ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(34,197,94,0.4)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          ✓ Your peer review was submitted. The Research Director can see your score and comments.
        </div>
      ) : null}

      {isDirector &&
      !peerReviewPassed &&
      !hasAssignedReviewers &&
      (proposal.peerReviews || []).length === 0 ? (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Assign Leadership reviewers above. Once they submit, this proposal leaves Peer Reviews and
          you can assign committee here.
        </p>
      ) : null}

      {canAssignCommittee ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(148,197,255,0.2)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Assign committee</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Select Faculty Coordinators and click Assign — status becomes{" "}
            <strong>Sent to committee</strong>.
          </p>
          {committeeMembers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              No active faculty coordinators on this portal.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {committeeMembers.map((u) => (
                <label
                  key={u.id}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCommitteeIds.includes(String(u.id))}
                    onChange={() => toggleId(setSelectedCommitteeIds)(u.id)}
                    disabled={busy}
                  />
                  <span>
                    {u.fullName || u.email} <span className="muted">({u.email})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={busy || !selectedCommitteeIds.length}
            onClick={assignCommitteeSelected}
          >
            Assign &amp; send to committee
          </button>
        </div>
      ) : null}

      {showCommitteeAwaitingDirector ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(251,191,36,0.45)",
            background: "rgba(251,191,36,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Sent to committee — awaiting Faculty Coordinator review.</strong>
          {(proposal.assignedCommittee || []).length > 0 ? (
            <span>
              {" "}
              Coordinator(s):{" "}
              {(proposal.assignedCommittee || [])
                .map((r) => r.fullName || r.email || "Coordinator")
                .join(", ")}
            </span>
          ) : null}
          <span className="muted">
            {" "}
            · This proposal leaves Committee Reviews once the coordinator submits.
          </span>
        </div>
      ) : null}

      {isDirector && showCommitteeStageForDirector && committeePassed ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(34,197,94,0.45)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          <strong>✓ Committee review complete.</strong>
          {pipe.committeeReview?.score != null ? (
            <span> Score: {pipe.committeeReview.score}/5.</span>
          ) : null}
          {pipe.committeeReview?.decision ? (
            <span> Decision: {String(pipe.committeeReview.decision).replace(/_/g, " ")}.</span>
          ) : null}
          <span className="muted">
            {isVoluntary
              ? " Voluntary proposal — no finance stage. Issue ethics certificate (above), then approve below to create the project."
              : " Continue with finance assignment below."}
          </span>
        </div>
      ) : null}

      {isDirector && showCommitteeStageForDirector && isVoluntary && committeePassed && directorReady ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(56,189,248,0.45)",
            background: "rgba(56,189,248,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Ready for director approval.</strong>
          <span className="muted">
            {" "}
            Voluntary research — finance is not used. Approve ethics certificate if required, then use{" "}
            <strong>Proposal decision</strong> below to approve and create the project.
          </span>
        </div>
      ) : null}

      {isDirector && showCommitteeStageForDirector && committeeFailed ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(239,68,68,0.45)",
            background: "rgba(239,68,68,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Committee rejected this proposal.</strong>
          {pipe.committeeReview?.comment ? (
            <span className="muted"> {pipe.committeeReview.comment}</span>
          ) : null}
        </div>
      ) : null}

      {canDecideCommittee ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(251,191,36,0.45)",
            background: "rgba(251,191,36,0.08)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "#fbbf24" }}>
            {isDirector ? "Committee review — score & decision (Director)" : "Your committee review — action required"}
          </div>
          {isDirector ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 10 }}>
              Submit the committee review yourself (same as Faculty Coordinator), or assign a coordinator above
              and wait for their submission.
            </p>
          ) : null}
          <div style={{ marginBottom: 12 }}>
          <label>
            Committee score (1–5)
            <input
              type="number"
              min={1}
              max={5}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              style={{ marginLeft: 8, width: 64 }}
            />
          </label>
          <input
            placeholder="Committee comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !comment.trim() || score < 1 || score > 5}
              onClick={() =>
                run(() =>
                  proposalApi.committeeReview(
                    accessToken,
                    proposal.id,
                    "recommend_approval",
                    comment.trim(),
                    score
                  )
                )
              }
            >
              Recommend approval
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !comment.trim() || score < 1 || score > 5}
              onClick={() =>
                run(() =>
                  proposalApi.committeeReview(
                    accessToken,
                    proposal.id,
                    "recommend_revision",
                    comment.trim(),
                    score
                  )
                )
              }
            >
              Recommend revision
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !comment.trim() || score < 1 || score > 5}
              onClick={() =>
                run(() =>
                  proposalApi.committeeReview(
                    accessToken,
                    proposal.id,
                    "reject",
                    comment.trim(),
                    score
                  )
                )
              }
            >
              Reject
            </button>
          </div>
          </div>
        </div>
      ) : null}

      {(isCoordinator || isDirector) && committeeCompletedByMe && !committeeStageOpen ? (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderColor: "rgba(34,197,94,0.4)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          {isDirector
            ? "✓ Committee review submitted. Continue with finance assignment or final proposal approval below."
            : "✓ Your committee review was submitted. The Research Director can continue the pipeline."}
        </div>
      ) : null}

      {isCoordinator &&
      !assignedToCommittee &&
      pipe.peerReview?.status === "passed" &&
      stageOpen(pipe.committeeReview?.status) ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Ask the Research Director to assign you to the committee for this proposal.
        </div>
      ) : null}

      {canAssignFinance ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(148,197,255,0.2)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Assign finance</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Grant fund call only. Select Finance Officers and click Assign — status becomes{" "}
            <strong>Sent to finance</strong>.
          </p>
          {financeOfficers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              No active finance officers on this portal.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {financeOfficers.map((u) => (
                <label
                  key={u.id}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFinanceIds.includes(String(u.id))}
                    onChange={() => toggleId(setSelectedFinanceIds)(u.id)}
                    disabled={busy}
                  />
                  <span>
                    {u.fullName || u.email} <span className="muted">({u.email})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={busy || !selectedFinanceIds.length}
            onClick={assignFinanceSelected}
          >
            Assign &amp; send to finance
          </button>
        </div>
      ) : null}

      {showFinanceAwaitingDirector ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(251,191,36,0.45)",
            background: "rgba(251,191,36,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Sent to finance — awaiting Finance Officer review.</strong>
          {(proposal.assignedFinance || []).length > 0 ? (
            <span>
              {" "}
              Officer(s):{" "}
              {(proposal.assignedFinance || [])
                .map((r) => r.fullName || r.email || "Finance")
                .join(", ")}
            </span>
          ) : null}
          <span className="muted">
            {" "}
            · Leaves the finance queue once the officer submits. Then approve the proposal to create the project.
          </span>
        </div>
      ) : null}

      {isDirector && showFinanceStageForDirector && financePassed ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(34,197,94,0.45)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          <strong>✓ Finance review complete.</strong>
          {pipe.financeReview?.decision ? (
            <span> Decision: {pipe.financeReview.decision}.</span>
          ) : null}
          <span className="muted">
            {" "}
            Issue ethics certificate if required, then use <strong>Proposal decision</strong> below to approve and
            create the project.
          </span>
        </div>
      ) : null}

      {isDirector && showFinanceStageForDirector && financeFailed ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: 12,
            borderColor: "rgba(239,68,68,0.45)",
            background: "rgba(239,68,68,0.08)",
            fontSize: 13,
          }}
        >
          <strong>Finance rejected this proposal budget.</strong>
          {pipe.financeReview?.comment ? (
            <span className="muted"> {pipe.financeReview.comment}</span>
          ) : null}
        </div>
      ) : null}

      {canDecideFinance ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(251,191,36,0.45)",
            background: "rgba(251,191,36,0.08)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "#fbbf24" }}>
            Your finance review — action required
          </div>
          <input
            placeholder="Finance review comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !comment.trim()}
              onClick={() =>
                run(() =>
                  proposalApi.financeProposalReview(
                    accessToken,
                    proposal.id,
                    "approve",
                    comment.trim()
                  )
                )
              }
            >
              Finance approve
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !comment.trim()}
              onClick={() =>
                run(() =>
                  proposalApi.financeProposalReview(
                    accessToken,
                    proposal.id,
                    "reject",
                    comment.trim()
                  )
                )
              }
            >
              Finance reject
            </button>
          </div>
        </div>
      ) : null}

      {isFinance && financeCompletedByMe && !financeStageOpen ? (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderColor: "rgba(34,197,94,0.4)",
            background: "rgba(34,197,94,0.08)",
            fontSize: 13,
          }}
        >
          ✓ Your finance review was submitted. The Research Director can approve the proposal and create the project.
        </div>
      ) : null}

      {isFinance &&
      !assignedToFinance &&
      !isVoluntary &&
      pipe.committeeReview?.status === "passed" &&
      stageOpen(pipe.financeReview?.status) ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          Ask the Research Director to assign you to finance-review this proposal.
        </div>
      ) : null}
    </div>
  );
}
