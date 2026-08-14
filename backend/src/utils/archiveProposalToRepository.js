const { RepositoryItem, REPOSITORY_ITEM_TYPES, REPOSITORY_ACCESS } = require("../models/RepositoryItem");

function resolveProposalDocumentPath(proposal) {
  if (!proposal) return "";
  if (proposal.document) return String(proposal.document).trim();
  const history = proposal.versionHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const doc = history[i]?.document;
    if (doc) return String(doc).trim();
  }
  return "";
}

/**
 * Link approved proposal file into institutional repository for the new project.
 * Idempotent — skips if an approved-proposal item already exists.
 */
async function archiveProposalDocumentToRepository(proposal, project, tierAssign) {
  const filePath = resolveProposalDocumentPath(proposal);
  if (!filePath || !project?._id) return null;

  const existing = await RepositoryItem.findOne({
    projectId: project._id,
    title: { $regex: /^Approved proposal:/i },
  });
  if (existing) return existing;

  return RepositoryItem.create(
    tierAssign({
      type: REPOSITORY_ITEM_TYPES.DOCUMENT,
      title: `Approved proposal: ${proposal.title}`,
      description: "Auto-archived when the proposal was approved and the research project was created.",
      filePath,
      fileSize: 0,
      access: REPOSITORY_ACCESS.INSTITUTION,
      projectId: project._id,
      uploadedBy: proposal.researcherId,
      programTier: project.programTier || proposal.programTier,
    })
  );
}

module.exports = {
  archiveProposalDocumentToRepository,
  resolveProposalDocumentPath,
};
