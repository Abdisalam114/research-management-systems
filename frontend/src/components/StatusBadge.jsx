/**
 * Shared status badge — same look as Ethics Approved (solid pill).
 * Approved / accepted / completed / active (success) → green.
 */
const STATUS_COLORS = {
  draft: "#7dd3fc",
  submitted: "#38bdf8",
  under_review: "#eab308",
  revision_requested: "#fb923c",
  pending: "#f59e0b",
  pending_finance: "#f59e0b",
  approved: "#16a34a",
  accepted: "#16a34a",
  validated: "#16a34a",
  active: "#16a34a",
  awarded: "#16a34a",
  completed: "#16a34a",
  closed: "#64748b",
  rejected: "#1e3a8a",
  on_hold: "#94a3b8",
  closing: "#eab308",
  proposed: "#38bdf8",
  in_progress: "#0ea5e9",
  defended: "#16a34a",
  open: "#16a34a",
  paid: "#16a34a",
  requested: "#38bdf8",
  procurement_approved: "#0ea5e9",
  director_approved: "#0284c7",
  none: "#64748b",
};

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  pending: "Pending",
  pending_finance: "Pending finance",
  approved: "Approved",
  accepted: "Accepted",
  validated: "Validated",
  active: "Active",
  awarded: "Awarded",
  completed: "Completed",
  closed: "Closed",
  rejected: "Rejected",
  on_hold: "On hold",
  closing: "Closing",
  proposed: "Proposed",
  in_progress: "In progress",
  defended: "Defended",
  open: "Open",
  paid: "Paid",
  requested: "Requested",
  procurement_approved: "Finance reviewed",
  director_approved: "Director approved",
  none: "None",
};

export function statusBadgeColor(status) {
  const key = String(status || "").toLowerCase();
  return STATUS_COLORS[key] || "#64748b";
}

export function statusBadgeLabel(status) {
  const key = String(status || "").toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  if (!status) return "—";
  return String(status).replace(/_/g, " ");
}

export function StatusBadge({ status, label, style }) {
  const text = label || statusBadgeLabel(status);
  return (
    <span
      style={{
        display: "inline-block",
        background: statusBadgeColor(status),
        color: "#fff",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </span>
  );
}
