const { Proposal } = require("../models/Proposal");
const { User, USER_STATUSES, ROLES } = require("../models/User");
const { userDisplayName } = require("./userDisplay");

async function enrichProjectsResearcher(projects) {
  const list = projects || [];
  if (!list.length) return [];

  const needLookup = list.filter((p) => !userDisplayName(p.researcherId) || userDisplayName(p.researcherId) === "—");
  const proposalIds = [...new Set(needLookup.map((p) => p.proposalId).filter(Boolean).map(String))];

  const proposals = proposalIds.length
    ? await Proposal.find({ _id: { $in: proposalIds } }).populate("researcherId", "fullName name email")
    : [];
  const propById = Object.fromEntries(proposals.map((p) => [String(p._id), p]));

  const userIds = new Set();
  for (const p of list) {
    if (userDisplayName(p.researcherId) !== "—") continue;
    const directId = p.researcherId?._id || p.researcherId;
    if (directId) userIds.add(String(directId));
    const prop = propById[String(p.proposalId)];
    const propRid = prop?.researcherId?._id || prop?.researcherId;
    if (propRid) userIds.add(String(propRid));
  }

  const users = userIds.size
    ? await User.find({ _id: { $in: [...userIds] } }).select("fullName name email")
    : [];
  const userById = Object.fromEntries(users.map((u) => [String(u._id), userDisplayName(u)]));

  return list.map((p) => {
    let piName = userDisplayName(p.researcherId);
    if (piName === "—") {
      const directId = p.researcherId?._id || p.researcherId;
      if (directId) piName = userById[String(directId)] || "—";
    }
    if (piName === "—") {
      const prop = propById[String(p.proposalId)];
      piName = userDisplayName(prop?.researcherId);
      if (piName === "—") {
        const propRid = prop?.researcherId?._id || prop?.researcherId;
        if (propRid) piName = userById[String(propRid)] || "—";
      }
    }
    return { doc: p, piName };
  });
}

async function backfillMissingProjectResearchers() {
  const { Project } = require("../models/Project");
  const missing = await Project.find({
    $or: [{ researcherId: null }, { researcherId: { $exists: false } }],
  }).select("title proposalId researcherId status");

  const researchers = await User.find({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE })
    .select("_id fullName")
    .sort({ fullName: 1 });

  let fixedFromProposal = 0;
  let fixedFromAssign = 0;
  let stillMissing = 0;
  let idx = 0;

  for (const project of missing) {
    const proposal = project.proposalId
      ? await Proposal.findById(project.proposalId).select("researcherId title")
      : null;

    if (proposal?.researcherId) {
      project.researcherId = proposal.researcherId;
      await project.save();
      fixedFromProposal += 1;
      continue;
    }

    if (researchers.length) {
      const r = researchers[idx % researchers.length];
      project.researcherId = r._id;
      await project.save();
      fixedFromAssign += 1;
      idx += 1;
      continue;
    }

    stillMissing += 1;
  }

  return { orphanProjects: missing.length, fixedFromProposal, fixedFromAssign, stillMissing };
}

module.exports = { enrichProjectsResearcher, backfillMissingProjectResearchers };
