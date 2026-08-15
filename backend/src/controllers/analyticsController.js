const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget, BUDGET_ITEM_STATUSES } = require("../models/Budget");
const { Payment, PAYMENT_STATUSES } = require("../models/Payment");
const { PurchaseOrder, PO_STATUSES } = require("../models/PurchaseOrder");
const { Publication, PUBLICATION_STATUSES, PUBLICATION_TYPES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { ResearchGroup, GROUP_KINDS } = require("../models/ResearchGroup");
const { User, USER_STATUSES, ROLES } = require("../models/User");
const { Department } = require("../models/Department");
const { EthicsApplication } = require("../models/EthicsApplication");
const { ThesisGroup } = require("../models/ThesisGroup");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { InstitutionalPolicy } = require("../models/InstitutionalPolicy");
const { AuditEvent } = require("../models/AuditEvent");
const {
  buildResearchJourneyForResearcher,
  listResearchersForJourney,
  buildWorkflowForProject,
} = require("../utils/researchJourney");
const { Notification } = require("../models/Notification");
const {
  FACULTIES,
  matchFacultyByName,
  coordinatorMatchesResearcherDept,
  departmentNamesForCoordinatorScope,
  mongoDepartmentInFaculty,
  recordInCoordinatorFaculty,
} = require("../utils/facultyMatcher");
const {
  COLLAB_GROUP_FILTER,
  METRIC_DEFINITIONS,
  isAwardedGrant,
  sumAwardedAmount,
  grantSuccessRate: computeGrantSuccessRate,
} = require("../utils/metricsDefinitions");
const { enrichProjectsResearcher } = require("../utils/projectPi");

function reviewerRefId(ref) {
  if (ref == null) return "";
  if (typeof ref === "object") {
    if (ref._id != null) return String(ref._id);
    if (typeof ref.toHexString === "function") return ref.toHexString();
    if (typeof ref.id === "string" || typeof ref.id === "number") return String(ref.id);
    return String(ref);
  }
  return String(ref);
}
const { AppError } = require("../utils/AppError");
const { userDisplayName } = require("../utils/userDisplay");
const { ACTIVE_PEER_REVIEW_STATUSES, peerReviewDirectorQueueFilter, peerReviewLeadershipQueueFilter, STAGE_STATUS, committeeAssignedToUserFilter, committeeSentToMembersFilter } = require("../utils/proposalReviewPipeline");
const PDFDocument = require("pdfkit");

function countByField(docs, field) {
  const out = {};
  for (const d of docs) {
    const key = d[field] || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function sum(nums) {
  return (nums || []).reduce((acc, n) => acc + (typeof n === "number" ? n : 0), 0);
}

const DASHBOARD_ACTIVE_PROJECTS_LIMIT = 10;

function mapProjectDashboardRow(p, piName) {
  const reports = p.progressReports || [];
  const latest = reports.length ? reports[0] : null;
  const progressPercent =
    latest?.progressPercent ??
    (p.status === PROJECT_STATUSES.COMPLETED ? 100 : p.status === PROJECT_STATUSES.ACTIVE ? 50 : 0);
  return {
    id: String(p._id).slice(-4).padStart(4, "0"),
    projectId: String(p._id),
    title: p.title,
    principalInvestigator: piName || userDisplayName(p.researcherId),
    progressPercent,
    endDate: p.endDate,
    status: p.status,
  };
}

async function mapProjectDashboardRows(projects, { tierFilter = {}, viewerRole = null } = {}) {
  const enriched = await enrichProjectsResearcher(projects);
  return Promise.all(
    enriched.map(async ({ doc, piName }) => {
      const row = mapProjectDashboardRow(doc, piName);
      try {
        const wf = await buildWorkflowForProject(doc._id, tierFilter, viewerRole);
        if (wf?.progressPercent != null) row.progressPercent = wf.progressPercent;
      } catch { /* keep fallback */ }
      return row;
    })
  );
}

async function getDashboardMetrics(req, res) {
  const { role } = req.user;
  const userId = req.user.id;

  const base = {
    scope: role,
    proposals: { total: 0 },
    projects: { total: 0 },
    grants: { total: 0, awardedTotal: 0 },
    budgets: { total: 0, itemsPending: 0, itemsApproved: 0, itemsPaid: 0 },
    publications: { total: 0, validated: 0, submitted: 0 },
    repository: { total: 0 },
    groups: { total: 0 },
  };

  const isStaffAll = ["research_director", "faculty_coordinator"].includes(role);
  const tw = (base = {}, ownerField = "researcherId") =>
    role === "researcher" ? req.researcherDashboardFilter(base, ownerField) : req.tierWhere(base);

  const proposalFilter = tw({});
  const projectFilter = tw({});
  const grantFilter = tw({});
  const pubFilter = tw({});
  const repoFilter = tw({ uploadedBy: userId }, "uploadedBy");
  const budgetFilter = tw(
    role === "researcher" ? {} : role === "finance_officer" ? {} : isStaffAll ? {} : {},
    role === "researcher" ? "ownerResearcherId" : "researcherId"
  );

  const [proposalCount, projectCount, grants, budgets, pubs, repoCount, collabGroupCount, ethicsCount, thesisCount, notifUnread, activeProjectCount, activeProjectDocs, workflowPubCount, fundingCallCount, openFundingCallCount, closuresPendingCount] =
    await Promise.all([
      Proposal.countDocuments(proposalFilter),
      Project.countDocuments(projectFilter),
      Grant.find(grantFilter).select("amountAwarded status"),
      Budget.find(budgetFilter).select("items"),
      Publication.find(pubFilter).select("status"),
      RepositoryItem.countDocuments(repoFilter),
      ResearchGroup.countDocuments(
        tw(
          role === "researcher"
            ? { "members.userId": userId, ...COLLAB_GROUP_FILTER }
            : COLLAB_GROUP_FILTER,
          null
        )
      ),
      EthicsApplication.countDocuments(
        role === "researcher"
          ? { researcherId: userId }
          : tw({ status: "submitted" })
      ),
      ThesisGroup.countDocuments(
        tw(
          role === "researcher"
            ? { $or: [{ supervisorId: userId }, { createdBy: userId }, { coordinatorId: userId }] }
            : {},
          null
        )
      ),
      Notification.countDocuments(
        role === "researcher"
          ? { userId, readAt: null }
          : {
              userId,
              readAt: null,
              ...(req.programTier
                ? {
                    $or: [
                      { programTier: req.programTier },
                      { programTier: { $exists: false } },
                      { programTier: null },
                    ],
                  }
                : {}),
            }
      ),
      Project.countDocuments({ ...projectFilter, status: PROJECT_STATUSES.ACTIVE }),
      Project.find({ ...projectFilter, status: PROJECT_STATUSES.ACTIVE })
        .sort({ updatedAt: -1 })
        .limit(DASHBOARD_ACTIVE_PROJECTS_LIMIT)
        .populate("researcherId", "fullName name email")
        .select("title status progressReports researcherId endDate"),
      Publication.countDocuments({ ...pubFilter, status: { $ne: PUBLICATION_STATUSES.DRAFT } }),
      FundingCall.countDocuments(
        role === "researcher"
          ? {
              $or: [
                { programTier: req.programTier },
                { eligibilityTier: "all" },
              ],
            }
          : tw({})
      ),
      FundingCall.countDocuments(
        role === "researcher"
          ? {
              status: CALL_STATUSES.OPEN,
              $or: [
                { programTier: req.programTier },
                { eligibilityTier: "all" },
              ],
            }
          : tw({ status: CALL_STATUSES.OPEN })
      ),
      Project.countDocuments({
        ...projectFilter,
        "closure.status": CLOSURE_STATUSES.DIRECTOR_APPROVED,
      }),
    ]);

  let usersCount = 0;
  let departmentsCount = 0;
  if (role === "research_director") {
    [usersCount, departmentsCount] = await Promise.all([
      User.countDocuments(tw({ status: USER_STATUSES.ACTIVE, role: { $ne: ROLES.RESEARCH_DIRECTOR } })),
      Department.countDocuments(tw({})),
    ]);
  }

  base.proposals.total = proposalCount;
  let facultyProjectCount = projectCount;
  let facultyActiveProjectCount = activeProjectCount;
  let facultyActiveProjectDocs = activeProjectDocs;
  let facultyGrants = grants;
  let facultyBudgets = budgets;
  let facultyPubs = pubs;
  let facultyEthicsCount = ethicsCount;
  let facultyThesisCount = thesisCount;
  let facultyWorkflowPubCount = workflowPubCount;
  let facultyClosuresPendingCount = closuresPendingCount;

  base.projects.total = facultyProjectCount;
  base.projects.active = facultyActiveProjectCount;
  base.activeProjects = await mapProjectDashboardRows(facultyActiveProjectDocs, {
    tierFilter: projectFilter,
    viewerRole: role,
  });
  base.grants.total = facultyGrants.length;
  base.grants.awardedTotal = sumAwardedAmount(facultyGrants);
  base.grants.awardedCount = facultyGrants.filter(isAwardedGrant).length;

  base.budgets.total = facultyBudgets.length;
  const allItems = facultyBudgets.flatMap((b) => b.items || []);
  base.budgets.itemsPending = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PENDING).length;
  base.budgets.itemsApproved = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.APPROVED).length;
  base.budgets.itemsPaid = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID).length;

  base.publications.total = facultyPubs.length;
  base.publications.validated = facultyPubs.filter((p) => p.status === PUBLICATION_STATUSES.VALIDATED).length;
  base.publications.submitted = facultyPubs.filter((p) => p.status === PUBLICATION_STATUSES.SUBMITTED).length;

  base.repository.total = repoCount;
  base.groups.total = collabGroupCount;
  base.ethics = { total: facultyEthicsCount };
  base.thesis = { total: facultyThesisCount };
  base.notifications = { unread: notifUnread };

  // Peer-review assignments (Leadership dashboard + Director Peer Reviews tile)
  // Both roles use ACTIVE_PEER_REVIEW_STATUSES so counts stay aligned.
  let reviewAssignments = 0;
  let reviewAssignmentsPending = 0;
  let proposalsSentToReviewers = 0;
  if (role === "leadership" || role === "research_director") {
    if (role === "leadership") {
      const assigned = await Proposal.find(
        tw(peerReviewLeadershipQueueFilter(userId))
      ).select("peerReviews assignedReviewers reviewPipeline");
      const open = assigned.filter(
        (p) => !(p.peerReviews || []).some((r) => reviewerRefId(r.userId) === String(userId))
      );
      reviewAssignments = open.length;
      reviewAssignmentsPending = open.length;
    } else {
      // Director Peer Reviews tile = awaiting Leadership only (same filter as Peer Reviews page)
      const sentActive = await Proposal.find(
        tw(peerReviewDirectorQueueFilter())
      ).select("assignedReviewers peerReviews reviewPipeline");
      proposalsSentToReviewers = sentActive.length;
      reviewAssignments = sentActive.length;
      reviewAssignmentsPending = sentActive.filter((p) => {
        const reviewers = p.assignedReviewers || [];
        const pending = reviewers.some(
          (r) =>
            !(p.peerReviews || []).some(
              (pr) => reviewerRefId(pr.userId) === reviewerRefId(r.userId)
            )
        );
        const peerStage = p.reviewPipeline?.peerReview?.status || "pending";
        if (reviewers.length === 0) {
          return peerStage === STAGE_STATUS.PENDING || peerStage === STAGE_STATUS.IN_PROGRESS;
        }
        return pending;
      }).length;
    }
  }
  base.reviewAssignments = reviewAssignments;
  base.reviewAssignmentsPending = reviewAssignmentsPending;
  base.proposalsSentToReviewers = proposalsSentToReviewers;

  let committeeReviews = 0;
  if (role === "faculty_coordinator") {
    committeeReviews = await Proposal.countDocuments(tw(committeeAssignedToUserFilter(userId)));
  } else if (role === "research_director") {
    committeeReviews = await Proposal.countDocuments(tw(committeeSentToMembersFilter()));
  }
  base.committeeReviews = committeeReviews;

  const policiesCount = await InstitutionalPolicy.countDocuments(
    req.programTier ? { programTier: req.programTier } : {}
  );

  base.modules = {
    users: usersCount,
    departments: departmentsCount,
    ethics: facultyEthicsCount,
    proposals: role === "faculty_coordinator" ? base.proposals.total : proposalCount,
    projects: facultyProjectCount,
    grants: facultyGrants.length,
    budgets: facultyBudgets.length,
    publications: facultyPubs.length,
    workflow: facultyWorkflowPubCount,
    repository: repoCount,
    groups: collabGroupCount,
    thesis: facultyThesisCount,
    // Leadership tile prefers pending; Director tile = active sent queue (matches Peer Reviews page)
    reviews:
      role === "leadership" ? reviewAssignmentsPending || reviewAssignments : reviewAssignments,
    committeeReviews,
    policies: policiesCount,
    fundingCalls: openFundingCallCount || fundingCallCount,
    grantsPendingFinance: facultyGrants.filter((g) => g.status === GRANT_STATUSES.PENDING_FINANCE).length,
    closuresPending: facultyClosuresPendingCount,
    messages: "—",
    notificationsUnread: notifUnread,
  };
  base.fundingCalls = { total: fundingCallCount, open: openFundingCallCount };
  base.policies = { total: policiesCount };
res.json({ metrics: base, generatedAt: new Date().toISOString() });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildMonthlyGrantTrends(grants) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: MONTHS[d.getMonth()], year: d.getFullYear(), amount: 0 });
  }

  grants.forEach((g) => {
    const dt = g.decidedAt || g.createdAt;
    if (!dt) return;
    const d = new Date(dt);
    const idx = buckets.findIndex((b) => b.month === MONTHS[d.getMonth()] && b.year === d.getFullYear());
    if (idx >= 0 && isAwardedGrant(g)) buckets[idx].amount += g.amountAwarded || 0;
  });

  return buckets.map(({ month, amount }) => ({ month, amount }));
}

async function buildInstitutionalAnalytics(programTier) {
  // null/undefined = all UG + PG (shared staff). Specific tier = filter that portal only.
  const tf = (base = {}) =>
    programTier ? { ...base, programTier } : { ...base };
  const [
    proposalCount,
    projectCount,
    grantCount,
    budgetCount,
    publicationCount,
    repositoryCount,
    ethicsCount,
    thesisCount,
    usersCount,
    departmentsCount,
    collabGroupCount,
    researcherCount,
    activeProjectCount,
    completedProjectCount,
    onHoldProjectCount,
    workflowPubCount,
    dashboardActiveProjects,
    allProjectsForFaculty,
    grants,
    budgets,
    publications,
    proposals,
    repositoryItems,
    groups,
  ] = await Promise.all([
    Proposal.countDocuments(tf({})),
    Project.countDocuments(tf({})),
    Grant.countDocuments(tf({})),
    Budget.countDocuments(tf({})),
    Publication.countDocuments(tf({})),
    RepositoryItem.countDocuments(tf({})),
    EthicsApplication.countDocuments(tf({})),
    ThesisGroup.countDocuments(tf({})),
    User.countDocuments(tf({ status: USER_STATUSES.ACTIVE, role: { $ne: ROLES.RESEARCH_DIRECTOR } })),
    Department.countDocuments(tf({})),
    ResearchGroup.countDocuments(tf(COLLAB_GROUP_FILTER)),
    User.countDocuments(tf({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE })),
    Project.countDocuments(tf({ status: PROJECT_STATUSES.ACTIVE })),
    Project.countDocuments(tf({ status: PROJECT_STATUSES.COMPLETED })),
    Project.countDocuments(tf({ status: PROJECT_STATUSES.ON_HOLD })),
    Publication.countDocuments(tf({ status: { $ne: PUBLICATION_STATUSES.DRAFT } })),
    Project.find(tf({ status: PROJECT_STATUSES.ACTIVE }))
      .sort({ updatedAt: -1 })
      .limit(DASHBOARD_ACTIVE_PROJECTS_LIMIT)
      .populate("researcherId", "fullName department")
      .select("title status endDate progressReports researcherId updatedAt"),
    Project.find(tf({})).select("researcherId").populate("researcherId", "fullName department"),
    Grant.find(tf({})).select("amountAwarded status createdAt decidedAt"),
    Budget.find(tf({})).select("items totalAllocated"),
    Publication.find(tf({})).select("title type year status createdAt updatedAt researcherId"),
    Proposal.find(
      tf({
        status: {
          $in: [
            PROPOSAL_STATUSES.SUBMITTED,
            PROPOSAL_STATUSES.UNDER_REVIEW,
            PROPOSAL_STATUSES.REVISION_REQUESTED,
            PROPOSAL_STATUSES.APPROVED,
            PROPOSAL_STATUSES.REJECTED,
          ],
        },
      })
    )
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate("researcherId", "fullName"),
    RepositoryItem.find(tf({})).sort({ createdAt: -1 }).limit(5).select("title type access createdAt"),
    ResearchGroup.find(tf(COLLAB_GROUP_FILTER)).sort({ createdAt: -1 }).limit(5).select("name members createdAt kind"),
  ]);

  const activeProjects = activeProjectCount;
  const completedProjects = completedProjectCount;
  const onHoldProjects = onHoldProjectCount;
  const totalProjects = projectCount || 0;
  const trackedProjects = activeProjects + completedProjects + onHoldProjects;
  const activePercent = totalProjects ? Math.round((activeProjects / totalProjects) * 100) : 0;

  const allBudgetItems = budgets.flatMap((b) => b.items || []);
  const awardedTotal = sumAwardedAmount(grants);
  const awardedGrantCount = grants.filter(isAwardedGrant).length;

  const pubsByType = {
    paper: publications.filter((p) => p.type === PUBLICATION_TYPES.PAPER).length,
    journal_article: publications.filter((p) => p.type === PUBLICATION_TYPES.JOURNAL).length,
    conference: publications.filter((p) => p.type === PUBLICATION_TYPES.CONFERENCE).length,
    book: publications.filter((p) => p.type === PUBLICATION_TYPES.BOOK).length,
    book_chapter: publications.filter((p) => p.type === PUBLICATION_TYPES.BOOK_CHAPTER).length,
    patent: publications.filter((p) => p.type === PUBLICATION_TYPES.PATENT).length,
    thesis: publications.filter((p) => p.type === PUBLICATION_TYPES.THESIS).length,
    review: publications.filter((p) => p.type === PUBLICATION_TYPES.REVIEW).length,
    case_study: publications.filter((p) => p.type === PUBLICATION_TYPES.CASE_STUDY).length,
    letter_to_editor: publications.filter((p) => p.type === PUBLICATION_TYPES.LETTER_TO_EDITOR).length,
    community_research_impact: publications.filter((p) => p.type === PUBLICATION_TYPES.COMMUNITY_IMPACT).length,
  };
  const recentActivity = [
    ...proposals.map((p) => ({
      type: "proposal",
      title: p.title,
      subtitle: p.status,
      at: p.updatedAt,
    })),
    ...repositoryItems.map((r) => ({
      type: "repository",
      title: r.title,
      subtitle: r.type,
      at: r.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  const activeProjectsTable = await mapProjectDashboardRows(dashboardActiveProjects, {
    tierFilter: tf({}),
    viewerRole: "research_director",
  });

  const grantSuccessRate = computeGrantSuccessRate(grants);

  const recentPublications = [...publications]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  const activeUsers = await User.find(tf({ status: USER_STATUSES.ACTIVE })).select("department role fullName");

  // Build a Department.name -> faculty lookup using stored faculty when valid,
  // otherwise inferring from the department name keywords.
  const allDepts = await Department.find(tf({})).select("name faculty");
  const deptToFaculty = {};
  allDepts.forEach((d) => {
    const stored = (d.faculty || "").trim();
    deptToFaculty[d.name] = stored && FACULTIES.includes(stored) ? stored : matchFacultyByName(d.name);
  });

  // Resolve any department string (from user/proposal/project) into one of the 6 faculties.
  // No "Unknown" — the matcher's DEFAULT_FACULTY fallback guarantees a faculty.
  function resolveFaculty(deptName) {
    if (!deptName) return matchFacultyByName("");
    if (deptToFaculty[deptName]) return deptToFaculty[deptName];
    return matchFacultyByName(deptName);
  }

  // Pre-seed all 6 faculties so every faculty row appears (even with zero counts).
  const facultyMap = {};
  FACULTIES.forEach((f) => {
    facultyMap[f] = { department: f, researchers: 0, publications: 0, proposals: 0, projects: 0 };
  });

  activeUsers.forEach((u) => {
    const faculty = resolveFaculty(u.department);
    if (u.role === ROLES.RESEARCHER) facultyMap[faculty].researchers += 1;
  });

  publications.forEach((pub) => {
    const u = activeUsers.find((x) => String(x._id) === String(pub.researcherId));
    const faculty = resolveFaculty(u?.department);
    facultyMap[faculty].publications += 1;
  });

  const allProposals = await Proposal.find(tf({})).select("department status assignedReviewers");
  allProposals.forEach((p) => {
    const faculty = resolveFaculty(p.department);
    facultyMap[faculty].proposals += 1;
  });

  allProjectsForFaculty.forEach((p) => {
    const faculty = resolveFaculty(p.researcherId?.department);
    facultyMap[faculty].projects += 1;
  });

  const facultyAnalytics = Object.values(facultyMap).sort((a, b) => b.publications - a.publications);

  const openFundingCalls = await FundingCall.countDocuments(tf({ status: CALL_STATUSES.OPEN }));
  const pendingFinanceGrants = grants.filter((g) => g.status === GRANT_STATUSES.PENDING_FINANCE).length;
  const projectsClosing = allProjectsForFaculty.filter((p) => p.status === PROJECT_STATUSES.CLOSING).length;
  const projectsClosed = allProjectsForFaculty.filter((p) => p.status === PROJECT_STATUSES.CLOSED).length;
  const approvedProposals = allProposals.filter((p) => p.status === PROPOSAL_STATUSES.APPROVED).length;
  const proposalApprovalRate = allProposals.length
    ? Math.round((approvedProposals / allProposals.length) * 100)
    : 0;

  // Proposals already sent to Leadership peer reviewers (active review queue only)
  const proposalsSentToReviewers = allProposals.filter(
    (p) =>
      Array.isArray(p.assignedReviewers) &&
      p.assignedReviewers.length > 0 &&
      ACTIVE_PEER_REVIEW_STATUSES.includes(p.status)
  ).length;

  const annualReport = {
    year: new Date().getFullYear(),
    overview: {
      proposals: proposalCount,
      projects: projectCount,
      grants: grantCount,
      publications: publicationCount,
      fundingSecured: awardedTotal,
    },
    grantSuccessRate,
    facultyCount: facultyAnalytics.length,
    topFacultyByPublications: facultyAnalytics.slice(0, 5),
    budgetUtilization: {
      pending: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PENDING).length,
      approved: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.APPROVED).length,
      paid: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID).length,
    },
  };

  const result = {
    generatedAt: new Date().toISOString(),
    overview: {
      proposals: proposalCount,
      projects: projectCount,
      grants: grantCount,
      budgets: budgetCount,
      publications: publicationCount,
      repository: repositoryCount,
      groups: collabGroupCount,
      ethics: ethicsCount,
      thesis: thesisCount,
      users: usersCount,
      departments: departmentsCount,
      modules: {
        users: usersCount,
        departments: departmentsCount,
        ethics: ethicsCount,
        proposals: proposalCount,
        projects: projectCount,
        grants: grantCount,
        budgets: budgetCount,
        publications: publicationCount,
        workflow: workflowPubCount,
        repository: repositoryCount,
        groups: collabGroupCount,
        thesis: thesisCount,
        reviews: proposalsSentToReviewers,
        fundingCalls: openFundingCalls,
        grantsPendingFinance: pendingFinanceGrants,
        messages: "—",
        notificationsUnread: 0,
      },
      fundingCalls: openFundingCalls,
    },
    projectStatus: {
      total: totalProjects,
      active: activeProjects,
      completed: completedProjects,
      onHold: onHoldProjects,
      tracked: trackedProjects,
      activePercent,
    },
    proposalsSentToReviewers,
    grantFunding: {
      activeFunds: awardedTotal,
      awardedGrantCount,
      trends: buildMonthlyGrantTrends(grants),
    },
    researchOutput: {
      publications: publicationCount,
      papers: pubsByType.paper,
      caseStudies: pubsByType.case_study,
      byType: pubsByType,
    },
    keyMetrics: {
      activeGrantsValue: awardedTotal,
      ongoingStudies: activeProjects,
      researchers: researcherCount,
      budgetItemsPending: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PENDING).length,
    },
    activeProjects: activeProjectsTable,
    recentActivity,
    publications: recentPublications.map((p) => ({
      id: p._id,
      title: p.title,
      type: p.type,
      year: p.year,
      status: p.status,
    })),
    repository: repositoryItems,
    groups: groups.map((g) => ({
      id: g._id,
      name: g.name,
      members: (g.members || []).length,
    })),
    budgets: {
      total: budgetCount,
      itemsPending: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PENDING).length,
      itemsApproved: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.APPROVED).length,
      itemsPaid: allBudgetItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID).length,
    },
    grantSuccessRate,
    kpiMetrics: {
      grantSuccessRate,
      proposalApprovalRate,
      openFundingCalls,
      pendingFinanceGrants,
      projectsClosing,
      projectsClosed,
      activeProjects: activeProjects,
    },
    facultyAnalytics,
    annualReport,
    preview: {
      activeProjects: { shown: activeProjectsTable.length, total: activeProjectCount, limit: DASHBOARD_ACTIVE_PROJECTS_LIMIT },
      recentActivity: { shown: recentActivity.length, limit: 5 },
      groups: { shown: groups.length, total: collabGroupCount, limit: 5 },
      publications: { shown: recentPublications.length, total: publicationCount, limit: 5 },
      repository: { shown: repositoryItems.length, total: repositoryCount, limit: 5 },
    },
    metricDefinitions: METRIC_DEFINITIONS,
  };
return result;
}

async function getInstitutionalAnalytics(req, res) {
  const notificationsUnread = await Notification.countDocuments(
    req.tierWhere({ userId: req.user.id, readAt: null })
  );
  const data = await buildInstitutionalAnalytics(req.programTier);
  data.overview.modules.notificationsUnread = notificationsUnread;
  data.keyMetrics.notificationsUnread = notificationsUnread;
res.json(data);
}

async function getFacultyReport(req, res) {
  const filter = req.tierWhere({});

  const [proposals, projects, publications, deptUsers] = await Promise.all([
    Proposal.find(filter).select("title status department researcherId createdAt updatedAt").populate("researcherId", "fullName department"),
    Project.find(req.tierWhere({})).populate("researcherId", "fullName department"),
    Publication.find(req.tierWhere({})).populate("researcherId", "fullName department"),
    User.find(req.tierWhere({ status: USER_STATUSES.ACTIVE })).select("fullName role department"),
  ]);

  const facultyProjects = projects;
  const facultyPublications = publications;
  const facultyUsers = deptUsers;

  res.json({
    department: "All faculties",
    faculty: "All faculties",
    scope: "portal",
    generatedAt: new Date().toISOString(),
    counts: {
      researchers: facultyUsers.filter((u) => u.role === ROLES.RESEARCHER).length,
      proposals: proposals.length,
      projects: facultyProjects.length,
      activeProjects: facultyProjects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE).length,
      publications: facultyPublications.length,
    },
    proposals: proposals.slice(0, 50).map((p) => ({
      id: p._id,
      title: p.title,
      status: p.status,
      author: p.researcherId?.fullName || "—",
      updatedAt: p.updatedAt,
    })),
    projects: (await mapProjectDashboardRows(
      facultyProjects
        .filter((p) => p.status === PROJECT_STATUSES.ACTIVE)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, DASHBOARD_ACTIVE_PROJECTS_LIMIT),
      { tierFilter: req.tierWhere({}), viewerRole: req.user.role }
    )).map((row) => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      status: row.status,
      pi: row.principalInvestigator,
      progressPercent: row.progressPercent,
    })),
    publications: facultyPublications.slice(0, 50).map((p) => ({
      id: p._id,
      title: p.title,
      type: p.type,
      year: p.year,
      author: p.researcherId?.fullName || "—",
      status: p.status,
    })),
  });
}

async function exportFacultyReportPdf(req, res) {
  const filter = req.tierWhere({});

  const [proposals, projects, publications, deptUsers] = await Promise.all([
    Proposal.find(filter).populate("researcherId", "fullName department"),
    Project.find(req.tierWhere({})).populate("researcherId", "fullName department"),
    Publication.find(req.tierWhere({})).populate("researcherId", "fullName department"),
    User.find(req.tierWhere({ status: USER_STATUSES.ACTIVE })).select("fullName role department"),
  ]);

  const facultyProjects = projects;
  const facultyPublications = publications;
  const facultyUsers = deptUsers;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="JUST-RMS-Faculty-Report-all-faculties.pdf"`
  );

  const doc = new PDFDocument({ size: "A4", margin: 54 });
  doc.pipe(res);

  doc.fontSize(20).text("Faculty Research Report — All faculties", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#444").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.2);

  doc.fontSize(14).text("Faculty overview", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(`Researchers: ${facultyUsers.filter((u) => u.role === ROLES.RESEARCHER).length}`);
  doc.text(`Proposals: ${proposals.length}`);
  doc.text(`Projects: ${facultyProjects.length}`);
  doc.text(`Publications: ${facultyPublications.length}`);
  doc.moveDown(0.8);

  doc.fontSize(14).text("Recent proposals", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11);
  proposals.slice(0, 10).forEach((p) => {
    doc.text(`• ${p.title} — ${p.status} (${p.researcherId?.fullName || "—"})`);
  });
  doc.moveDown(0.8);

  doc.fontSize(14).text("Active projects", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11);
  facultyProjects.slice(0, 10).forEach((p) => {
    doc.text(`• ${p.title} — ${p.status} (PI: ${p.researcherId?.fullName || "—"})`);
  });
  doc.moveDown(0.8);

  doc.fontSize(14).text("Publications", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11);
  facultyPublications.slice(0, 15).forEach((p) => {
    doc.text(`• ${p.title} — ${p.type} ${p.year || ""}`);
  });

  doc.end();
}

async function exportAnnualReportPdf(req, res) {
  const data = await buildInstitutionalAnalytics(req.programTier);
  const ar = data.annualReport;
  const year = ar.year || new Date().getFullYear();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="JUST-RMS-Annual-Report-${year}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 54 });
  doc.pipe(res);

  doc.fontSize(20).text(`Jamhuriya University — Annual Research Report ${year}`, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#444").text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.2);

  doc.fontSize(14).text("Institutional overview", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(`Proposals: ${ar.overview.proposals}`);
  doc.text(`Projects: ${ar.overview.projects}`);
  doc.text(`Grants: ${ar.overview.grants}`);
  doc.text(`Publications: ${ar.overview.publications}`);
  doc.text(`Funding secured: $${ar.overview.fundingSecured.toLocaleString()}`);
  doc.text(`Grant success rate: ${data.grantSuccessRate}%`);
  doc.moveDown(0.8);

  doc.fontSize(14).text("Research output", { underline: true });
  doc.moveDown(0.4);
  doc.text(`Active projects: ${data.projectStatus.active} / ${data.projectStatus.total}`);
  doc.moveDown(0.8);

  doc.fontSize(14).text("Publications per faculty (top 5)", { underline: true });
  doc.moveDown(0.4);
  (ar.topFacultyByPublications || []).forEach((f) => {
    doc.text(`${f.department}: ${f.publications} publications, ${f.researchers} researchers`);
  });
  doc.moveDown(0.8);

  doc.fontSize(14).text("Budget utilization", { underline: true });
  doc.moveDown(0.4);
  doc.text(`Pending: ${ar.budgetUtilization.pending}`);
  doc.text(`Approved: ${ar.budgetUtilization.approved}`);
  doc.text(`Paid: ${ar.budgetUtilization.paid}`);

  doc.end();
}

async function getFinanceReport(req, res) {
  const [budgets, grants, payments, purchaseOrders] = await Promise.all([
    Budget.find(req.tierWhere({})).select("title totalAllocated items grantId projectId currency"),
    Grant.find(req.tierWhere({})).select("title amountAwarded amountRequested status fundingSource"),
    Payment.find(req.tierWhere({})).select("amount status budgetId"),
    PurchaseOrder.find(req.tierWhere({})).select("totalAmount status budgetId"),
  ]);

  const allItems = budgets.flatMap((b) =>
    (b.items || []).map((i) => ({
      budgetTitle: b.title || `Budget ${String(b._id).slice(-6)}`,
      description: i.description,
      amount: i.amount,
      status: i.status,
      type: i.type,
    }))
  );

  const totalAllocated = budgets.reduce((a, b) => a + (b.totalAllocated || 0), 0);
  const paidBudgetItems = allItems
    .filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID)
    .reduce((a, i) => a + (i.amount || 0), 0);
  const paidPayments = payments
    .filter((p) => p.status === PAYMENT_STATUSES.PAID)
    .reduce((a, p) => a + (p.amount || 0), 0);
  const paidPOs = purchaseOrders
    .filter((p) => p.status === PO_STATUSES.PAID)
    .reduce((a, p) => a + (p.totalAmount || 0), 0);
  const disbursedStored = budgets.reduce((a, b) => a + Number(b.totalDisbursed || 0), 0);
  // Three spend channels are disjoint: payments, POs, and budget line items.
  // Also respect stored totalDisbursed when it is higher (post-deduction path).
  const totalPaid = Math.max(paidPayments + paidPOs + paidBudgetItems, disbursedStored);
res.json({
    generatedAt: new Date().toISOString(),
    summary: {
      budgets: budgets.length,
      totalAllocated,
      totalPaid,
      paidPayments,
      paidPurchaseOrders: paidPOs,
      paidBudgetItems,
      utilizationPercent: totalAllocated ? Math.round((totalPaid / totalAllocated) * 100) : 0,
      activeGrants: grants.filter(isAwardedGrant).length,
      awardedTotal: sumAwardedAmount(grants),
      pendingPayments: payments.filter((p) =>
        [PAYMENT_STATUSES.REQUESTED, PAYMENT_STATUSES.DIRECTOR_APPROVED].includes(p.status)
      ).length,
      pendingPurchaseOrders: purchaseOrders.filter((p) =>
        [PO_STATUSES.REQUESTED, PO_STATUSES.PROCUREMENT_APPROVED, PO_STATUSES.DIRECTOR_APPROVED].includes(p.status)
      ).length,
    },
    grantSummary: grants.map((g) => ({
      title: g.title,
      fundingSource: g.fundingSource,
      status: g.status,
      amountRequested: g.amountRequested,
      amountAwarded: g.amountAwarded,
    })),
    budgetItems: allItems.slice(0, 100),
  });
}

async function getResearchJourney(req, res) {
  const { role, id: userId } = req.user;
  const { researcherId: researcherIdQuery } = req.query || {};
  const tierFilter = req.tierWhere({});

  const isStaff = ["research_director", "faculty_coordinator"].includes(role);

  if (!researcherIdQuery) {
    if (role === "researcher") {
      const journey = await buildResearchJourneyForResearcher(userId, tierFilter, role);
      if (!journey) throw new AppError("Researcher not found", 404);
      return res.json({ mode: "journey", ...journey });
    }
    if (!isStaff) throw new AppError("Forbidden", 403);
    const researchers = await listResearchersForJourney(tierFilter, undefined);
    return res.json({ mode: "picker", researchers });
  }

  if (role === "researcher" && String(researcherIdQuery) !== String(userId)) {
    throw new AppError("Forbidden", 403);
  }

  const journey = await buildResearchJourneyForResearcher(researcherIdQuery, tierFilter, role);
  if (!journey) throw new AppError("Researcher not found", 404);

  res.json({ mode: "journey", ...journey });
}

/** Institutional ops board: counts + sample items for each major lifecycle stage. */
async function getWorkflowOverview(req, res) {
  const role = req.user?.role;
  if (!["research_director", "faculty_coordinator", "researcher"].includes(role)) {
    throw new AppError("Forbidden", 403);
  }

  const tf = (extra = {}) =>
    role === "researcher" ? req.ownedWhere(extra) : req.tierWhere(extra);
  const researcherOnly = role === "researcher";
  const dept = "";
  const deptNames = dept ? await departmentNamesForCoordinatorScope(dept, Department) : null;
  const deptClause = mongoDepartmentInFaculty(deptNames);

  const proposalFilter = tf(deptClause || {});
  const projectFilter = tf(deptClause || {});
  const ethicsFilter = tf({});
  const grantFilter = tf({});
  const pubFilter = tf({});
  const thesisFilter =
    role === "researcher"
      ? {
          $or: [
            { supervisorId: req.user.id },
            { createdBy: req.user.id },
            { coordinatorId: req.user.id },
          ],
        }
      : tf({});

  const [proposalsRaw, projectsRaw, ethicsAppsRaw, grantsRaw, publicationsRaw, thesisGroupsRaw, fundingCalls] =
    await Promise.all([
      Proposal.find(proposalFilter)
        .select("title status ethicsStatus department researcherId updatedAt")
        .populate("researcherId", "department")
        .sort({ updatedAt: -1 })
        .limit(400)
        .lean(),
      Project.find(projectFilter)
        .select("title status department researcherId proposalId updatedAt")
        .populate("researcherId", "department")
        .sort({ updatedAt: -1 })
        .limit(400)
        .lean(),
      EthicsApplication.find(ethicsFilter)
        .select("projectTitle status updatedAt principal researcherId")
        .populate("researcherId", "department")
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean(),
      Grant.find(grantFilter)
        .select("title status amountAwarded amountRequested researcherId updatedAt")
        .populate("researcherId", "department")
        .sort({ updatedAt: -1 })
        .limit(300)
        .lean(),
      Publication.find(pubFilter)
        .select("title status workflowStage projectId researcherId updatedAt")
        .populate("researcherId", "department")
        .sort({ updatedAt: -1 })
        .limit(300)
        .lean(),
      ThesisGroup.find(thesisFilter)
        .select("title status titleProposal chapters supervisorId department faculty updatedAt")
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean(),
      FundingCall.find(tf({})).select("title status updatedAt").lean(),
    ]);

  // Belt-and-suspenders: faculty match on department OR researcher department
  const proposals =
    role === "faculty_coordinator" && dept
      ? proposalsRaw.filter((p) =>
          coordinatorMatchesResearcherDept(dept, p.department || p.researcherId?.department)
        )
      : proposalsRaw;
  const projects =
    role === "faculty_coordinator" && dept
      ? projectsRaw.filter((p) =>
          coordinatorMatchesResearcherDept(dept, p.department || p.researcherId?.department)
        )
      : projectsRaw;
  const ethicsApps =
    role === "faculty_coordinator" && dept
      ? ethicsAppsRaw.filter((e) =>
          coordinatorMatchesResearcherDept(
            dept,
            e.principal?.department || e.researcherId?.department || ""
          )
        )
      : ethicsAppsRaw;
  const grants =
    role === "faculty_coordinator" && dept
      ? grantsRaw.filter((g) =>
          coordinatorMatchesResearcherDept(dept, g.researcherId?.department || "")
        )
      : grantsRaw;
  const publications =
    role === "faculty_coordinator" && dept
      ? publicationsRaw.filter((p) =>
          coordinatorMatchesResearcherDept(dept, p.researcherId?.department || "")
        )
      : publicationsRaw;
  const thesisGroups =
    role === "faculty_coordinator" && dept
      ? thesisGroupsRaw.filter((t) =>
          coordinatorMatchesResearcherDept(dept, t.department || t.faculty || "")
        )
      : thesisGroupsRaw;

  const sample = (items, mapFn, n = 5) => items.slice(0, n).map(mapFn);

  const stages = [
    {
      key: "proposals_draft",
      label: "Proposals — draft",
      link: "/proposals",
      count: proposals.filter((p) => p.status === PROPOSAL_STATUSES.DRAFT).length,
      items: sample(
        proposals.filter((p) => p.status === PROPOSAL_STATUSES.DRAFT),
        (p) => ({ id: String(p._id), title: p.title, link: `/proposals/${p._id}`, status: p.status })
      ),
    },
    {
      key: "proposals_review",
      label: "Proposals — under review / submitted",
      link: "/proposals",
      count: proposals.filter((p) =>
        [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(
          p.status
        )
      ).length,
      items: sample(
        proposals.filter((p) =>
          [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(
            p.status
          )
        ),
        (p) => ({
          id: String(p._id),
          title: p.title,
          link: `/proposals/${p._id}/review`,
          status: p.status,
        })
      ),
    },
    {
      key: "ethics_queue",
      label: "Ethics (REC) — submitted",
      link: "/ethics",
      count: ethicsApps.filter((e) => String(e.status).toLowerCase() === "submitted").length,
      items: sample(
        ethicsApps.filter((e) => String(e.status).toLowerCase() === "submitted"),
        (e) => ({
          id: String(e._id),
          title: e.projectTitle || "Ethics application",
          link: `/ethics?applicationId=${e._id}`,
          status: e.status,
        })
      ),
    },
    {
      key: "projects_active",
      label: "Projects — active",
      link: "/projects",
      count: projects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE).length,
      items: sample(
        projects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE),
        (p) => ({
          id: String(p._id),
          title: p.title,
          link: `/projects/${p._id}`,
          status: p.status,
        })
      ),
    },
    {
      key: "funding_calls",
      label: "Funding calls — open",
      link: "/funding-calls",
      count: fundingCalls.filter((c) => c.status === CALL_STATUSES.OPEN).length,
      items: sample(
        fundingCalls.filter((c) => c.status === CALL_STATUSES.OPEN),
        (c) => ({ id: String(c._id), title: c.title, link: "/funding-calls", status: c.status })
      ),
    },
    {
      key: "grants_pending",
      label: "Grants — draft / submitted",
      link: "/grants",
      count: grants.filter((g) =>
        [GRANT_STATUSES.DRAFT, GRANT_STATUSES.SUBMITTED, GRANT_STATUSES.PENDING_FINANCE].includes(g.status)
      ).length,
      items: sample(
        grants.filter((g) =>
          [GRANT_STATUSES.DRAFT, GRANT_STATUSES.SUBMITTED, GRANT_STATUSES.PENDING_FINANCE].includes(g.status)
        ),
        (g) => ({ id: String(g._id), title: g.title, link: `/grants/${g._id}`, status: g.status })
      ),
    },
    {
      key: "publications_pipeline",
      label: "Publications — in workflow",
      link: "/research-workflow?tab=publications",
      count: publications.filter((p) => p.status !== PUBLICATION_STATUSES.DRAFT).length,
      items: sample(
        publications.filter((p) => p.status !== PUBLICATION_STATUSES.DRAFT),
        (p) => ({
          id: String(p._id),
          title: p.title,
          link: p.projectId ? `/projects/${p.projectId}` : "/publications",
          status: p.workflowStage || p.status,
        })
      ),
    },
    {
      key: "thesis_titles",
      label: "Thesis — recent title updates",
      link: "/thesis",
      count: thesisGroups.filter((t) => Boolean(t.title?.trim() || t.titleProposal?.title?.trim())).length,
      items: sample(
        thesisGroups.filter((t) => Boolean(t.title?.trim() || t.titleProposal?.title?.trim())),
        (t) => ({
          id: String(t._id),
          title: t.titleProposal?.title || t.title || "Thesis group",
          link: `/thesis?groupId=${t._id}`,
          status: t.status,
        })
      ),
    },
  ];

  res.json({
    generatedAt: new Date().toISOString(),
    programTier: req.programTier || null,
    scope: researcherOnly ? "mine" : dept ? `faculty:${dept}` : req.programTier ? "portal" : "all",
    totals: {
      proposals: proposals.length,
      projects: projects.length,
      ethics: ethicsApps.length,
      grants: grants.length,
      publications: publications.length,
      thesisGroups: thesisGroups.length,
      fundingCalls: fundingCalls.length,
    },
    stages,
  });
}

/** Live system data pack for Director / Coordinator / Finance. */
async function getSystemReport(req, res) {
  const role = req.user?.role;
  if (!["research_director", "faculty_coordinator", "finance_officer", "leadership"].includes(role)) {
    throw new AppError("Forbidden", 403);
  }

  const isDirector = role === ROLES.RESEARCH_DIRECTOR;
  const tf = (extra = {}) => (isDirector ? extra : req.tierWhere(extra));
  const dept = "";
  const deptNames = null;
  const deptClause = mongoDepartmentInFaculty(deptNames);

  const proposalQ = tf(deptClause || {});
  const projectQ = tf(deptClause || {});

  const [
    proposalsRaw,
    projectsRaw,
    ethicsAppsRaw,
    grantsRaw,
    budgetsRaw,
    paymentsRaw,
    purchaseOrdersRaw,
    publicationsRaw,
    thesisGroupsRaw,
    fundingCalls,
    users,
    repositoryItemsRaw,
    policies,
  ] = await Promise.all([
    Proposal.find(proposalQ).select("status ethicsStatus department researcherId").populate("researcherId", "department").lean(),
    Project.find(projectQ).select("status department kind researcherId").populate("researcherId", "department").lean(),
    EthicsApplication.find(tf({})).select("status principal researcherId").populate("researcherId", "department").lean(),
    Grant.find(tf({})).select("status amountAwarded amountRequested researcherId").populate("researcherId", "department").lean(),
    Budget.find(tf({})).select("totalAllocated totalDisbursed status ownerResearcherId").populate("ownerResearcherId", "department").lean(),
    Payment.find(tf({})).select("amount status projectId").populate({ path: "projectId", select: "department researcherId", populate: { path: "researcherId", select: "department" } }).lean(),
    PurchaseOrder.find(tf({})).select("totalAmount status projectId").populate({ path: "projectId", select: "department researcherId", populate: { path: "researcherId", select: "department" } }).lean(),
    Publication.find(tf({})).select("status workflowStage type researcherId").populate("researcherId", "department").lean(),
    ThesisGroup.find(tf({})).select("status titleProposal chapters department faculty").lean(),
    FundingCall.find(tf({})).select("status").lean(),
    isDirector
      ? User.find({ role: { $ne: ROLES.RESEARCH_DIRECTOR } }).select("role status programTier").lean()
      : Promise.resolve([]),
    RepositoryItem.find(tf({})).select("title uploadedBy").populate("uploadedBy", "department").lean(),
    InstitutionalPolicy.find(isDirector ? {} : tf({})).select("status category").lean(),
  ]);

  const inFaculty = (researcherDept, fallbackDept = "") =>
    !dept || coordinatorMatchesResearcherDept(dept, researcherDept || fallbackDept || "");

  const proposals =
    role === "faculty_coordinator" && dept
      ? proposalsRaw.filter((p) => inFaculty(p.department || p.researcherId?.department))
      : proposalsRaw;
  const projects =
    role === "faculty_coordinator" && dept
      ? projectsRaw.filter((p) => inFaculty(p.department || p.researcherId?.department))
      : projectsRaw;
  const ethicsApps =
    role === "faculty_coordinator" && dept
      ? ethicsAppsRaw.filter((e) => inFaculty(e.principal?.department || e.researcherId?.department))
      : ethicsAppsRaw;
  const grants =
    role === "faculty_coordinator" && dept
      ? grantsRaw.filter((g) => inFaculty(g.researcherId?.department))
      : grantsRaw;
  const publications =
    role === "faculty_coordinator" && dept
      ? publicationsRaw.filter((p) => inFaculty(p.researcherId?.department))
      : publicationsRaw;
  const thesisGroups =
    role === "faculty_coordinator" && dept
      ? thesisGroupsRaw.filter((t) => inFaculty(t.department || t.faculty))
      : thesisGroupsRaw;
  const budgets =
    role === "faculty_coordinator" && dept
      ? budgetsRaw.filter((b) => inFaculty(b.ownerResearcherId?.department))
      : budgetsRaw;
  const payments =
    role === "faculty_coordinator" && dept
      ? paymentsRaw.filter((p) =>
          inFaculty(p.projectId?.department || p.projectId?.researcherId?.department)
        )
      : paymentsRaw;
  const purchaseOrders =
    role === "faculty_coordinator" && dept
      ? purchaseOrdersRaw.filter((po) =>
          inFaculty(po.projectId?.department || po.projectId?.researcherId?.department)
        )
      : purchaseOrdersRaw;

  const { REPOSITORY_ITEMS } = require("../scripts/seedRecords");
  const seedRepoTitles = new Set(
    REPOSITORY_ITEMS.map((r) =>
      String(r.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    )
  );
  const repositoryItems =
    role === "faculty_coordinator" && dept
      ? repositoryItemsRaw.filter((item) => inFaculty(item.uploadedBy?.department))
      : repositoryItemsRaw;
  const visibleRepository = repositoryItems.filter((item) => {
    const key = String(item.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return !seedRepoTitles.has(key);
  });

  const paidPayments = payments.filter((p) => p.status === PAYMENT_STATUSES.PAID || p.status === "paid");
  const allocated = sum(budgets.map((b) => Number(b.totalAllocated ?? 0)));
  const spent = sum(budgets.map((b) => Number(b.totalDisbursed || 0)));
  const paid = sum(paidPayments.map((p) => Number(p.amount || 0)));

  const report = {
    generatedAt: new Date().toISOString(),
    programTier: isDirector ? null : req.programTier || null,
    scope: isDirector ? "all_programs" : dept ? `faculty:${dept}` : req.programTier ? "portal" : "all",
    users:
      isDirector
        ? {
            total: users.length,
            byRole: countByField(users, "role"),
            byStatus: countByField(users, "status"),
            byProgramTier: countByField(
              users.filter((u) => u.role === ROLES.RESEARCHER),
              "programTier"
            ),
          }
        : undefined,
    proposals: {
      total: proposals.length,
      byStatus: countByField(proposals, "status"),
    },
    ethics: {
      total: ethicsApps.length,
      byStatus: countByField(ethicsApps, "status"),
    },
    projects: {
      total: projects.length,
      byStatus: countByField(projects, "status"),
    },
    fundingCalls: {
      total: fundingCalls.length,
      byStatus: countByField(fundingCalls, "status"),
    },
    grants: {
      total: grants.length,
      byStatus: countByField(grants, "status"),
      totalAwarded: sum(grants.map((g) => Number(g.amountAwarded || 0))),
      totalRequested: sum(grants.map((g) => Number(g.amountRequested || 0))),
    },
    finance: {
      budgets: budgets.length,
      allocated,
      spent,
      paid,
      utilizationPercent: allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : 0,
      payments: payments.length,
      purchaseOrders: purchaseOrders.length,
      poByStatus: countByField(purchaseOrders, "status"),
    },
    publications: {
      total: publications.length,
      byStatus: countByField(publications, "status"),
      byWorkflowStage: countByField(publications, "workflowStage"),
    },
    thesis: {
      total: thesisGroups.length,
      byStatus: countByField(thesisGroups, "status"),
      titlesPending: 0,
      chaptersPending: 0,
    },
    repository: {
      total: visibleRepository.length,
    },
    policies: {
      total: policies.length,
      byStatus: countByField(policies, "status"),
      byCategory: countByField(policies, "category"),
    },
  };

  if (String(req.query.format || "").toLowerCase() === "csv") {
    const lines = ["section,key,value"];
    const push = (section, key, value) => {
      lines.push(`"${section}","${key}","${value}"`);
    };
    push("meta", "generatedAt", report.generatedAt);
    push("meta", "programTier", report.programTier || "");
    push("proposals", "total", report.proposals.total);
    Object.entries(report.proposals.byStatus).forEach(([k, v]) => push("proposals", k, v));
    push("ethics", "total", report.ethics.total);
    Object.entries(report.ethics.byStatus).forEach(([k, v]) => push("ethics", k, v));
    push("projects", "total", report.projects.total);
    Object.entries(report.projects.byStatus).forEach(([k, v]) => push("projects", k, v));
    push("grants", "total", report.grants.total);
    push("grants", "totalAwarded", report.grants.totalAwarded);
    Object.entries(report.grants.byStatus).forEach(([k, v]) => push("grants", k, v));
    push("finance", "allocated", report.finance.allocated);
    push("finance", "spent", report.finance.spent);
    push("finance", "paid", report.finance.paid);
    push("finance", "utilizationPercent", report.finance.utilizationPercent);
    push("publications", "total", report.publications.total);
    push("thesis", "total", report.thesis.total);
    push("thesis", "titlesPending", report.thesis.titlesPending);
    push("repository", "total", report.repository.total);
    push("policies", "total", report.policies?.total ?? 0);
    if (report.policies?.byStatus) {
      Object.entries(report.policies.byStatus).forEach(([k, v]) => push("policies", k, v));
    }
    if (report.users) {
      push("users", "total", report.users.total);
      Object.entries(report.users.byRole).forEach(([k, v]) => push("users_role", k, v));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="just-rms-system-report.csv"');
    return res.send(lines.join("\n"));
  }

  res.json(report);
}

async function getDonorReport(req, res) {
  const [grants, calls] = await Promise.all([
    Grant.find(req.tierWhere({ callId: { $ne: null, $exists: true } })).select(
      "title donorRef fundingSource amountAwarded amountRequested status"
    ),
    FundingCall.find(req.tierWhere({})).select("title donorRef fundingSource amountCap status"),
  ]);

  const byDonor = {};
  for (const g of grants) {
    const key = (g.donorRef || g.fundingSource || "Unspecified").trim();
    if (!byDonor[key]) {
      byDonor[key] = { donorRef: key, grantCount: 0, totalAwarded: 0, totalRequested: 0, grants: [] };
    }
    byDonor[key].grantCount += 1;
    byDonor[key].totalAwarded += g.amountAwarded || 0;
    byDonor[key].totalRequested += g.amountRequested || 0;
    byDonor[key].grants.push({
      title: g.title,
      status: g.status,
      amountAwarded: g.amountAwarded,
      amountRequested: g.amountRequested,
    });
  }

  const donors = Object.values(byDonor).sort((a, b) => b.totalAwarded - a.totalAwarded);
  const totals = {
    awarded: donors.reduce((sum, d) => sum + d.totalAwarded, 0),
    requested: donors.reduce((sum, d) => sum + d.totalRequested, 0),
    openCalls: calls.filter((c) => c.status === CALL_STATUSES.OPEN).length,
  };

  res.json({
    generatedAt: new Date().toISOString(),
    totals,
    donors,
    fundingCalls: calls.map((c) => ({
      id: c._id,
      title: c.title,
      callType: c.callType || "internal",
      donorRef: c.donorRef,
      fundingSource: c.fundingSource,
      amountCap: c.amountCap,
      status: c.status,
    })),
  });
}

async function getKpiDashboard(req, res) {
  const tier = req.programTier;
  const tf = (base = {}) => (tier ? { ...base, programTier: tier } : { ...base });
  const dept = "";

  const [proposalsRaw, grantsRaw, projectsRaw, publicationsRaw, calls, closedProjectsRaw] = await Promise.all([
    Proposal.find(tf({})).select("status createdAt submittedAt department researcherId").populate("researcherId", "department"),
    Grant.find(tf({})).select("status amountAwarded amountRequested createdAt researcherId").populate("researcherId", "department"),
    Project.find(tf({})).select("status closure department researcherId").populate("researcherId", "department"),
    Publication.find(tf({})).select("status type researcherId").populate("researcherId", "department"),
    FundingCall.find(tf({})).select("status callType amountCap"),
    Project.find(tf({ "closure.status": "archived" }))
      .select("department researcherId")
      .populate("researcherId", "department"),
  ]);

  const inFac = (researcherDept, fallback = "") =>
    recordInCoordinatorFaculty(dept, researcherDept, fallback);

  const proposals =
    dept
      ? proposalsRaw.filter((p) => inFac(p.department || p.researcherId?.department))
      : proposalsRaw;
  const grants =
    dept
      ? grantsRaw.filter((g) => inFac(g.researcherId?.department))
      : grantsRaw;
  const projects =
    dept
      ? projectsRaw.filter((p) => inFac(p.department || p.researcherId?.department))
      : projectsRaw;
  const publications =
    dept
      ? publicationsRaw.filter((p) => inFac(p.researcherId?.department))
      : publicationsRaw;
  const closedProjects = dept
    ? closedProjectsRaw.filter((p) => inFac(p.department || p.researcherId?.department)).length
    : closedProjectsRaw.length;

  const proposalApproved = proposals.filter((p) => p.status === PROPOSAL_STATUSES.APPROVED).length;
  const proposalDecided = proposals.filter((p) =>
    [PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.REJECTED].includes(p.status)
  ).length;
  const proposalApprovalRate = proposalDecided ? Math.round((proposalApproved / proposalDecided) * 100) : 0;

  const grantSuccessRate = computeGrantSuccessRate(grants);
  const totalAwarded = sumAwardedAmount(grants);
  const totalRequested = grants.reduce((s, g) => s + Number(g.amountRequested || 0), 0);
  const activeProjects = projects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE).length;
  const validatedPubs = publications.filter((p) => p.status === PUBLICATION_STATUSES.VALIDATED).length;
  const openCalls = calls.filter((c) => c.status === CALL_STATUSES.OPEN).length;
  const internalCalls = calls.filter((c) => (c.callType || "internal") === "internal").length;
  const externalCalls = calls.filter((c) => c.callType === "external").length;

  let researchersActive = await User.countDocuments(tf({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE }));
  if (dept) {
    const researchers = await User.find(tf({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE })).select(
      "department"
    );
    researchersActive = researchers.filter((u) => inFac(u.department)).length;
  }

  res.json({
    generatedAt: new Date().toISOString(),
    programTier: tier,
    scope: dept ? `faculty:${dept}` : tier ? "portal" : "all",
    kpis: {
      proposalApprovalRate,
      grantSuccessRate,
      totalFundingAwarded: totalAwarded,
      totalFundingRequested: totalRequested,
      activeProjects,
      projectsArchived: closedProjects,
      publicationsValidated: validatedPubs,
      openFundingCalls: openCalls,
      internalFundingCalls: internalCalls,
      externalFundingCalls: externalCalls,
      researchersActive,
    },
  });
}

module.exports = {
  getDashboardMetrics,
  buildInstitutionalAnalytics,
  getInstitutionalAnalytics,
  getKpiDashboard,
  exportAnnualReportPdf,
  getFinanceReport,
  getDonorReport,
  getFacultyReport,
  exportFacultyReportPdf,
  getResearchJourney,
  getWorkflowOverview,
  getSystemReport,
};

