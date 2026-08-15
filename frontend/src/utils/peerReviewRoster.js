/** Normalize user id from assignedReviewers / peerReviews payloads. */
export function personId(ref) {
  if (ref == null || ref === "") return "";
  if (typeof ref === "object") {
    if (ref._id != null) return String(ref._id);
    if (ref.userId != null && typeof ref.userId !== "object") return String(ref.userId);
    if (ref.userId && typeof ref.userId === "object") return personId(ref.userId);
    if (ref.reviewerId != null) return personId(ref.reviewerId);
    if (typeof ref.id === "string" || typeof ref.id === "number") return String(ref.id);
    return "";
  }
  return String(ref);
}

/**
 * One row per person the proposal was sent to, plus anyone who submitted
 * without being in assignedReviewers (e.g. Director).
 */
export function buildPeerReviewRoster(assignedReviewers = [], peerReviews = []) {
  const reviewsByUser = new Map();
  for (const review of peerReviews || []) {
    const id = personId(review.userId) || personId(review.reviewerId);
    if (!id) continue;
    reviewsByUser.set(id, review);
  }

  const rows = [];
  const seen = new Set();

  for (const assignee of assignedReviewers || []) {
    const id = personId(assignee.userId) || personId(assignee.id) || personId(assignee);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const review = reviewsByUser.get(id);
    const submitted = Boolean(review) || Boolean(assignee.peerReviewSubmitted);
    rows.push({
      id,
      name:
        assignee.fullName ||
        assignee.reviewerName ||
        review?.reviewerName ||
        assignee.email ||
        review?.reviewerEmail ||
        "Reviewer",
      email: assignee.email || assignee.reviewerEmail || review?.reviewerEmail || "",
      submitted,
      score: review?.score,
      comment: review?.comment || "",
      at: review?.at || null,
    });
  }

  for (const review of peerReviews || []) {
    const id = personId(review.userId) || personId(review.reviewerId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: review.reviewerName || review.reviewerEmail || "Reviewer",
      email: review.reviewerEmail || "",
      submitted: true,
      score: review.score,
      comment: review.comment || "",
      at: review.at || null,
    });
  }

  const submittedCount = rows.filter((r) => r.submitted).length;
  return {
    rows,
    sentCount: rows.length,
    submittedCount,
    pendingCount: rows.length - submittedCount,
  };
}
