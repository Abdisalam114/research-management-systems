const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { RepositoryItem } = require("../models/RepositoryItem");
const { EthicsApplication } = require("../models/EthicsApplication");
const { ThesisGroup } = require("../models/ThesisGroup");
const { ResearchGroup } = require("../models/ResearchGroup");
const { Budget } = require("../models/Budget");
const { Payment } = require("../models/Payment");
const { InstitutionalPolicy } = require("../models/InstitutionalPolicy");
const { User, ROLES } = require("../models/User");
const { Department } = require("../models/Department");
const { Notification } = require("../models/Notification");
const { coordinatorMatchesResearcherDept } = require("../utils/facultyMatcher");
const { peerReviewLeadershipQueueFilter } = require("../utils/proposalReviewPipeline");
const { buildRepositoryAccessFilter, isSeedRepositoryItem } = require("./repositoryExportService");

const LIMIT = 8;

const ACTIVE_COORDINATOR_PROPOSAL_STATUSES = [
  PROPOSAL_STATUSES.SUBMITTED,
  PROPOSAL_STATUSES.UNDER_REVIEW,
  PROPOSAL_STATUSES.REVISION_REQUESTED,
];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function idStr(doc) {
  return String(doc._id || doc.id);
}

function textMatch(fields, rx) {
  return { $or: fields.map((field) => ({ [field]: rx })) };
}

function proposalLink(role, id) {
  if (role === ROLES.RESEARCHER) return `/proposals/${id}`;
  return `/proposals/${id}/review`;
}

function ethicsTitle(app) {
  const t = String(app.projectTitle || "").trim();
  if (t) return t;
  const p = app.principal || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return name || "Ethics application";
}

function thesisTitle(group) {
  const t = String(group.titleProposal?.title || group.title || "").trim();
  if (t) return t;
  const student = (group.students || [])[0]?.fullName;
  return student ? `Thesis — ${student}` : "Thesis group";
}

async function buildResearcherFundingCallFilter(req, titleRx) {
  const tw = (base = {}) => req.tierWhere(base);
  const [myApps, myProps] = await Promise.all([
    Grant.find(tw({ researcherId: req.user.id, callId: { $ne: null } })).select("callId"),
    Proposal.find(tw({ researcherId: req.user.id, fundingCallId: { $ne: null } })).select("fundingCallId"),
  ]);
  const appliedCallIds = [
    ...new Set([
      ...myApps.map((g) => String(g.callId)).filter(Boolean),
      ...myProps.map((p) => String(p.fundingCallId)).filter(Boolean),
    ]),
  ];

  const tierOnlyCodes =
    req.programTier === "undergraduate"
      ? ["ug"]
      : req.programTier === "postgraduate"
        ? ["pg", "pgd"]
        : ["ug", "pg", "pgd"];

  const callText = textMatch(["title", "description", "fundingSource", "donorRef"], titleRx);
  const openPortalFilter = {
    ...callText,
    status: CALL_STATUSES.OPEN,
    $or: [
      { eligibilityTier: "all" },
      { programTier: req.programTier, eligibilityTier: { $in: tierOnlyCodes } },
    ],
  };

  const orClauses = [openPortalFilter];
  if (appliedCallIds.length) {
    orClauses.push({ _id: { $in: appliedCallIds }, ...callText });
  }

  return { $or: orClauses };
}

async function searchRepository(req, titleRx, tw) {
  const base = await buildRepositoryAccessFilter(req);
  const docs = await RepositoryItem.find({
    ...tw(base),
    ...textMatch(["title", "description"], titleRx),
  })
    .sort({ updatedAt: -1 })
    .limit(LIMIT)
    .select("title type projectId status updatedAt");

  return docs
    .filter((item) => !isSeedRepositoryItem(item))
    .map((r) => ({
      id: idStr(r),
      title: r.title,
      status: r.type,
      type: "repository",
      link: r.projectId ? `/repository?projectId=${idStr(r.projectId)}` : "/repository",
    }));
}

async function searchBudgets(req, titleRx, tw) {
  const { role } = req.user;
  if (![ROLES.RESEARCHER, ROLES.RESEARCH_DIRECTOR, ROLES.FINANCE_OFFICER].includes(role)) {
    return [];
  }

  const filter = {};
  if (role === ROLES.RESEARCHER) filter.ownerResearcherId = req.user.id;

  const [matchingProjects, matchingGrants] = await Promise.all([
    Project.find(tw(textMatch(["title"], titleRx))).select("_id"),
    Grant.find(tw(textMatch(["title", "fundingSource"], titleRx))).select("_id"),
  ]);

  filter.$or = [
    ...textMatch(["financeNotes"], titleRx).$or,
    ...textMatch(["items.description"], titleRx).$or,
    ...(matchingProjects.length ? [{ projectId: { $in: matchingProjects.map((p) => p._id) } }] : []),
    ...(matchingGrants.length ? [{ grantId: { $in: matchingGrants.map((g) => g._id) } }] : []),
  ];

  const budgets = await Budget.find(tw(filter))
    .sort({ updatedAt: -1 })
    .limit(LIMIT)
    .populate("projectId", "title")
    .populate("grantId", "title");

  return budgets.map((b) => {
    const label = b.projectId?.title || b.grantId?.title || "Project budget";
    return {
      id: idStr(b),
      title: label,
      status: `${b.currency || "USD"} ${Number(b.totalAllocated || 0).toLocaleString()}`,
      type: "budget",
      link: "/budgets",
    };
  });
}

async function searchPayments(req, titleRx, tw) {
  const { role, id: userId } = req.user;
  if (![ROLES.RESEARCHER, ROLES.RESEARCH_DIRECTOR, ROLES.FINANCE_OFFICER].includes(role)) {
    return [];
  }

  const filter = { ...textMatch(["payee", "purpose", "notes"], titleRx) };
  if (role === ROLES.RESEARCHER) filter.requestedBy = userId;

  const payments = await Payment.find(tw(filter)).sort({ updatedAt: -1 }).limit(LIMIT);
  return payments.map((p) => ({
    id: idStr(p),
    title: `${p.payee} — ${p.purpose}`,
    status: p.status,
    type: "payment",
    link: `/payments/${idStr(p)}`,
  }));
}

async function runGlobalSearch(req) {
  const q = String(req.query?.q || "").trim();
  const { role, id: userId, department } = req.user;
  const titleRx = new RegExp(escapeRegex(q), "i");
  const tw = (base = {}) => req.tierWhere(base);

  const includeProjects = role !== ROLES.LEADERSHIP;
  const includePublications = role !== ROLES.LEADERSHIP;
  const includeRepository = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR, ROLES.RESEARCHER].includes(role);
  const includeEthics = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR, ROLES.RESEARCHER].includes(role);
  const includeThesis = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR, ROLES.RESEARCHER].includes(role);
  const includeResearchGroups = [ROLES.RESEARCH_DIRECTOR, ROLES.FACULTY_COORDINATOR, ROLES.RESEARCHER].includes(role);
  const includeUsers = role === ROLES.RESEARCH_DIRECTOR;
  const includeDepartments = role === ROLES.RESEARCH_DIRECTOR;

  let proposalFilter = tw({ ...textMatch(["title", "abstract", "department", "researchArea"], titleRx) });
  let projectFilter = tw({ ...textMatch(["title"], titleRx) });
  let grantFilter = tw({ ...textMatch(["title", "fundingSource"], titleRx) });
  let pubFilter = tw({ ...textMatch(["title", "venue", "doi", "communityImpact", "authors"], titleRx) });
  let callFilter = tw({ ...textMatch(["title", "description", "fundingSource", "donorRef"], titleRx) });
  let ethicsFilter = tw({ ...textMatch(["projectTitle", "principal.firstName", "principal.lastName", "principal.department", "principal.email", "aimsObjectives", "design", "backgroundLiterature"], titleRx) });
  let thesisFilter = tw({
    ...textMatch(["title", "department", "faculty", "facultyResearchArea", "titleProposal.title", "students.fullName", "students.email", "students.studentId"], titleRx),
  });
  let groupFilter = tw({ ...textMatch(["name", "description"], titleRx) });

  if (role === ROLES.RESEARCHER) {
    proposalFilter.researcherId = userId;
    projectFilter.researcherId = userId;
    grantFilter.researcherId = userId;
    pubFilter.researcherId = userId;
    ethicsFilter.researcherId = userId;
    thesisFilter.supervisorId = userId;
    groupFilter = tw({
      $and: [
        textMatch(["name", "description"], titleRx),
        { $or: [{ createdBy: userId }, { "members.userId": userId }] },
      ],
    });

    const myProjects = await Project.find(tw({ researcherId: userId })).select("_id");
    const myProjectIds = myProjects.map((p) => p._id);
    pubFilter.projectId = { $in: myProjectIds.length ? myProjectIds : ["000000000000000000000000"] };

    callFilter = tw(await buildResearcherFundingCallFilter(req, titleRx));
  } else if (role === ROLES.LEADERSHIP) {
    proposalFilter = tw({
      ...textMatch(["title", "abstract", "department", "researchArea"], titleRx),
      ...peerReviewLeadershipQueueFilter(userId),
    });
  } else if (role === ROLES.FACULTY_COORDINATOR) {
    proposalFilter.status = { $in: ACTIVE_COORDINATOR_PROPOSAL_STATUSES };
    pubFilter.projectId = { $ne: null, $exists: true };
  } else {
    pubFilter.projectId = { $ne: null, $exists: true };
  }

  const policyFilter = tw({ ...textMatch(["title", "body"], titleRx) });
  if (role !== ROLES.LEADERSHIP && role !== ROLES.RESEARCH_DIRECTOR) {
    policyFilter.status = "published";
  }

  const notificationFilter = {
    userId,
    ...textMatch(["title", "body"], titleRx),
  };

  const [
    proposals,
    projects,
    grants,
    publications,
    calls,
    ethicsApps,
    thesisGroups,
    researchGroups,
    repository,
    budgets,
    payments,
    policies,
    users,
    departments,
    notifications,
  ] = await Promise.all([
    Proposal.find(proposalFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    includeProjects
      ? Project.find(projectFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt")
      : Promise.resolve([]),
    Grant.find(grantFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status updatedAt"),
    includePublications
      ? Publication.find(pubFilter)
          .sort({ updatedAt: -1 })
          .limit(LIMIT)
          .select("title status projectId updatedAt")
          .populate("researcherId", "department")
      : Promise.resolve([]),
    role === ROLES.RESEARCHER
      ? FundingCall.find(callFilter).sort({ deadline: 1, updatedAt: -1 }).limit(LIMIT).select("title status deadline")
      : FundingCall.find(callFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status deadline"),
    includeEthics
      ? EthicsApplication.find(ethicsFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("projectTitle status principal proposalId")
      : Promise.resolve([]),
    includeThesis
      ? ThesisGroup.find(thesisFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title titleProposal students status department")
      : Promise.resolve([]),
    includeResearchGroups
      ? ResearchGroup.find(groupFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("name description kind")
      : Promise.resolve([]),
    includeRepository ? searchRepository(req, titleRx, tw) : Promise.resolve([]),
    searchBudgets(req, titleRx, tw),
    searchPayments(req, titleRx, tw),
    InstitutionalPolicy.find(policyFilter).sort({ updatedAt: -1 }).limit(LIMIT).select("title status moduleKey"),
    includeUsers
      ? User.find(req.userWhere(textMatch(["fullName", "email", "department", "rank"], titleRx)))
          .sort({ fullName: 1 })
          .limit(LIMIT)
          .select("fullName email role department status")
      : Promise.resolve([]),
    includeDepartments
      ? Department.find(tw(textMatch(["name", "code", "faculty"], titleRx)))
          .sort({ name: 1 })
          .limit(LIMIT)
          .select("name code faculty")
      : Promise.resolve([]),
    Notification.find(req.tierWhere(notificationFilter)).sort({ createdAt: -1 }).limit(LIMIT).select("title body link type"),
  ]);

  let visiblePublications = publications;
  if (role === ROLES.FACULTY_COORDINATOR && department) {
    const dept = String(department).trim();
    visiblePublications = publications.filter(
      (p) => p.researcherId && coordinatorMatchesResearcherDept(dept, p.researcherId.department)
    );
  }

  let visibleEthics = ethicsApps;
  if (role === ROLES.FACULTY_COORDINATOR && department) {
    const dept = String(department).trim();
    visibleEthics = ethicsApps.filter((a) => {
      const d = a.principal?.department || "";
      return coordinatorMatchesResearcherDept(dept, d);
    });
  }

  let visibleThesis = thesisGroups;
  if (role === ROLES.FACULTY_COORDINATOR && department) {
    const dept = String(department).trim();
    visibleThesis = thesisGroups.filter((g) => coordinatorMatchesResearcherDept(dept, g.department));
  }

  const results = {
    proposals: proposals.map((p) => ({
      id: idStr(p),
      title: p.title,
      status: p.status,
      type: "proposal",
      link: proposalLink(role, idStr(p)),
    })),
    projects: projects.map((p) => ({
      id: idStr(p),
      title: p.title,
      status: p.status,
      type: "project",
      link: `/projects/${idStr(p)}`,
    })),
    grants: grants.map((g) => ({
      id: idStr(g),
      title: g.title,
      status: g.status,
      type: "grant",
      link: `/grants/${idStr(g)}`,
    })),
    publications: visiblePublications.map((p) => ({
      id: idStr(p),
      title: p.title,
      status: p.status,
      type: "publication",
      link: p.projectId ? `/publications?projectId=${idStr(p.projectId)}` : "/publications",
    })),
    fundingCalls: calls.map((c) => ({
      id: idStr(c),
      title: c.title,
      status: c.status,
      type: "funding_call",
      link: `/funding-calls?callId=${idStr(c)}`,
    })),
    ethics: visibleEthics.map((a) => ({
      id: idStr(a),
      title: ethicsTitle(a),
      status: a.status,
      type: "ethics",
      link: a.proposalId
        ? role === ROLES.RESEARCHER
          ? `/proposals/${idStr(a.proposalId)}`
          : `/proposals/${idStr(a.proposalId)}/review`
        : `/ethics?applicationId=${idStr(a)}`,
    })),
    thesisGroups: visibleThesis.map((g) => ({
      id: idStr(g),
      title: thesisTitle(g),
      status: g.status,
      type: "thesis",
      link: `/thesis?groupId=${idStr(g)}`,
    })),
    researchGroups: researchGroups.map((g) => ({
      id: idStr(g),
      title: g.name,
      status: g.kind || "group",
      type: "research_group",
      link: "/groups",
    })),
    repository,
    budgets,
    payments,
    policies: policies.map((p) => ({
      id: idStr(p),
      title: p.title,
      status: p.status,
      type: "policy",
      link: "/policies",
    })),
    users: users.map((u) => ({
      id: idStr(u),
      title: u.fullName || u.email,
      status: u.role,
      type: "user",
      link: "/pending-users",
    })),
    departments: departments.map((d) => ({
      id: idStr(d),
      title: d.name,
      status: d.code,
      type: "department",
      link: "/departments",
    })),
    notifications: notifications.map((n) => ({
      id: idStr(n),
      title: n.title,
      status: n.type,
      type: "notification",
      link: n.link && n.link.startsWith("/") ? n.link : "/notifications",
    })),
  };

  const total = Object.values(results).reduce((n, arr) => n + arr.length, 0);
  return { query: q, total, results };
}

module.exports = { runGlobalSearch, escapeRegex };
