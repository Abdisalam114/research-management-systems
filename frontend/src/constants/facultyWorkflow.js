export const FACULTY_WORKFLOW_STAGES = [
  { id: "submitted", label: "Submitted", icon: "📤", accent: "#38bdf8" },
  { id: "in_process", label: "In process", icon: "⚙️", accent: "#f59e0b" },
  { id: "pipeline", label: "Pipeline", icon: "📋", accent: "#a78bfa" },
  { id: "published", label: "Published", icon: "✅", accent: "#22c55e" },
];

/** Advance button stops at Pipeline — Published comes from journal accept. */
const ADVANCE_ORDER = ["submitted", "in_process", "pipeline"];

export function nextWorkflowStage(current) {
  const normalized = current && ADVANCE_ORDER.includes(current) ? current : "submitted";
  const i = ADVANCE_ORDER.indexOf(normalized);
  return i >= 0 && i < ADVANCE_ORDER.length - 1 ? ADVANCE_ORDER[i + 1] : null;
}

export function workflowStageMeta(stage) {
  return FACULTY_WORKFLOW_STAGES.find((s) => s.id === stage) || { id: stage, label: stage, icon: "•" };
}

export function isPipelineReadyForPublish(stage) {
  return stage === "pipeline";
}
