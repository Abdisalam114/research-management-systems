const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
// GRANT_STATUSES used in finance report
const { Budget, BUDGET_ITEM_STATUSES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES, PUBLICATION_TYPES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { ResearchGroup, GROUP_KINDS } = require("../models/ResearchGroup");
const { User, USER_STATUSES, ROLES } = require("../models/User");
const { Department } = require("../models/Department");
const { EthicsApplication } = require("../models/EthicsApplication");
const { ThesisGroup } = require("../models/ThesisGroup");
const { ResearchPolicy } = require("../models/ResearchPolicy");
const { Notification } = require("../models/Notification");
const { FACULTIES, matchFacultyByName } = require("../utils/facultyMatcher");
const PDFDocument = require("pdfkit");

function sum(nums) {
  return (nums || []).reduce((acc, n) => acc + (typeof n === "number" ? n : 0), 0);
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
    publications: { total: 0, validated: 0, submitted: 0, citationTotal: 0 },
    repository: { total: 0 },
    groups: { total: 0 },
  };

  const isStaffAll = ["research_director", "faculty_coordinator"].includes(role);

  const proposalFilter = role === "researcher" ? { researcherId: userId } : {};
  const projectFilter = role === "researcher" ? { researcherId: userId } : {};
  const grantFilter = role === "researcher" ? { researcherId: userId } : {};
  const pubFilter = role === "researcher" ? { researcherId: userId } : {};
  const repoFilter = role === "researcher" ? { uploadedBy: userId } : {};
  const budgetFilter =
    role === "researcher" ? { ownerResearcherId: userId } : role === "finance_officer" ? {} : isStaffAll ? {} : {};

  const [proposalCount, projectCount, grants, budgets, pubs, repoCount, collabGroupCount, ethicsCount, thesisCount, notifUnread] =
    await Promise.all([
      Proposal.countDocuments(proposalFilter),
      Project.countDocuments(projectFilter),
      Grant.find(grantFilter).select("amountAwarded status"),
      Budget.find(budgetFilter).select("items"),
      Publication.find(pubFilter).select("status citationCount"),
      RepositoryItem.countDocuments(repoFilter),
      ResearchGroup.countDocuments(
        role === "researcher"
          ? { "members.userId": userId, $or: [{ kind: GROUP_KINDS.COLLABORATION }, { kind: { $exists: false } }] }
          : { $or: [{ kind: GROUP_KINDS.COLLABORATION }, { kind: { $exists: false } }] }
      ),
      EthicsApplication.countDocuments(role === "researcher" ? { researcherId: userId } : {}),
      ThesisGroup.countDocuments(
        role === "researcher"
          ? { $or: [{ supervisorId: userId }, { createdBy: userId }, { coordinatorId: userId }] }
          : {}
      ),
      Notification.countDocuments({ userId, readAt: null }),
    ]);

  let usersCount = 0;
  let departmentsCount = 0;
  let policiesCount = 0;
  if (role === "research_director") {
    [usersCount, departmentsCount, policiesCount] = await Promise.all([
      User.countDocuments({ status: USER_STATUSES.ACTIVE }),
      Department.countDocuments({}),
      ResearchPolicy.countDocuments({}),
    ]);
  }

  base.proposals.total = proposalCount;
  base.projects.total = projectCount;
  base.grants.total = grants.length;
  base.grants.awardedTotal = sum(grants.map((g) => (g.status === "active" ? g.amountAwarded : 0)));

  base.budgets.total = budgets.length;
  const allItems = budgets.flatMap((b) => b.items || []);
  base.budgets.itemsPending = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PENDING).length;
  base.budgets.itemsApproved = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.APPROVED).length;
  base.budgets.itemsPaid = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID).length;

  base.publications.total = pubs.length;
  base.publications.validated = pubs.filter((p) => p.status === PUBLICATION_STATUSES.VALIDATED).length;
  base.publications.submitted = pubs.filter((p) => p.status === PUBLICATION_STATUSES.SUBMITTED).length;
  base.publications.citationTotal = sum(pubs.map((p) => p.citationCount || 0));

  base.repository.total = repoCount;
  base.groups.total = collabGroupCount;
  base.ethics = { total: ethicsCount };
  base.thesis = { total: thesisCount };
  base.notifications = { unread: notifUnread };
  base.modules = {
    users: usersCount,
    departments: departmentsCount,
    policies: policiesCount,
    ethics: ethicsCount,
    proposals: proposalCount,
    projects: projectCount,
    grants: grants.length,
    budgets: budgets.length,
    publications: pubs.length,
    repository: repoCount,
    groups: collabGroupCount,
    thesis: thesisCount,
    messages: "—",
    notificationsUnread: notifUnread,
  };

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    const logLine = `${JSON.stringify({
      sessionId: "6113cc",
      location: "analyticsController.js:getDashboardMetrics",
      message: "dashboard metrics modules",
      data: { role, moduleKeys: Object.keys(base.modules), modules: base.modules },
      timestamp: Date.now(),
      hypothesisId: "A",
      runId: "post-fix",
    })}\n`;
    fs.appendFileSync(path.join(__dirname, "../../../debug-6113cc.log"), logLine);
  } catch (_) {}
  // #endregion

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
    if (idx >= 0 && g.status === GRANT_STATUSES.ACTIVE) buckets[idx].amount += g.amountAwarded || 0;
  });

  return buckets.map(({ month, amount }) => ({ month, amount }));
}

async function buildInstitutionalAnalytics() {
  const [
    proposalCount,
    projectCount,
    grantCount,
    budgetCount,
    publicationCount,
    repositoryCount,
    groupCount,
    ethicsCount,
    thesisCount,
    usersCount,
    departmentsCount,
    policiesCount,
    collabGroupCount,
    researcherCount,
    projects,
    grants,
    budgets,
    publications,
    proposals,
    repositoryItems,
    groups,
  ] = await Promise.all([
    Proposal.countDocuments({}),
    Project.countDocuments({}),
    Grant.countDocuments({}),
    Budget.countDocuments({}),
    Publication.countDocuments({}),
    RepositoryItem.countDocuments({}),
    ResearchGroup.countDocuments({}),
    EthicsApplication.countDocuments({}),
    ThesisGroup.countDocuments({}),
    User.countDocuments({ status: USER_STATUSES.ACTIVE }),
    Department.countDocuments({}),
    ResearchPolicy.countDocuments({}),
    ResearchGroup.countDocuments({ $or: [{ kind: GROUP_KINDS.COLLABORATION }, { kind: { $exists: false } }] }),
    User.countDocuments({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE }),
    Project.find({}).sort({ updatedAt: -1 }).limit(5).populate("researcherId", "fullName department"),
    Grant.find({}).select("amountAwarded status createdAt decidedAt"),
    Budget.find({}).select("items totalAllocated"),
    Publication.find({}).select("title type year status citationCount doi createdAt researcherId"),
    Proposal.find({ status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.APPROVED] } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("researcherId", "fullName"),
    RepositoryItem.find({}).sort({ createdAt: -1 }).limit(5).select("title type access createdAt"),
    ResearchGroup.find({}).sort({ createdAt: -1 }).limit(5).select("name members createdAt"),
  ]);

  const activeProjects = projects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE).length;
  const completedProjects = projects.filter((p) => p.status === PROJECT_STATUSES.COMPLETED).length;
  const totalProjects = projectCount || 0;
  const activePercent = totalProjects ? Math.round((activeProjects / totalProjects) * 100) : 0;

  const allBudgetItems = budgets.flatMap((b) => b.items || []);
  const awardedTotal = grants.filter((g) => g.status === GRANT_STATUSES.ACTIVE).reduce((a, g) => a + (g.amountAwarded || 0), 0);

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
  };
  const citationTotal = publications.reduce((a, p) => a + (p.citationCount || 0), 0);

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

  const activeProjectsTable = projects.map((p, idx) => {
    const latest = (p.progressReports || [])[0];
    const progressPercent = latest?.progressPercent ?? (p.status === PROJECT_STATUSES.COMPLETED ? 100 : p.status === PROJECT_STATUSES.ACTIVE ? 50 : 0);
    return {
      id: String(p._id).slice(-4).padStart(4, "0"),
      title: p.title,
      principalInvestigator: p.researcherId?.fullName || "—",
      progressPercent,
      endDate: p.endDate,
      status: p.status,
    };
  });

  const grantDecided = grants.filter((g) => ["approved", "rejected", "active", "closed"].includes(g.status)).length;
  const grantWon = grants.filter((g) => ["approved", "active", "closed"].includes(g.status)).length;
  const grantSuccessRate = grantDecided ? Math.round((grantWon / grantDecided) * 100) : 0;

  const activeUsers = await User.find({ status: USER_STATUSES.ACTIVE }).select("department role fullName");

  // Build a Department.name -> faculty lookup using stored faculty when valid,
  // otherwise inferring from the department name keywords.
  const allDepts = await Department.find({}).select("name faculty");
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
    facultyMap[f] = { department: f, researchers: 0, publications: 0, citations: 0, proposals: 0, projects: 0 };
  });

  activeUsers.forEach((u) => {
    const faculty = resolveFaculty(u.department);
    if (u.role === ROLES.RESEARCHER) facultyMap[faculty].researchers += 1;
  });

  publications.forEach((pub) => {
    const u = activeUsers.find((x) => String(x._id) === String(pub.researcherId));
    const faculty = resolveFaculty(u?.department);
    facultyMap[faculty].publications += 1;
    facultyMap[faculty].citations += pub.citationCount || 0;
  });

  const allProposals = await Proposal.find({}).select("department status");
  allProposals.forEach((p) => {
    const faculty = resolveFaculty(p.department);
    facultyMap[faculty].proposals += 1;
  });

  projects.forEach((p) => {
    const faculty = resolveFaculty(p.researcherId?.department);
    facultyMap[faculty].projects += 1;
  });

  const facultyAnalytics = Object.values(facultyMap).sort((a, b) => b.publications - a.publications);

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

  return {
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
      policies: policiesCount,
      modules: {
        users: usersCount,
        departments: departmentsCount,
        policies: policiesCount,
        ethics: ethicsCount,
        proposals: proposalCount,
        projects: projectCount,
        grants: grantCount,
        budgets: budgetCount,
        publications: publicationCount,
        repository: repositoryCount,
        groups: collabGroupCount,
        thesis: thesisCount,
        messages: "—",
        notificationsUnread: 0,
      },
    },
    projectStatus: {
      total: totalProjects,
      active: activeProjects,
      completed: completedProjects,
      activePercent,
    },
    grantFunding: {
      activeFunds: awardedTotal,
      trends: buildMonthlyGrantTrends(grants),
    },
    researchOutput: {
      publications: publicationCount,
      citations: citationTotal,
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
    publications: publications.slice(0, 5).map((p) => ({
      id: p._id,
      title: p.title,
      type: p.type,
      year: p.year,
      status: p.status,
      doi: p.doi,
      citations: p.citationCount,
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
    facultyAnalytics,
    annualReport,
  };
}

async function getInstitutionalAnalytics(req, res) {
  const data = await buildInstitutionalAnalytics();
  res.json(data);
}

async function getFacultyReport(req, res) {
  const dept = (req.user.department || "").trim();
  const filter = dept ? { department: dept } : {};

  const [proposals, projects, publications, deptUsers] = await Promise.all([
    Proposal.find(filter).select("title status department researcherId createdAt updatedAt").populate("researcherId", "fullName"),
    Project.find({}).populate("researcherId", "fullName department"),
    Publication.find({}).populate("researcherId", "fullName department"),
    User.find({ department: dept, status: USER_STATUSES.ACTIVE }).select("fullName role"),
  ]);

  const facultyProjects = projects.filter(
    (p) => p.researcherId && (p.researcherId.department === dept || !dept)
  );
  const facultyPublications = publications.filter(
    (p) => p.researcherId && (p.researcherId.department === dept || !dept)
  );

  res.json({
    department: dept || "All faculties",
    generatedAt: new Date().toISOString(),
    counts: {
      researchers: deptUsers.filter((u) => u.role === ROLES.RESEARCHER).length,
      proposals: proposals.length,
      projects: facultyProjects.length,
      publications: facultyPublications.length,
      citations: facultyPublications.reduce((acc, p) => acc + (p.citationCount || 0), 0),
    },
    proposals: proposals.slice(0, 50).map((p) => ({
      id: p._id,
      title: p.title,
      status: p.status,
      author: p.researcherId?.fullName || "—",
      updatedAt: p.updatedAt,
    })),
    projects: facultyProjects.slice(0, 50).map((p) => ({
      id: p._id,
      title: p.title,
      status: p.status,
      pi: p.researcherId?.fullName || "—",
    })),
    publications: facultyPublications.slice(0, 50).map((p) => ({
      id: p._id,
      title: p.title,
      type: p.type,
      year: p.year,
      author: p.researcherId?.fullName || "—",
      citations: p.citationCount || 0,
      status: p.status,
    })),
  });
}

async function exportFacultyReportPdf(req, res) {
  const dept = (req.user.department || "").trim();
  const filter = dept ? { department: dept } : {};

  const [proposals, projects, publications, deptUsers] = await Promise.all([
    Proposal.find(filter).populate("researcherId", "fullName department"),
    Project.find({}).populate("researcherId", "fullName department"),
    Publication.find({}).populate("researcherId", "fullName department"),
    User.find({ department: dept, status: USER_STATUSES.ACTIVE }).select("fullName role"),
  ]);

  const facultyProjects = projects.filter(
    (p) => p.researcherId && (p.researcherId.department === dept || !dept)
  );
  const facultyPublications = publications.filter(
    (p) => p.researcherId && (p.researcherId.department === dept || !dept)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="JUST-RMS-Faculty-Report-${(dept || "all").replace(/\s+/g, "-")}.pdf"`
  );

  const doc = new PDFDocument({ size: "A4", margin: 54 });
  doc.pipe(res);

  doc.fontSize(20).text(`Faculty Research Report — ${dept || "All faculties"}`, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#444").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.2);

  doc.fontSize(14).text("Faculty overview", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(`Researchers: ${deptUsers.filter((u) => u.role === ROLES.RESEARCHER).length}`);
  doc.text(`Proposals: ${proposals.length}`);
  doc.text(`Projects: ${facultyProjects.length}`);
  doc.text(`Publications: ${facultyPublications.length}`);
  doc.text(
    `Citations: ${facultyPublications.reduce((acc, p) => acc + (p.citationCount || 0), 0)}`
  );
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
    doc.text(`• ${p.title} — ${p.type} ${p.year || ""} — ${p.citationCount || 0} citations`);
  });

  doc.end();
}

async function exportAnnualReportPdf(req, res) {
  const data = await buildInstitutionalAnalytics();
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
  doc.text(`Total citations: ${data.researchOutput.citations}`);
  doc.text(`Active projects: ${data.projectStatus.active} / ${data.projectStatus.total}`);
  doc.moveDown(0.8);

  doc.fontSize(14).text("Publications per faculty (top 5)", { underline: true });
  doc.moveDown(0.4);
  (ar.topFacultyByPublications || []).forEach((f) => {
    doc.text(
      `${f.department}: ${f.publications} publications, ${f.citations} citations, ${f.researchers} researchers`
    );
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
  const [budgets, grants] = await Promise.all([
    Budget.find({}).select("title totalAllocated items grantId projectId"),
    Grant.find({}).select("title amountAwarded amountRequested status fundingSource"),
  ]);

  const allItems = budgets.flatMap((b) =>
    (b.items || []).map((i) => ({
      budgetTitle: b.title,
      description: i.description,
      amount: i.amount,
      status: i.status,
      type: i.type,
    }))
  );

  const totalAllocated = budgets.reduce((a, b) => a + (b.totalAllocated || 0), 0);
  const totalExpenses = allItems.filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID).reduce((a, i) => a + (i.amount || 0), 0);

  res.json({
    generatedAt: new Date().toISOString(),
    summary: {
      budgets: budgets.length,
      totalAllocated,
      totalPaid: totalExpenses,
      utilizationPercent: totalAllocated ? Math.round((totalExpenses / totalAllocated) * 100) : 0,
      activeGrants: grants.filter((g) => g.status === GRANT_STATUSES.ACTIVE).length,
      awardedTotal: grants.filter((g) => g.status === GRANT_STATUSES.ACTIVE).reduce((a, g) => a + (g.amountAwarded || 0), 0),
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

module.exports = {
  getDashboardMetrics,
  buildInstitutionalAnalytics,
  getInstitutionalAnalytics,
  exportAnnualReportPdf,
  getFinanceReport,
  getFacultyReport,
  exportFacultyReportPdf,
};

