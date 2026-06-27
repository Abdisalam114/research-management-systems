const { PROJECT_STATUSES } = require("../models/Project");

/** Legacy Mongo docs use leadResearcher; current schema uses researcherId. */
function projectResearcherRef(project) {
  if (!project) return null;
  const ref = project.researcherId ?? project.leadResearcher;
  if (!ref) return null;
  if (typeof ref === "object" && ref.fullName) return ref;
  return ref;
}

function projectResearcherId(project) {
  const ref = projectResearcherRef(project);
  if (!ref) return null;
  return ref._id || ref;
}

function projectResearcherName(project) {
  const ref = projectResearcherRef(project);
  if (!ref) return null;
  if (typeof ref === "object" && ref.fullName) return ref.fullName;
  return null;
}

function projectPopulatePaths() {
  return [
    { path: "researcherId", select: "fullName email department" },
    { path: "leadResearcher", select: "fullName email department" },
  ];
}

module.exports = {
  projectResearcherRef,
  projectResearcherId,
  projectResearcherName,
  projectPopulatePaths,
  PROJECT_STATUSES,
};
