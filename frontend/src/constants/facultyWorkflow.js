export const FACULTY_WORKFLOW_STAGES = [
  { id: "submitted", label: "Submitted", icon: "📤", accent: "#38bdf8" },
  { id: "in_process", label: "In process", icon: "⚙️", accent: "#f59e0b" },
  { id: "pipeline", label: "Pipeline", icon: "📋", accent: "#a78bfa" },
  { id: "published", label: "Published", icon: "✅", accent: "#22c55e" },
];

export function nextWorkflowStage(current) {
  const order = FACULTY_WORKFLOW_STAGES.map((s) => s.id);
  const i = order.indexOf(current);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function workflowStageMeta(stage) {
  return FACULTY_WORKFLOW_STAGES.find((s) => s.id === stage) || { id: stage, label: stage, icon: "•" };
}
