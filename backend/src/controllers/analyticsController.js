const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
// GRANT_STATUSES used in finance report
const { Budget, BUDGET_ITEM_STATUSES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES, PUBLICATION_TYPES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { User, USER_STATUSES, ROLES } = require("../models/User");
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

  const [proposalCount, projectCount, grants, budgets, pubs, repoCount, groupCount] = await Promise.all([
    Proposal.countDocuments(proposalFilter),
    Project.countDocuments(projectFilter),
    Grant.find(grantFilter).select("amountAwarded status"),
    Budget.find(budgetFilter).select("items"),
    Publication.find(pubFilter).select("status citationCount"),
    RepositoryItem.countDocuments(repoFilter),
    role === "researcher"
      ? ResearchGroup.countDocuments({ "members.userId": userId })
      : ResearchGroup.countDocuments({}),
  ]);

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
  base.groups.total = groupCount;

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
    User.countDocuments({ role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE }),
    Project.find({}).sort({ updatedAt: -1 }).limit(10).populate("researcherId", "fullName department"),
    Grant.find({}).select("amountAwarded status createdAt decidedAt"),
    Budget.find({}).select("items totalAllocated"),
    Publication.find({}).select("title type year status citationCount doi createdAt researcherId"),
    Proposal.find({ status: { $in: [PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW, PROPOSAL_STATUSES.APPROVED] } })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate("researcherId", "fullName"),
    RepositoryItem.find({}).sort({ createdAt: -1 }).limit(6).select("title type access createdAt"),
    ResearchGroup.find({}).sort({ createdAt: -1 }).limit(6).select("name members createdAt"),
  ]);

  const activeProjects = projects.filter((p) => p.status === PROJECT_STATUSES.ACTIVE).length;
  const completedProjects = projects.filter((p) => p.status === PROJECT_STATUSES.COMPLETED).length;
  const totalProjects = projectCount || 0;
  const activePercent = totalProjects ? Math.round((activeProjects / totalProjects) * 100) : 0;

  const allBudgetItems = budgets.flatMap((b) => b.items || []);
  const awardedTotal = grants.filter((g) => g.status === GRANT_STATUSES.ACTIVE).reduce((a, g) => a + (g.amountAwarded || 0), 0);

  const pubsByType = {
    journal: publications.filter((p) => p.type === PUBLICATION_TYPES.JOURNAL).length,
    conference: publications.filter((p) => p.type === PUBLICATION_TYPES.CONFERENCE).length,
    book: publications.filter((p) => p.type === PUBLICATION_TYPES.BOOK).length,
    patent: publications.filter((p) => p.type === PUBLICATION_TYPES.PATENT).length,
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
    .slice(0, 8);

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
  const facultyMap = {};
  activeUsers.forEach((u) => {
    const dept = u.department || "Unknown";
    if (!facultyMap[dept]) {
      facultyMap[dept] = { department: dept, researchers: 0, publications: 0, citations: 0, proposals: 0, projects: 0 };
    }
    if (u.role === ROLES.RESEARCHER) facultyMap[dept].researchers += 1;
  });

  publications.forEach((pub) => {
    const u = activeUsers.find((x) => String(x._id) === String(pub.researcherId));
    const dept = u?.department || "Unknown";
    if (!facultyMap[dept]) facultyMap[dept] = { department: dept, researchers: 0, publications: 0, citations: 0, proposals: 0, projects: 0 };
    facultyMap[dept].publications += 1;
    facultyMap[dept].citations += pub.citationCount || 0;
  });

  const allProposals = await Proposal.find({}).select("department status");
  allProposals.forEach((p) => {
    const dept = p.department || "Unknown";
    if (!facultyMap[dept]) facultyMap[dept] = { department: dept, researchers: 0, publications: 0, citations: 0, proposals: 0, projects: 0 };
    facultyMap[dept].proposals += 1;
  });

  projects.forEach((p) => {
    const dept = p.researcherId?.department || "Unknown";
    if (!facultyMap[dept]) facultyMap[dept] = { department: dept, researchers: 0, publications: 0, citations: 0, proposals: 0, projects: 0 };
    facultyMap[dept].projects += 1;
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
      groups: groupCount,
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
      patents: pubsByType.patent,
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
    publications: publications.slice(0, 8).map((p) => ({
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
};

