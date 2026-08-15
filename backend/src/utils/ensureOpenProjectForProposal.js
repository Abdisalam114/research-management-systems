const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { User } = require("../models/User");

function ownerId(proposal) {
  return proposal?.researcherId?._id || proposal?.researcherId || null;
}

async function seedPiTeamMembers(proposal) {
  const researcherId = ownerId(proposal);
  if (!researcherId) return [];
  const user = await User.findById(researcherId).select("fullName");
  return [
    {
      name: user?.fullName || "Principal Investigator",
      userId: researcherId,
      role: "pi",
    },
  ];
}

function assignPayload(req, data) {
  if (typeof req.createWithTier === "function") return req.createWithTier(data);
  if (typeof req.tierAssign === "function") return req.tierAssign(data);
  return data;
}

async function ensureOpenProjectForProposal(req, proposal, { force = false } = {}) {
  if (!proposal?._id) return null;
  const researcherId = ownerId(proposal);

  let project = await Project.findOne({
    $or: [{ proposalId: proposal._id }, { proposal: proposal._id }],
  });

  if (!project && proposal.openProjectDeletedAt && !force) {
    return null;
  }

  if (!project) {
    if (proposal.openProjectDeletedAt && force) {
      proposal.openProjectDeletedAt = null;
      if (typeof proposal.save === "function") {
        await proposal.save();
      } else {
        await Proposal.updateOne({ _id: proposal._id }, { $set: { openProjectDeletedAt: null } });
      }
    }
    project = await Project.create(
      assignPayload(req, {
        proposalId: proposal._id,
        title: proposal.title,
        researcherId,
        leadResearcher: researcherId,
        programTier: proposal.programTier || req.programTier,
        teamMembers: await seedPiTeamMembers(proposal),
        milestones: [],
        status: PROJECT_STATUSES.ACTIVE,
        progressReports: [],
      })
    );
    return project;
  }

  let dirty = false;
  if (!project.researcherId && researcherId) {
    project.researcherId = researcherId;
    dirty = true;
  }
  if (!project.leadResearcher && researcherId) {
    project.leadResearcher = researcherId;
    dirty = true;
  }
  if (!project.proposalId) {
    project.proposalId = proposal._id;
    dirty = true;
  }
  if (!(project.teamMembers || []).length) {
    project.teamMembers = await seedPiTeamMembers(proposal);
    dirty = true;
  }
  if (
    project.status !== PROJECT_STATUSES.ACTIVE &&
    project.status !== PROJECT_STATUSES.CLOSING &&
    !["completed", "closed"].includes(project.status)
  ) {
    project.status = PROJECT_STATUSES.ACTIVE;
    dirty = true;
  }
  if (dirty) await project.save();
  return project;
}

/** Create Open projects for proposals that were accepted before project-create failed. */
async function backfillOpenProjectsForApprovedProposals(req) {
  if (!req?.user) return;
  const role = req.user.role;
  if (!["researcher", "research_director", "faculty_coordinator"].includes(role)) return;
  if (role === "researcher" && typeof req.ownedWhere !== "function") return;
  if (role !== "researcher" && typeof req.tierWhere !== "function") return;

  const proposalFilter =
    role === "researcher"
      ? req.ownedWhere({ status: PROPOSAL_STATUSES.APPROVED })
      : req.tierWhere({ status: PROPOSAL_STATUSES.APPROVED });

  const approved = await Proposal.find(proposalFilter).select(
    "_id title researcherId programTier openProjectDeletedAt"
  );
  if (!approved.length) return;

  const ids = approved.map((p) => p._id);
  const existing = await Project.find({
    $or: [{ proposalId: { $in: ids } }, { proposal: { $in: ids } }],
  }).select("proposalId proposal");

  const hasProject = new Set();
  for (const proj of existing) {
    const pid = proj.proposalId || proj.proposal;
    if (pid) hasProject.add(String(pid));
  }

  for (const proposal of approved) {
    if (proposal.openProjectDeletedAt) continue;
    if (hasProject.has(String(proposal._id))) continue;
    if (!ownerId(proposal)) continue;
    try {
      await ensureOpenProjectForProposal(req, proposal);
    } catch {
      /* listing / dashboard must still load */
    }
  }
}

module.exports = {
  ensureOpenProjectForProposal,
  backfillOpenProjectsForApprovedProposals,
};
