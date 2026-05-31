/** Resolve PI user ref from current or legacy project document shapes. */
const { userDisplayName } = require("./userDisplay");

function resolvePrincipalInvestigatorId(project) {
  if (!project) return null;
  const researcherId = project.researcherId?._id || project.researcherId;
  if (researcherId) return researcherId;

  const leadResearcher = project.leadResearcher?._id || project.leadResearcher;
  if (leadResearcher) return leadResearcher;

  const teamMembers = project.teamMembers || [];
  const fromTeamMember = teamMembers.find((m) => m?.userId)?.userId;
  if (fromTeamMember) return fromTeamMember;

  const legacyTeam = project.team || [];
  if (legacyTeam.length) return legacyTeam[0];

  return null;
}

function resolvePrincipalInvestigatorName(project) {
  if (!project) return null;

  const fromResearcher = userDisplayName(project.researcherId);
  if (fromResearcher !== "—") return fromResearcher;

  const fromLead = userDisplayName(project.leadResearcher);
  if (fromLead !== "—") return fromLead;

  if (project.principalInvestigator?.fullName) return project.principalInvestigator.fullName;
  if (project.principalInvestigatorName) return project.principalInvestigatorName;

  return null;
}

const PROJECT_PI_POPULATE = [
  { path: "researcherId", select: "fullName name email department" },
  { path: "leadResearcher", select: "fullName name email department" },
];

module.exports = {
  resolvePrincipalInvestigatorId,
  resolvePrincipalInvestigatorName,
  PROJECT_PI_POPULATE,
};
