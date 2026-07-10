const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { FundingCall } = require("../models/FundingCall");
const { RepositoryItem } = require("../models/RepositoryItem");
const { AppError } = require("../utils/AppError");

const LIMIT = 8;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function globalSearch(req, res) {
  const q = String(req.query?.q || "").trim();
  if (q.length < 2) throw new AppError("Search query must be at least 2 characters", 400);

  const { role, id: userId } = req.user;
  const rx = new RegExp(escapeRegex(q), "i");
  const tier = req.tierWhere({});
  const isResearcher = role === "researcher";

  const proposalFilter = { ...tier, title: rx };
  const projectFilter = { ...tier, title: rx };
  const grantFilter = { ...tier, title: rx };
  const pubFilter = { ...tier, title: rx };
  const callFilter = { ...tier, title: rx };
  const repoFilter = { ...tier, title: rx };

  if (isResearcher) {
    proposalFilter.researcherId = userId;
    projectFilter.researcherId = userId;
    grantFilter.researcherId = userId;
    pubFilter.researcherId = userId;
    callFilter.status = "open";
  }

  const [proposals, projects, grants, publications, calls, repository] = await Promise.all([
    Proposal.find(proposalFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    Project.find(projectFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    Grant.find(grantFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    Publication.find(pubFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    FundingCall.find(callFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status deadline"),
    isResearcher
      ? RepositoryItem.find(repoFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title type updatedAt")
      : RepositoryItem.find(repoFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title type updatedAt"),
  ]);

  res.json({
    query: q,
    results: {
      proposals: proposals.map((p) => ({ id: p._id, title: p.title, status: p.status, type: "proposal", link: `/proposals/${p._id}` })),
      projects: projects.map((p) => ({ id: p._id, title: p.title, status: p.status, type: "project", link: `/projects/${p._id}` })),
      grants: grants.map((g) => ({ id: g._id, title: g.title, status: g.status, type: "grant", link: `/grants/${g._id}` })),
      publications: publications.map((p) => ({ id: p._id, title: p.title, status: p.status, type: "publication", link: "/publications" })),
      fundingCalls: calls.map((c) => ({ id: c._id, title: c.title, status: c.status, type: "funding_call", link: `/grants/apply?callId=${c._id}` })),
      repository: repository.map((r) => ({ id: r._id, title: r.title, type: r.type, link: "/repository" })),
    },
  });
}

module.exports = { globalSearch };
