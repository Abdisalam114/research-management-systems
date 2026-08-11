const {
  PUBLICATION_STATUSES,
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
  JOURNAL_DECISIONS,
} = require("../models/Publication");

const STAGE_ORDER = [
  WORKFLOW_STAGES.SUBMITTED,
  WORKFLOW_STAGES.IN_PROCESS,
  WORKFLOW_STAGES.PIPELINE,
  WORKFLOW_STAGES.PUBLISHED,
];

/** Stages staff can advance with the workflow button (stops at Pipeline). */
const ADVANCEABLE_STAGES = [
  WORKFLOW_STAGES.SUBMITTED,
  WORKFLOW_STAGES.IN_PROCESS,
  WORKFLOW_STAGES.PIPELINE,
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
  const ci = ADVANCEABLE_STAGES.indexOf(current);
  const ni = ADVANCEABLE_STAGES.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

/** Next stage for the advance button — never jumps Pipeline → Published (that is journal accept). */
function nextAdvanceStage(current) {
  const normalized = current && ADVANCEABLE_STAGES.includes(current) ? current : WORKFLOW_STAGES.SUBMITTED;
  const i = ADVANCEABLE_STAGES.indexOf(normalized);
  if (i < 0 || i >= ADVANCEABLE_STAGES.length - 1) return null;
  return ADVANCEABLE_STAGES[i + 1];
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

function isJournalAccept(decision) {
  return decision === JOURNAL_DECISIONS.ACCEPT || decision === "accept" || decision === "validated";
}

module.exports = {
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
  STAGE_ORDER,
  ADVANCEABLE_STAGES,
  resolveWorkflowStage,
  workflowStageLabel,
  canAdvanceWorkflow,
  nextAdvanceStage,
  countByWorkflowStage,
  isJournalAccept,
};
