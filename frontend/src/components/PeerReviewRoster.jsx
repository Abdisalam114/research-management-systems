import { buildPeerReviewRoster } from "../utils/peerReviewRoster";

function formatWhen(at) {
  if (!at) return "";
  try {
    return new Date(at).toLocaleString();
  } catch {
    return "";
  }
}

/**
 * Shows who peer review was sent to, and who has submitted vs still pending.
 */
export function PeerReviewRoster({
  assignedReviewers = [],
  peerReviews = [],
  compact = false,
  showComments = false,
  showScores = true,
}) {
  const { rows, sentCount, submittedCount, pendingCount } = buildPeerReviewRoster(
    assignedReviewers,
    peerReviews
  );
  if (!rows.length) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14 }}>
        Peer reviewers
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>
        Sent to {sentCount}
        {" · "}
        <span style={{ color: "#22c55e", fontWeight: 600 }}>{submittedCount} received</span>
        {pendingCount > 0 ? (
          <>
            {" · "}
            <span style={{ color: "#fbbf24", fontWeight: 600 }}>{pendingCount} pending</span>
          </>
        ) : null}
      </p>
      <div style={{ display: "grid", gap: compact ? 6 : 8 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              fontSize: 13,
              paddingBottom: compact || !showComments ? 0 : 8,
              borderBottom:
                !compact && showComments ? "1px solid rgba(148,197,255,0.15)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <div>
                <strong>{row.name}</strong>
                {row.email && row.email !== row.name ? (
                  <span className="muted"> · {row.email}</span>
                ) : null}
              </div>
              {row.submitted ? (
                <span style={{ color: "#22c55e", fontWeight: 700, whiteSpace: "nowrap" }}>
                  ✓ Received
                  {showScores && row.score != null ? ` (${row.score}/5)` : ""}
                </span>
              ) : (
                <span style={{ color: "#fbbf24", fontWeight: 700, whiteSpace: "nowrap" }}>
                  ⏳ Pending
                </span>
              )}
            </div>
            {row.submitted && row.at ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {formatWhen(row.at)}
              </div>
            ) : null}
            {showComments && row.submitted ? (
              compact && row.comment?.trim() ? (
                <div className="muted" style={{ marginTop: 2 }}>
                  {row.comment.trim().slice(0, 120)}
                  {row.comment.trim().length > 120 ? "…" : ""}
                </div>
              ) : !compact ? (
                <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                  {row.comment?.trim() ? row.comment : <span className="muted">No comment</span>}
                </div>
              ) : null
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
