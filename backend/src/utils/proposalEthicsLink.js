const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Proposal, ETHICS_STATUSES: PROPOSAL_ETHICS } = require("../models/Proposal");

function isEthicsFormComplete(a) {
  if (!a) return false;
  const hasTitle = Boolean(String(a.projectTitle || "").trim());
  const hasPrincipal = Boolean(String(a.principal?.firstName || "").trim() && String(a.principal?.lastName || "").trim());
  const hasLevel = Boolean(String(a.projectLevel || "").trim());
  const hasAims = Boolean(String(a.aimsObjectives || "").trim());
  const hasDesign = Boolean(String(a.design || "").trim());
  const hasSignature = Boolean(String(a.applicantSignature?.name || "").trim());
  return hasTitle && hasPrincipal && hasLevel && hasAims && hasDesign && hasSignature;
}

async function getEthicsForProposal(proposalId) {
  return EthicsApplication.findOne({ proposalId });
}

async function syncProposalEthicsStatus(proposalId, ethicsStatus) {
  if (!proposalId) return;
  await Proposal.updateOne({ _id: proposalId }, { ethicsStatus });
}

async function assertEthicsReadyForProposalSubmit(proposal) {
  const ethics = await getEthicsForProposal(proposal._id);
  if (!ethics) {
    throw new Error("Ethics application is required for this proposal. Please complete the ethics form.");
  }
  if (!isEthicsFormComplete(ethics)) {
    const parts = [];
    if (!String(ethics.projectTitle || "").trim()) parts.push("project title");
    if (!String(ethics.principal?.firstName || "").trim() || !String(ethics.principal?.lastName || "").trim()) {
      parts.push("PI name");
    }
    if (!String(ethics.projectLevel || "").trim()) parts.push("project level");
    if (!String(ethics.aimsObjectives || "").trim()) parts.push("aims & objectives");
    if (!String(ethics.design || "").trim()) parts.push("design");
    if (!String(ethics.applicantSignature?.name || "").trim()) parts.push("signature");
    throw new Error(
      `Ethics form is incomplete. Complete: ${parts.join(", ")}.`
    );
  }
  return ethics;
}

async function submitLinkedEthics(ethics) {
  if (!ethics) {
    throw new Error("Ethics application is required for this proposal.");
  }
  if (!isEthicsFormComplete(ethics)) {
    throw new Error("Complete the ethics form before submitting to the Director.");
  }
  if ([ETHICS_STATUSES.SUBMITTED, ETHICS_STATUSES.APPROVED].includes(ethics.status)) {
    return ethics;
  }
  if (![ETHICS_STATUSES.DRAFT, ETHICS_STATUSES.REJECTED].includes(ethics.status)) {
    throw new Error("Ethics application cannot be submitted in its current status.");
  }
  ethics.status = ETHICS_STATUSES.SUBMITTED;
  if (!ethics.applicantSignature?.signedAt) {
    ethics.applicantSignature = {
      name:
        ethics.applicantSignature?.name ||
        `${ethics.principal?.firstName || ""} ${ethics.principal?.lastName || ""}`.trim(),
      signedAt: new Date(),
    };
  }
  await ethics.save();
  return ethics;
}

async function assertEthicsApprovedForDirectorApproval(proposal) {
  const ethics = await getEthicsForProposal(proposal._id);
  if (!ethics || ethics.status !== ETHICS_STATUSES.APPROVED) {
    throw new Error("Approve the linked ethics application (REC) before approving this proposal.");
  }
  return ethics;
}

module.exports = {
  isEthicsFormComplete,
  getEthicsForProposal,
  syncProposalEthicsStatus,
  assertEthicsReadyForProposalSubmit,
  assertEthicsApprovedForDirectorApproval,
  submitLinkedEthics,
  ETHICS_STATUSES,
  PROPOSAL_ETHICS,
};
