function reviewerRefId(ref) {
  if (ref == null) return "";
  if (typeof ref === "object") {
    if (ref._id != null) return String(ref._id);
    if (typeof ref.id === "string" || typeof ref.id === "number") return String(ref.id);
    return String(ref);
  }
  return String(ref);
}

function stageClosed(status) {
  return status === "passed" || status === "failed";
}

/** Completed review written by the signed-in user (not work received from others). */
export function getMyCompletedReviewWork(proposal, user) {
  if (!proposal || !user) return null;
  const uid = String(user.id || "");
  const role = user.role;
  const pipe = proposal.reviewPipeline || {};

  if (role === "leadership") {
    const mine = (proposal.peerReviews || []).find((r) => reviewerRefId(r.userId) === uid);
    if (!mine) return null;
    return { stageLabel: "Peer review", comment: mine.comment, score: mine.score };
  }

  if (role === "faculty_coordinator") {
    if (reviewerRefId(pipe.committeeReview?.completedBy) !== uid) return null;
    if (!stageClosed(pipe.committeeReview?.status)) return null;
    return {
      stageLabel: "Committee review",
      comment: pipe.committeeReview?.comment,
      score: pipe.committeeReview?.score,
      decision: pipe.committeeReview?.decision,
    };
  }

  if (role === "finance_officer") {
    if (reviewerRefId(pipe.financeReview?.completedBy) !== uid) return null;
    if (!stageClosed(pipe.financeReview?.status)) return null;
    return {
      stageLabel: "Finance review",
      comment: pipe.financeReview?.comment,
      decision: pipe.financeReview?.decision,
    };
  }

  if (role === "research_director") {
    if (
      reviewerRefId(pipe.committeeReview?.completedBy) === uid &&
      stageClosed(pipe.committeeReview?.status)
    ) {
      return {
        stageLabel: "Committee review",
        comment: pipe.committeeReview?.comment,
        score: pipe.committeeReview?.score,
        decision: pipe.committeeReview?.decision,
      };
    }
    const mine = (proposal.peerReviews || []).find((r) => reviewerRefId(r.userId) === uid);
    if (mine) return { stageLabel: "Peer review", comment: mine.comment, score: mine.score };
  }

  return null;
}

/** Read-only confirmation that a review stage was completed. */
export function WorkDoneBox({
  stageLabel,
  comment,
  score,
  decision,
  style,
}) {
  const body = String(comment || "").trim() || "Submitted.";
  const rows = Math.min(8, Math.max(3, body.split("\n").length + 1));
  return (
    <div
      id="review-work-done"
      className="card"
      style={{
        marginTop: 10,
        marginBottom: 0,
        borderColor: "rgba(34,197,94,0.5)",
        background: "rgba(34,197,94,0.08)",
        ...style,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, color: "#86efac" }}>
        This work has been done — {stageLabel}
      </div>
      {score != null ? (
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Score: <strong>{score}/5</strong>
        </div>
      ) : null}
      {decision ? (
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Decision: <strong>{String(decision).replace(/_/g, " ")}</strong>
        </div>
      ) : null}
      <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
        Review submitted
      </label>
      <textarea
        readOnly
        value={body}
        rows={rows}
        style={{ width: "100%", display: "block", resize: "vertical" }}
      />
    </div>
  );
}
