const { GRANT_STATUSES } = require("../models/Grant");
const { PROJECT_STATUSES } = require("../models/Project");
const { PUBLICATION_STATUSES } = require("../models/Publication");
const { GROUP_KINDS } = require("../models/ResearchGroup");

/** Collaboration groups only — matches Groups module list filter. */
const COLLAB_GROUP_FILTER = {
  $or: [{ kind: GROUP_KINDS.COLLABORATION }, { kind: { $exists: false } }],
};

/** Grant has a recorded award amount (director approved with funding). */
function isAwardedGrant(g) {
  return Number(g?.amountAwarded || 0) > 0;
}

function sumAwardedAmount(grants) {
  return (grants || []).reduce((acc, g) => acc + (Number(g.amountAwarded) || 0), 0);
}

function grantSuccessRate(grants) {
  const decided = (grants || []).filter((g) =>
    [GRANT_STATUSES.APPROVED, GRANT_STATUSES.REJECTED, GRANT_STATUSES.ACTIVE, GRANT_STATUSES.CLOSED].includes(
      g.status
    )
  );
  const won = decided.filter((g) =>
    [GRANT_STATUSES.APPROVED, GRANT_STATUSES.ACTIVE, GRANT_STATUSES.CLOSED].includes(g.status)
  );
  return decided.length ? Math.round((won.length / decided.length) * 100) : 0;
}

const METRIC_DEFINITIONS = Object.freeze({
  "overview.proposals": { source: "Proposal.countDocuments({})", listPath: "/proposals" },
  "overview.projects": { source: "Project.countDocuments({})", listPath: "/projects" },
  "overview.grants": { source: "Grant.countDocuments({})", listPath: "/grants" },
  "overview.groups": { source: "ResearchGroup collaboration filter", listPath: "/groups" },
  "overview.modules.workflow": {
    source: "Publication.countDocuments({ status: { $ne: draft } })",
    listPath: "/research-workflow",
    note: "Non-draft publications (pipeline), not workflow stage rows",
  },
  "projectStatus.active": { source: "Project.countDocuments({ status: active })", listPath: "/projects?filter=active" },
  "projectStatus.completed": {
    source: "Project.countDocuments({ status: completed })",
    listPath: "/projects?filter=completed",
  },
  "projectStatus.onHold": { source: "Project.countDocuments({ status: on_hold })", listPath: "/projects?filter=on_hold" },
  "keyMetrics.activeGrantsValue": {
    source: "Sum amountAwarded where isAwardedGrant (active | approved | amountAwarded > 0)",
    listPath: "/grants?filter=awarded",
  },
  grantSuccessRate: {
    source: "won / decided; decided = approved|rejected|active|closed",
    listPath: "/grants",
  },
  "researchOutput.citations": { source: "Sum Publication.citationCount", listPath: "/publications" },
});

module.exports = {
  COLLAB_GROUP_FILTER,
  METRIC_DEFINITIONS,
  isAwardedGrant,
  sumAwardedAmount,
  grantSuccessRate,
  PROJECT_STATUSES,
  PUBLICATION_STATUSES,
};
