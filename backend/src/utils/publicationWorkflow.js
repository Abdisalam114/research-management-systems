const {
  PUBLICATION_STATUSES,
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
} = require("../models/Publication");

const STAGE_ORDER = [
  WORKFLOW_STAGES.SUBMITTED,
  WORKFLOW_STAGES.IN_PROCESS,
  WORKFLOW_STAGES.PIPELINE,
  WORKFLOW_STAGES.PUBLISHED,
];

function resolveWorkflowStage(pub) {
  if (pub.workflowStage && STAGE_ORDER.includes(pub.workflowStage)) return pub.workflowStage;
  if (pub.status === PUBLICATION_STATUSES.DRAFT) return null;
  if (pub.status === PUBLICATION_STATUSES.SUBMITTED) return WORKFLOW_STAGES.SUBMITTED;
  if (pub.status === PUBLICATION_STATUSES.VALIDATED) return WORKFLOW_STAGES.IN_PROCESS;
  if (pub.status === PUBLICATION_STATUSES.REJECTED) return WORKFLOW_STAGES.SUBMITTED;
  return WORKFLOW_STAGES.SUBMITTED;
}

function workflowStageLabel(stage) {
  return WORKFLOW_STAGE_LABELS[stage] || stage || "—";
}

function canAdvanceWorkflow(current, next) {
  const ci = STAGE_ORDER.indexOf(current);
  const ni = STAGE_ORDER.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

function countByWorkflowStage(publications) {
  const counts = {};
  STAGE_ORDER.forEach((s) => {
    counts[s] = 0;
  });
  publications.forEach((p) => {
    const stage = resolveWorkflowStage(p);
    if (stage && counts[stage] !== undefined) counts[stage] += 1;
  });
  return counts;
}

module.exports = {
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
  STAGE_ORDER,
  resolveWorkflowStage,
  workflowStageLabel,
  canAdvanceWorkflow,
  countByWorkflowStage,
};
