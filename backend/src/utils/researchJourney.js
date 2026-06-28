const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { User } = require("../models/User");

const AWARDED_GRANT = [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED, GRANT_STATUSES.CLOSED];

function step(key, label, status, extra = {}) {
  return { key, label, status, ...extra };
}

function ts(value) {
  return value ? new Date(value).toISOString() : null;
}

function buildStepsForTrack({ proposal, project, grants, budget, publications, repositoryItems }) {
  const steps = [];
  const rejected = proposal.status === PROPOSAL_STATUSES.REJECTED;
  const approved = proposal.status === PROPOSAL_STATUSES.APPROVED;

  steps.push(
    step("proposal_created", "Create research proposal", "completed", {
      at: ts(proposal.createdAt),
      link: `/proposals/${proposal._id}`,
      detail: proposal.title,
    })
  );

  if (proposal.requiresEthics) {
    let ethicsStatus = "pending";
    if (proposal.ethicsStatus === ETHICS_STATUSES.APPROVED) ethicsStatus = "completed";
    else if (proposal.ethicsStatus === ETHICS_STATUSES.REJECTED) ethicsStatus = "blocked";
    else if ([PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.REVISION_REQUESTED].includes(proposal.status)) {
      ethicsStatus = "current";
    }
    steps.push(
      step("ethics", "Ethics (REC) approval", ethicsStatus, {
        at: ts(proposal.updatedAt),
        link: `/proposals/${proposal._id}`,
        detail: proposal.ethicsStatus,
      })
    );
  } else {
    steps.push(step("ethics", "Ethics (REC) approval", "skipped", { detail: "Not required" }));
  }

  const submitDone = ![PROPOSAL_STATUSES.DRAFT].includes(proposal.status) || proposal.submittedAt;
  steps.push(
    step("proposal_submit", "Submit proposal for review", submitDone ? "completed" : "current", {
      at: ts(proposal.submittedAt),
      link: `/proposals/${proposal._id}`,
      detail: proposal.status,
    })
  );

  const coordDone = [
    PROPOSAL_STATUSES.UNDER_REVIEW,
    PROPOSAL_STATUSES.APPROVED,
    PROPOSAL_STATUSES.REJECTED,
  ].includes(proposal.status);
  steps.push(
    step("coordinator_review", "Faculty coordinator pre-review", coordDone ? "completed" : proposal.status === PROPOSAL_STATUSES.SUBMITTED ? "current" : "pending", {
      at: ts(proposal.submittedAt),
      link: `/proposals/${proposal._id}/review`,
      detail: proposal.status,
    })
  );

  steps.push(
    step("director_decision", "Director decision", approved ? "completed" : rejected ? "blocked" : proposal.status === PROPOSAL_STATUSES.UNDER_REVIEW ? "current" : "pending", {
      at: ts(proposal.updatedAt),
      link: `/proposals/${proposal._id}/review`,
      detail: proposal.status,
    })
  );

  if (project) {
    const latestProgress = project.progressReports?.[0];
    steps.push(
      step("project", "Active research project", "completed", {
        at: ts(project.createdAt),
        link: `/projects/${project._id}`,
        detail: `${project.status}${latestProgress ? ` • ${latestProgress.progressPercent || 0}% progress` : ""}`,
      })
    );
  } else if (approved) {
    steps.push(step("project", "Active research project", "current", { link: "/projects", detail: "Awaiting project record" }));
  } else {
    steps.push(step("project", "Active research project", "pending", { link: "/projects" }));
  }

  const grant = grants[0] || null;
  const grantAwarded = grant && AWARDED_GRANT.includes(grant.status) && Number(grant.amountAwarded || 0) > 0;

  if (grant) {
    steps.push(
      step("grant_apply", "Grant / funding request", grant.status !== GRANT_STATUSES.DRAFT ? "completed" : "current", {
        at: ts(grant.submittedAt || grant.createdAt),
        link: `/grants/${grant._id}`,
        detail: grant.status,
      })
    );
    steps.push(
      step("grant_award", "Grant awarded", grantAwarded ? "completed" : grant.status === GRANT_STATUSES.SUBMITTED ? "current" : "pending", {
        at: ts(grant.decidedAt),
        link: `/grants/${grant._id}`,
        detail: grantAwarded ? `${grant.currency || "USD"} ${grant.amountAwarded}` : grant.status,
      })
    );
  } else if (project) {
    steps.push(step("grant_apply", "Grant / funding request", "current", { link: "/grants", detail: "Not started" }));
    steps.push(step("grant_award", "Grant awarded", "pending", { link: "/grants" }));
  } else {
    steps.push(step("grant_apply", "Grant / funding request", "pending", { link: "/grants" }));
    steps.push(step("grant_award", "Grant awarded", "pending", { link: "/grants" }));
  }

  if (budget) {
    steps.push(
      step("budget", "Budget allocated", "completed", {
        at: ts(budget.createdAt),
        link: "/budgets",
        detail: `${budget.currency || "USD"} ${budget.totalAllocated}`,
      })
    );
  } else if (grantAwarded) {
    steps.push(step("budget", "Budget allocated", "current", { link: "/budgets", detail: "Pending budget setup" }));
  } else {
    steps.push(step("budget", "Budget allocated", "pending", { link: "/budgets" }));
  }

  const pub = publications[0] || null;
  const pubValidated = pub && pub.status === PUBLICATION_STATUSES.VALIDATED;
  if (pub) {
    steps.push(
      step("publication", "Research publication", pubValidated ? "completed" : "current", {
        at: ts(pub.updatedAt),
        link: "/publications",
        detail: pub.status + (pub.workflowStage ? ` • ${pub.workflowStage}` : ""),
      })
    );
  } else if (project) {
    steps.push(step("publication", "Research publication", "pending", { link: "/publications" }));
  } else {
    steps.push(step("publication", "Research publication", "pending", { link: "/publications" }));
  }

  const repo = repositoryItems[0] || null;
  steps.push(
    step("repository", "Archive in repository", repo ? "completed" : project ? "pending" : "pending", {
      at: repo ? ts(repo.createdAt) : null,
      link: "/repository",
      detail: repo ? repo.title : "Not archived yet",
    })
  );

  const current = steps.find((s) => s.status === "current") || steps.find((s) => s.status === "blocked") || steps.filter((s) => s.status === "completed").pop();
  return { steps, currentStepKey: current?.key || null, currentStepLabel: current?.label || null };
}

function buildTimelineEvents({ proposals, projects, grants, publications, project }) {
  const events = [];
  for (const p of proposals) {
    if (p.createdAt) events.push({ at: p.createdAt, label: `Proposal created: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    if (p.submittedAt) events.push({ at: p.submittedAt, label: `Proposal submitted: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    if (p.status === PROPOSAL_STATUSES.APPROVED) {
      events.push({ at: p.updatedAt, label: `Proposal approved: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    }
  }
  for (const g of grants) {
    if (g.submittedAt) events.push({ at: g.submittedAt, label: `Grant submitted: ${g.title}`, module: "grants", link: `/grants/${g._id}` });
    if (g.decidedAt && AWARDED_GRANT.includes(g.status)) {
      events.push({ at: g.decidedAt, label: `Grant awarded: ${g.title}`, module: "grants", link: `/grants/${g._id}` });
    }
  }
  if (project?.progressReports?.length) {
    for (const r of project.progressReports) {
      events.push({
        at: r.createdAt,
        label: `Progress update: ${r.progressPercent || 0}% — ${String(r.note || "").slice(0, 60)}`,
        module: "projects",
        link: `/projects/${project._id}`,
      });
    }
  }
  for (const pub of publications.slice(0, 5)) {
    events.push({ at: pub.updatedAt, label: `Publication: ${pub.title} (${pub.status})`, module: "publications", link: "/publications" });
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
}

async function buildResearchJourneyForResearcher(researcherId, tierFilter) {
  const researcher = await User.findOne({ _id: researcherId, ...tierFilter }).select("fullName email department role");
  if (!researcher) return null;

  const base = { researcherId, ...tierFilter };
  const [proposals, projects, grants, budgets, publications, repositoryItems] = await Promise.all([
    Proposal.find(base).sort({ updatedAt: -1 }),
    Project.find(base).sort({ updatedAt: -1 }),
    Grant.find(base).sort({ updatedAt: -1 }),
    Budget.find({ ownerResearcherId: researcherId, ...tierFilter }).sort({ updatedAt: -1 }),
    Publication.find(base).sort({ updatedAt: -1 }),
    RepositoryItem.find({ uploadedBy: researcherId, ...tierFilter }).sort({ updatedAt: -1 }),
  ]);

  const projectByProposal = new Map();
  for (const proj of projects) {
    const pid = String(proj.proposalId || proj.proposal || "");
    if (pid) projectByProposal.set(pid, proj);
  }

  const grantsByProject = new Map();
  for (const g of grants) {
    const pid = String(g.projectId || "");
    if (!grantsByProject.has(pid)) grantsByProject.set(pid, []);
    grantsByProject.get(pid).push(g);
  }

  const budgetByGrant = new Map();
  for (const b of budgets) {
    if (b.grantId) budgetByGrant.set(String(b.grantId), b);
  }

  const tracks = proposals.map((proposal) => {
    const project = projectByProposal.get(String(proposal._id)) || null;
    const trackGrants = project ? grantsByProject.get(String(project._id)) || [] : [];
    const grant = trackGrants[0] || null;
    const budget = grant ? budgetByGrant.get(String(grant._id)) || null : null;
    const track = buildStepsForTrack({
      proposal,
      project,
      grants: trackGrants,
      budget,
      publications,
      repositoryItems,
    });
    return {
      proposalId: proposal._id,
      title: proposal.title,
      proposalStatus: proposal.status,
      projectId: project?._id || null,
      currentStepKey: track.currentStepKey,
      currentStepLabel: track.currentStepLabel,
      steps: track.steps,
    };
  });

  const primaryProject = projects[0] || null;
  const timeline = buildTimelineEvents({
    proposals,
    projects,
    grants,
    publications,
    project: primaryProject,
  });

  return {
    researcher: {
      id: researcher._id,
      fullName: researcher.fullName,
      email: researcher.email,
      department: researcher.department,
    },
    summary: {
      proposals: proposals.length,
      projects: projects.length,
      grants: grants.length,
      publications: publications.length,
      repositoryItems: repositoryItems.length,
    },
    tracks: tracks.length ? tracks : [],
    timeline,
  };
}

async function listResearchersForJourney(tierFilter, department) {
  const filter = { role: "researcher", ...tierFilter };
  if (department) filter.department = department;
  const researchers = await User.find(filter).select("fullName email department").sort({ fullName: 1 });

  const summaries = await Promise.all(
    researchers.map(async (r) => {
      const latest = await Proposal.findOne({ researcherId: r._id, ...tierFilter }).sort({ updatedAt: -1 }).select("title status");
      return {
        id: r._id,
        fullName: r.fullName,
        email: r.email,
        department: r.department,
        latestProposal: latest ? { title: latest.title, status: latest.status } : null,
      };
    })
  );
  return summaries;
}

module.exports = { buildResearchJourneyForResearcher, listResearchersForJourney };
