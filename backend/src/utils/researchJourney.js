const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { User } = require("../models/User");
const {
  indexByProjectId,
  pickPublicationForProject,
  pickRepositoryForProject,
} = require("./projectScopedRecords");

const AWARDED_GRANT = [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED, GRANT_STATUSES.CLOSED];

function pickPrimaryGrant(grants) {
  if (!grants?.length) return null;
  const statusRank = {
    [GRANT_STATUSES.ACTIVE]: 4,
    [GRANT_STATUSES.APPROVED]: 3,
    [GRANT_STATUSES.SUBMITTED]: 2,
    [GRANT_STATUSES.DRAFT]: 1,
    [GRANT_STATUSES.CLOSED]: 3,
    [GRANT_STATUSES.REJECTED]: 0,
  };
  return [...grants].sort((a, b) => {
    const rankDiff = (statusRank[b.status] || 0) - (statusRank[a.status] || 0);
    if (rankDiff !== 0) return rankDiff;
    return Number(b.amountAwarded || 0) - Number(a.amountAwarded || 0);
  })[0];
}

/** Director always sees award amounts; others only after the project has a publication. */
function canViewProjectAwards({ role, hasProjectPublication }) {
  if (role === "research_director") return true;
  return Boolean(hasProjectPublication);
}

function redactAwardStepDetails(steps, canViewAwards) {
  if (canViewAwards) return steps;
  return steps.map((s) => {
    if (s.key !== "grant_award") return s;
    const hasAmount = s.detail && /\d/.test(String(s.detail));
    if (!hasAmount && s.status !== "completed") return s;
    return {
      ...s,
      detail: "Award recorded — amount shown after publication (director authorized)",
    };
  });
}

const GRANT_AWARD_KEY = "grant_award";
const GRANT_APPLY_KEY = "grant_apply";

function isProjectCompleted(project) {
  return project?.status === PROJECT_STATUSES.COMPLETED;
}

const GRANTS_LOCKED_DETAIL =
  "Ma muuqdaan ilaa project-ku noqdo Completed · Hidden until project is Completed";

/** Show grant steps in pipeline as pending until project is completed. */
function maskGrantStepsUntilComplete(steps, project) {
  if (isProjectCompleted(project)) return steps;
  return steps.map((s) => {
    if (s.key !== GRANT_APPLY_KEY && s.key !== GRANT_AWARD_KEY) return s;
    return {
      ...s,
      status: "pending",
      detail: GRANTS_LOCKED_DETAIL,
      at: null,
      link: null,
    };
  });
}

function sanitizeLinkedGrantsForViewer(grants, canViewAwards, project) {
  if (!isProjectCompleted(project)) return [];
  if (canViewAwards) return grants;
  return grants.map((g) => ({
    ...g,
    amountRequested: null,
    amountAwarded: null,
    awardsHidden: true,
  }));
}

function step(key, label, status, extra = {}) {
  return { key, label, status, ...extra };
}

function ts(value) {
  return value ? new Date(value).toISOString() : null;
}

function buildProjectSteps(project, approved) {
  const link = project ? `/projects/${project._id}` : "/projects";
  const progressLink = project ? `/projects/${project._id}/progress` : "/projects";

  if (!project) {
    const createdStatus = approved ? "current" : "pending";
    return [
      step("project_created", "Project created", createdStatus, {
        link: "/projects",
        detail: approved ? "Awaiting project record" : undefined,
      }),
      step("project_team", "Team & milestones setup", "pending", { link: "/projects" }),
      step("project_progress", "Progress updates", "pending", { link: "/projects" }),
    ];
  }

  const hasTeamOrMilestones =
    (project.teamMembers?.length || 0) > 0 || (project.milestones?.length || 0) > 0;
  const hasProgress = (project.progressReports?.length || 0) > 0;
  const latestProgress = project.progressReports?.[0];
  const isCompleted = project.status === PROJECT_STATUSES.COMPLETED;
  const isOnHold = project.status === PROJECT_STATUSES.ON_HOLD;

  const steps = [
    step("project_created", "Project created", "completed", {
      at: ts(project.createdAt),
      link,
      detail: project.title,
    }),
  ];

  let teamStatus = "pending";
  if (hasTeamOrMilestones) teamStatus = "completed";
  else if (!hasProgress && !isCompleted) teamStatus = "current";

  steps.push(
    step("project_team", "Team & milestones setup", teamStatus, {
      link,
      detail: hasTeamOrMilestones
        ? `${project.teamMembers?.length || 0} team • ${project.milestones?.length || 0} milestones`
        : "Add research team and milestones",
    })
  );

  let progressStatus = "pending";
  if (isCompleted && hasProgress) progressStatus = "completed";
  else if (hasProgress) progressStatus = "current";
  else if (hasTeamOrMilestones) progressStatus = "current";

  steps.push(
    step("project_progress", "Progress updates", progressStatus, {
      at: latestProgress ? ts(latestProgress.createdAt) : null,
      link: progressLink,
      detail: hasProgress
        ? `${latestProgress.progressPercent || 0}% — ${String(latestProgress.note || "").slice(0, 55)}`
        : "Submit progress on your project",
    })
  );

  return steps;
}

function buildProjectCompletedStep(project) {
  if (!project) {
    return step("project_completed", "Project completed", "pending", { link: "/projects" });
  }

  const link = `/projects/${project._id}`;
  const hasProgress = (project.progressReports?.length || 0) > 0;
  const latestProgress = project.progressReports?.[0];
  const isCompleted = project.status === PROJECT_STATUSES.COMPLETED;
  const isOnHold = project.status === PROJECT_STATUSES.ON_HOLD;

  let completeStatus = "pending";
  if (isCompleted) completeStatus = "completed";
  else if (isOnHold) completeStatus = "blocked";
  else if (hasProgress && (latestProgress?.progressPercent || 0) >= 90) completeStatus = "current";

  return step("project_completed", "Project completed", completeStatus, {
    link,
    detail: isOnHold ? "On hold" : project.status,
  });
}

/** Later pipeline steps stay pending until the current stage is finished. */
function enforceSequentialWorkflow(steps) {
  const haltIdx = steps.findIndex((s) => s.status === "current" || s.status === "blocked");
  if (haltIdx === -1) return steps;

  const haltKey = steps[haltIdx]?.key;

  return steps.map((s, i) => {
    if (i <= haltIdx || s.status === "skipped") return s;
    if (s.status !== "completed" && s.status !== "current") return s;
    const downgraded = { ...s, status: "pending", at: null };
    if (s.key === "project_completed") {
      downgraded.detail = "Pending — finish progress and budget stages first";
    }
    return downgraded;
  });
}

function buildStepsForTrack({ proposal, project, grants, budget, publication, repositoryItem }) {
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

  steps.push(...buildProjectSteps(project, approved));
  steps.push(buildProjectCompletedStep(project));

  const grant = pickPrimaryGrant(grants);
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
    const grantLink = `/grants?projectId=${project._id}`;
    steps.push(step("grant_apply", "Grant / funding request", "pending", { link: grantLink, detail: "After project completion" }));
    steps.push(step("grant_award", "Grant awarded", "pending", { link: grantLink }));
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

  const pubLink = project ? `/publications?projectId=${project._id}` : "/publications";
  const repoLink = project ? `/repository?projectId=${project._id}` : "/repository";
  const pub = publication || null;
  const pubValidated = pub && pub.status === PUBLICATION_STATUSES.VALIDATED;
  if (pub) {
    steps.push(
      step("publication", "Research publication", pubValidated ? "completed" : "current", {
        at: ts(pub.updatedAt),
        link: pubLink,
        detail: pub.title
          ? `${String(pub.title).slice(0, 55)} • ${pub.status}${pub.workflowStage ? ` • ${pub.workflowStage}` : ""}`
          : pub.status + (pub.workflowStage ? ` • ${pub.workflowStage}` : ""),
      })
    );
  } else if (project) {
    steps.push(step("publication", "Research publication", "pending", { link: pubLink }));
  } else {
    steps.push(step("publication", "Research publication", "pending", { link: pubLink }));
  }

  const repo = repositoryItem || null;
  steps.push(
    step("repository", "Archive in repository", repo ? "completed" : project ? "pending" : "pending", {
      at: repo ? ts(repo.createdAt) : null,
      link: repoLink,
      detail: repo ? repo.title : "Not archived yet",
    })
  );

  const gatedSteps = enforceSequentialWorkflow(steps);
  const current =
    gatedSteps.find((s) => s.status === "current") ||
    gatedSteps.find((s) => s.status === "blocked") ||
    gatedSteps.filter((s) => s.status === "completed").pop();
  return { steps: gatedSteps, currentStepKey: current?.key || null, currentStepLabel: current?.label || null };
}

function buildTimelineEvents({ proposals, projects, grants, publications }) {
  const events = [];
  for (const p of proposals) {
    if (p.createdAt) events.push({ at: p.createdAt, label: `Proposal created: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    if (p.submittedAt) events.push({ at: p.submittedAt, label: `Proposal submitted: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    if (p.status === PROPOSAL_STATUSES.APPROVED) {
      events.push({ at: p.updatedAt, label: `Proposal approved: ${p.title}`, module: "proposals", link: `/proposals/${p._id}` });
    }
  }
  for (const proj of projects) {
    if (proj.createdAt) {
      events.push({
        at: proj.createdAt,
        label: `Project created: ${proj.title}`,
        module: "projects",
        link: `/projects/${proj._id}`,
      });
    }
    if (proj.progressReports?.length) {
      for (const r of proj.progressReports) {
        events.push({
          at: r.createdAt,
          label: `Progress update (${proj.title}): ${r.progressPercent || 0}% — ${String(r.note || "").slice(0, 60)}`,
          module: "projects",
          link: `/projects/${proj._id}`,
        });
      }
    }
    if (proj.status === PROJECT_STATUSES.COMPLETED) {
      events.push({
        at: proj.updatedAt,
        label: `Project completed: ${proj.title}`,
        module: "projects",
        link: `/projects/${proj._id}`,
      });
    }
  }
  for (const g of grants) {
    if (g.submittedAt) events.push({ at: g.submittedAt, label: `Grant submitted: ${g.title}`, module: "grants", link: `/grants/${g._id}` });
    if (g.decidedAt && AWARDED_GRANT.includes(g.status)) {
      events.push({ at: g.decidedAt, label: `Grant awarded: ${g.title}`, module: "grants", link: `/grants/${g._id}` });
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

  const publicationsByProject = indexByProjectId(publications);
  const repositoryByProject = indexByProjectId(repositoryItems);

  function trackBundle(proposal, project, trackGrants, budget) {
    const publication = project
      ? pickPublicationForProject(publicationsByProject.get(String(project._id)) || [], project)
      : null;
    const repositoryItem = project
      ? pickRepositoryForProject(repositoryByProject.get(String(project._id)) || [], project)
      : null;
    const track = buildStepsForTrack({
      proposal,
      project,
      grants: trackGrants,
      budget,
      publication,
      repositoryItem,
    });
    const latestProgress = project?.progressReports?.[0];
    let progressPercent = null;
    if (project) {
      progressPercent =
        latestProgress?.progressPercent ??
        (project.status === PROJECT_STATUSES.COMPLETED ? 100 : 0);
    }
    return {
      currentStepKey: track.currentStepKey,
      currentStepLabel: track.currentStepLabel,
      steps: track.steps,
      progressPercent,
    };
  }

  function syntheticProposalForProject(project) {
    return {
      _id: project.proposalId || project.proposal || project._id,
      title: project.title,
      status: PROPOSAL_STATUSES.APPROVED,
      requiresEthics: false,
      ethicsStatus: ETHICS_STATUSES.NOT_REQUIRED,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      submittedAt: project.createdAt,
    };
  }

  const projectsPipeline = projects.map((project) => {
    const proposalId = String(project.proposalId || project.proposal || "");
    const proposal =
      proposals.find((p) => String(p._id) === proposalId) || syntheticProposalForProject(project);
    const trackGrants = grantsByProject.get(String(project._id)) || [];
    const primaryGrant = pickPrimaryGrant(trackGrants);
    const budget = primaryGrant ? budgetByGrant.get(String(primaryGrant._id)) || null : null;
    return {
      projectId: project._id,
      title: project.title,
      projectStatus: project.status,
      proposalId: proposal._id,
      proposalStatus: proposal.status,
      ...trackBundle(proposal, project, trackGrants, budget),
    };
  });

  const pendingProposals = proposals
    .filter((p) => !projectByProposal.has(String(p._id)))
    .map((proposal) => ({
      proposalId: proposal._id,
      title: proposal.title,
      proposalStatus: proposal.status,
      projectId: null,
      ...trackBundle(proposal, null, [], null),
    }));

  const tracks = [
    ...projectsPipeline.map((p) => ({
      proposalId: p.proposalId,
      projectId: p.projectId,
      title: p.title,
      proposalStatus: p.proposalStatus,
      currentStepKey: p.currentStepKey,
      currentStepLabel: p.currentStepLabel,
      steps: p.steps,
    })),
    ...pendingProposals.map((p) => ({
      proposalId: p.proposalId,
      projectId: null,
      title: p.title,
      proposalStatus: p.proposalStatus,
      currentStepKey: p.currentStepKey,
      currentStepLabel: p.currentStepLabel,
      steps: p.steps,
    })),
  ];

  const timeline = buildTimelineEvents({
    proposals,
    projects,
    grants,
    publications,
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
    projects: projectsPipeline,
    pendingProposals,
    tracks: tracks.length ? tracks : [],
    timeline,
  };
}

async function listResearchersForJourney(tierFilter, department) {
  const filter = { role: "researcher", ...tierFilter };
  if (department) filter.department = department;
  const researchers = await User.find(filter).select("fullName email department programTier").sort({ fullName: 1 });

  const summaries = await Promise.all(
    researchers.map(async (r) => {
      const latest = await Proposal.findOne({ researcherId: r._id, ...tierFilter }).sort({ updatedAt: -1 }).select("title status");
      return {
        id: r._id,
        fullName: r.fullName,
        email: r.email,
        department: r.department,
        programTier: r.programTier,
        latestProposal: latest ? { title: latest.title, status: latest.status } : null,
      };
    })
  );
  return summaries;
}

function syntheticProposalForProject(project) {
  return {
    _id: project.proposalId || project.proposal || project._id,
    title: project.title,
    status: PROPOSAL_STATUSES.APPROVED,
    requiresEthics: false,
    ethicsStatus: ETHICS_STATUSES.NOT_REQUIRED,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    submittedAt: project.createdAt,
  };
}

function buildTrackResult(proposal, project, trackGrants, budget, publications, repositoryItems, viewerRole) {
  const publication = project ? pickPublicationForProject(publications, project) : null;
  const repositoryItem = project ? pickRepositoryForProject(repositoryItems, project) : null;
  const track = buildStepsForTrack({
    proposal,
    project,
    grants: trackGrants,
    budget,
    publication,
    repositoryItem,
  });
  const latestProgress = project?.progressReports?.[0];
  let progressPercent = null;
  if (project) {
    progressPercent =
      latestProgress?.progressPercent ??
      (project.status === PROJECT_STATUSES.COMPLETED ? 100 : 0);
  }
  const canViewAwards = canViewProjectAwards({
    role: viewerRole,
    hasProjectPublication: Boolean(publication),
  });
  const grantsVisible = isProjectCompleted(project);
  let steps = maskGrantStepsUntilComplete(track.steps, project);
  steps = redactAwardStepDetails(steps, canViewAwards);
  const current =
    steps.find((s) => s.status === "current") ||
    steps.find((s) => s.status === "blocked") ||
    steps.filter((s) => s.status === "completed").pop();
  return {
    currentStepKey: current?.key || null,
    currentStepLabel: current?.label || null,
    steps,
    progressPercent,
    proposalStatus: proposal.status,
    awardsVisible: canViewAwards,
    grantsVisible,
  };
}

async function buildWorkflowForProject(projectId, tierFilter, viewerRole = null) {
  const project = await Project.findOne({ _id: projectId, ...tierFilter });
  if (!project) return null;

  const proposalId = project.proposalId || project.proposal;
  let proposal = proposalId ? await Proposal.findOne({ _id: proposalId, ...tierFilter }) : null;
  if (!proposal) proposal = syntheticProposalForProject(project);

  const researcherId = project.researcherId;
  const [trackGrants, publications, repositoryItems] = await Promise.all([
    Grant.find({ projectId: project._id, ...tierFilter }).sort({ updatedAt: -1 }),
    Publication.find({ projectId: project._id, ...tierFilter }).sort({ updatedAt: -1 }),
    RepositoryItem.find({ projectId: project._id, ...tierFilter }).sort({ updatedAt: -1 }),
  ]);
  const primaryGrant = pickPrimaryGrant(trackGrants);
  const budget = primaryGrant ? await Budget.findOne({ grantId: primaryGrant._id, ...tierFilter }) : null;

  const publication = pickPublicationForProject(publications, project);
  const repositoryItem = pickRepositoryForProject(repositoryItems, project);
  const canViewAwards = canViewProjectAwards({
    role: viewerRole,
    hasProjectPublication: Boolean(publication),
  });

  const track = buildTrackResult(
    proposal,
    project,
    trackGrants,
    budget,
    publications,
    repositoryItems,
    viewerRole
  );

return {
    projectId: project._id,
    title: project.title,
    projectStatus: project.status,
    proposalId: proposal._id,
    awardsVisible: canViewAwards,
    grantsVisible: isProjectCompleted(project),
    ...track,
  };
}

module.exports = {
  buildResearchJourneyForResearcher,
  listResearchersForJourney,
  buildWorkflowForProject,
  pickPrimaryGrant,
  canViewProjectAwards,
  sanitizeLinkedGrantsForViewer,
  redactAwardStepDetails,
  maskGrantStepsUntilComplete,
  isProjectCompleted,
};
