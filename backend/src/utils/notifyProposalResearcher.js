const { notifyUser } = require("./notify");

/** Short English progress notice to the proposal owner (researcher). */
async function notifyProposalResearcher(proposal, { title, body, link } = {}) {
  if (!proposal?.researcherId || !title) return;
  try {
    await notifyUser(proposal.researcherId, {
      type: "proposal",
      title,
      body: body || proposal.title,
      link: link || `/proposals/${proposal._id}`,
      programTier: proposal.programTier,
    });
  } catch {
    /* best-effort */
  }
}

module.exports = { notifyProposalResearcher };
