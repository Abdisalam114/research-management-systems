const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { User } = require("../models/User");
const {
  resolveWorkflowStage,
  workflowStageLabel,
  STAGE_ORDER,
  WORKFLOW_STAGES,
} = require("./publicationWorkflow");
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

/** Director always sees award amounts; others only after a submitted/validated publication. */
function canViewProjectAwards({ role, hasProjectPublication }) {
  if (role === "research_director") return true;
  return Boolean(hasProjectPublication);
}

function publicationUnlocksAwards(publication) {
  if (!publication) return false;
  return (
    publication.status === PUBLICATION_STATUSES.SUBMITTED ||
    publication.status === PUBLICATION_STATUSES.VALIDATED
  );
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
  return (
    project?.status === PROJECT_STATUSES.COMPLETED ||
    project?.status === PROJECT_STATUSES.CLOSED
  );
}

const GRANTS_LOCKED_DETAIL =
  "Ma muuqdaan ilaa project-ku noqdo Completed/Closed · Hidden until project is Completed or Closed";

/** Until project is completed, keep grant steps visible but non-actionable.
 *  Do not erase real completed grant work (call-linked awards already done).
 */
function maskGrantStepsUntilComplete(steps, project) {
  if (isProjectCompleted(project)) return steps;
  return steps.map((s) => {
    if (s.key !== GRANT_APPLY_KEY && s.key !== GRANT_AWARD_KEY) return s;
    if (s.status === "completed") {
      return { ...s, link: null, detail: s.detail || GRANTS_LOCKED_DETAIL };
    }
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

/** Automatic % from workflow steps — researchers do not enter progress manually. */
function computeProgressPercentFromSteps(steps, project) {
  if (isProjectCompleted(project)) return 100;
  if (!steps?.length) return 0;
  const countable = steps.filter((s) => s.status !== "skipped");
  if (!countable.length) return 0;
  const completed = countable.filter((s) => s.status === "completed").length;
  const current = countable.some((s) => s.status === "current") ? 1 : 0;
  const score = completed + current * 0.5;
  return Math.min(100, Math.round((score / countable.length) * 100));
}

function buildProjectSteps(project, approved) {
  const link = project ? `/projects/${project._id}` : "/projects";

  if (!project) {
    const createdStatus = approved ? "current" : "pending";
    return [
      step("project_created", "Project created", createdStatus, {
        link: "/projects",
        detail: approved ? "Awaiting project record" : undefined,
      }),
      step("project_team", "Team & milestones setup", "pending", { link: "/projects" }),
      step("project_progress", "Research progress (automatic)", "pending", { link: "/projects" }),
    ];
  }

  const hasTeamOrMilestones =
    (project.teamMembers?.length || 0) > 0 || (project.milestones?.length || 0) > 0;
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
  else if (!isCompleted) teamStatus = "current";

  steps.push(
    step("project_team", "Team & milestones setup", teamStatus, {
      link,
      detail: hasTeamOrMilestones
        ? `${project.teamMembers?.length || 0} team • ${project.milestones?.length || 0} milestones`
        : "Add research team and milestones",
    })
  );

  let progressStatus = "current";
  if (isCompleted) progressStatus = "completed";
  else if (isOnHold) progressStatus = "blocked";

  steps.push(
    step("project_progress", "Research progress (automatic)", progressStatus, {
      at: ts(project.updatedAt || project.createdAt),
      link,
      detail: "Progress % updates automatically from your workflow steps",
    })
  );

  return steps;
}

function buildProjectCompletedStep(project, publication = null, repositoryItem = null, { isVoluntary = true } = {}) {
  if (!project) {
    return step("project_completed", "Project completed", "pending", { link: "/projects", section: "publish" });
  }

  const link = `/projects/${project._id}#closure`;
  const isCompleted =
    project.status === PROJECT_STATUSES.COMPLETED ||
    project.status === PROJECT_STATUSES.CLOSED;
  const isClosing = project.status === PROJECT_STATUSES.CLOSING;
  const isOnHold = project.status === PROJECT_STATUSES.ON_HOLD;
  const closureStatus = project.closure?.status;
  const closurePending = ["submitted", "director_approved", "finance_approved"].includes(closureStatus);
  const pubStage = publication ? resolveWorkflowStage(publication) : null;
  const pubPublished = pubStage === WORKFLOW_STAGES.PUBLISHED;
  const hasRepository = Boolean(repositoryItem);

  let completeStatus = "pending";
  if (isCompleted) completeStatus = "completed";
  else if (isOnHold) completeStatus = "blocked";
  else if (isClosing || closurePending) completeStatus = "current";
  else if (pubPublished && hasRepository) completeStatus = "current";

  let detail = isVoluntary
    ? "Final step — Research Director must approve closure"
    : "Final step — Director and Finance must approve closure";
  if (isOnHold) detail = "On hold";
  else if (isCompleted) detail = "Completed / closed";
  else if (closureStatus === "submitted") {
    detail = isVoluntary
      ? "Awaiting Research Director closure approval"
      : "Awaiting Research Director closure approval (then Finance)";
  } else if (closureStatus === "director_approved") {
    detail = "Director approved — awaiting Finance closure clearance";
  } else if (closureStatus === "finance_approved") {
    detail = "Awaiting final archive";
  } else if (pubPublished && hasRepository) {
    detail = isVoluntary
      ? "Publish pipeline done — submit closure for director approval"
      : "Publish pipeline done — submit closure (director + finance)";
  } else if (pubPublished) {
    detail = "Output published — archive in repository, then submit closure";
  }

  return step("project_completed", "Project completed", completeStatus, {
    link,
    section: "publish",
    detail,
  });
}

/** Faculty publish pipeline: submitted → in process → pipeline → published */
function buildPublicationPipelineSteps(project, publication) {
  const pubLink = project ? `/publications?projectId=${project._id}` : "/publications";
  const pub = publication || null;
  const stageDefs = [
    { key: "pub_submitted", stage: WORKFLOW_STAGES.SUBMITTED },
    { key: "pub_in_process", stage: WORKFLOW_STAGES.IN_PROCESS },
    { key: "pub_pipeline", stage: WORKFLOW_STAGES.PIPELINE },
    { key: "pub_published", stage: WORKFLOW_STAGES.PUBLISHED },
  ];

  if (!pub && !project) {
    return [
      step("pub_submitted", "Publish — Submitted", "pending", {
        link: pubLink,
        section: "publish",
        detail: "Register a research output",
      }),
    ];
  }

  if (!pub) {
    return stageDefs.map((def, index) =>
      step(`pub_${def.stage}`, `Publish — ${workflowStageLabel(def.stage)}`, index === 0 ? "current" : "pending", {
        link: pubLink,
        section: "publish",
        detail: index === 0 ? "Register and submit output for this project" : undefined,
      })
    );
  }

  const pubDraft = pub.status === PUBLICATION_STATUSES.DRAFT;
  const pubRevision = pub.status === PUBLICATION_STATUSES.REVISION_REQUESTED;
  const pubRejected = pub.status === PUBLICATION_STATUSES.REJECTED;
  const resolvedStage = resolveWorkflowStage(pub);
  const stageIndex = STAGE_ORDER.indexOf(resolvedStage);

  return stageDefs.map((def, index) => {
    let status = "pending";
    if (pubDraft || pubRevision) {
      status = index === 0 ? "current" : "pending";
    } else if (pubRejected) {
      status = index === 0 ? "blocked" : "pending";
    } else if (stageIndex >= 0) {
      if (index < stageIndex) status = "completed";
      else if (index === stageIndex) {
        status = stageIndex === STAGE_ORDER.length - 1 ? "completed" : "current";
      }
    }

    return step(`pub_${def.stage}`, `Publish — ${workflowStageLabel(def.stage)}`, status, {
      at: index === stageIndex || (stageIndex === STAGE_ORDER.length - 1 && index === stageIndex) ? ts(pub.updatedAt) : null,
      link: pubLink,
      section: "publish",
      detail:
        index === 0 && (pubDraft || pubRevision || pubRejected)
          ? `${String(pub.title || "").slice(0, 55)} • ${pub.status}`
          : index === stageIndex
            ? String(pub.title || "").slice(0, 55)
            : undefined,
    });
  });
}

/**
 * Allow independent step progress: later ready steps stay "current"
 * even if an earlier step is still open (e.g. team setup + repository).
 * Completed / blocked / skipped statuses are never rewritten.
 */
function enforceSequentialWorkflow(steps) {
return steps;
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

  const grant = pickPrimaryGrant(grants);
  const grantAwarded = grant && AWARDED_GRANT.includes(grant.status) && Number(grant.amountAwarded || 0) > 0;
  const isVoluntary =
    proposal.proposalKind === "voluntary" ||
    (!proposal.fundingCallId && proposal.proposalKind !== "grant_fund_call");

  if (!isVoluntary) {
    const projectDone = isProjectCompleted(project);
    const fundingLink = project ? `/funding-calls?projectId=${project._id}` : "/funding-calls";
    const budgetLink = project ? `/budgets?projectId=${project._id}` : "/budgets";

    if (grant) {
      const grantApplyDone = grant.status !== GRANT_STATUSES.DRAFT;
      const awardInFlight = [
        GRANT_STATUSES.SUBMITTED,
        GRANT_STATUSES.PENDING_FINANCE,
        GRANT_STATUSES.APPROVED,
      ].includes(grant.status);
      const grantLink = project
        ? `/grants/${grant._id}?projectId=${project._id}`
        : `/grants/${grant._id}`;
      steps.push(
        step("grant_apply", "Grant / funding request", grantApplyDone ? "completed" : "current", {
          at: ts(grant.submittedAt || grant.createdAt),
          link: grantLink,
          detail: grant.status,
        })
      );
      steps.push(
        step("grant_award", "Grant awarded", grantAwarded ? "completed" : awardInFlight ? "current" : "pending", {
          at: ts(grant.decidedAt),
          link: grantLink,
          detail: grantAwarded ? `${grant.currency || "USD"} ${grant.amountAwarded}` : grant.status,
        })
      );
    } else if (project) {
      steps.push(
        step("grant_apply", "Grant / funding request", projectDone ? "current" : "pending", {
          link: fundingLink,
          detail: projectDone
            ? "Apply through a Funding Call"
            : "Available after project is Completed/Closed — via Funding Calls only",
        })
      );
      steps.push(step("grant_award", "Grant awarded", "pending", { link: fundingLink }));
    } else {
      steps.push(
        step("grant_apply", "Grant / funding request", "pending", {
          link: "/funding-calls",
          detail: "Apply only through a Funding Call",
        })
      );
      steps.push(step("grant_award", "Grant awarded", "pending", { link: "/funding-calls" }));
    }

    if (budget) {
      steps.push(
        step("budget", "Budget allocated", "completed", {
          at: ts(budget.createdAt),
          link: budgetLink,
          detail: `${budget.currency || "USD"} ${budget.totalAllocated}`,
        })
      );
    } else if (grantAwarded) {
      steps.push(step("budget", "Budget allocated", "current", { link: budgetLink, detail: "Pending budget setup" }));
    } else {
      steps.push(step("budget", "Budget allocated", "pending", { link: budgetLink }));
    }
  }

  const pubLink = project ? `/publications?projectId=${project._id}` : "/publications";
  const repoLink = project ? `/repository?projectId=${project._id}` : "/repository";
  const pub = publication || null;
  const pubSubmittedOrBetter =
    pub &&
    [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED, PUBLICATION_STATUSES.REVISION_REQUESTED].includes(
      pub.status
    );

  steps.push(...buildPublicationPipelineSteps(project, pub));

  const repo = repositoryItem || null;
  let repoStatus = "pending";
  if (repo) repoStatus = "completed";
  else if (pubSubmittedOrBetter) repoStatus = "current";

  steps.push(
    step("repository", "Archive in repository", repoStatus, {
      at: repo ? ts(repo.createdAt) : null,
      link: repoLink,
      section: "publish",
      detail: repo ? repo.title : pubSubmittedOrBetter ? "Archive output files for this project" : "After publish pipeline",
    })
  );

  steps.push(buildProjectCompletedStep(project, pub, repo, { isVoluntary }));

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

async function buildResearchJourneyForResearcher(researcherId, tierFilter, viewerRole = null) {
  const researcher = await User.findById(researcherId).select("fullName email department role");
  if (!researcher) return null;

  const base = { researcherId };
  const [proposals, projects, grants, budgets, publications, repositoryItems] = await Promise.all([
    Proposal.find(base).sort({ updatedAt: -1 }),
    Project.find(base).sort({ updatedAt: -1 }),
    Grant.find(base).sort({ updatedAt: -1 }),
    Budget.find({ ownerResearcherId: researcherId }).sort({ updatedAt: -1 }),
    Publication.find(base).sort({ updatedAt: -1 }),
    RepositoryItem.find({ uploadedBy: researcherId }).sort({ updatedAt: -1 }),
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
    const canViewAwards = canViewProjectAwards({
      role: viewerRole,
      hasProjectPublication: publicationUnlocksAwards(publication),
    });
    let steps = maskGrantStepsUntilComplete(track.steps, project);
    steps = redactAwardStepDetails(steps, canViewAwards);
    const current =
      steps.find((s) => s.status === "current") ||
      steps.find((s) => s.status === "blocked") ||
      steps.filter((s) => s.status === "completed").pop();
    const progressPercent = project ? computeProgressPercentFromSteps(steps, project) : null;
    return {
      currentStepKey: current?.key || track.currentStepKey,
      currentStepLabel: current?.label || track.currentStepLabel,
      steps,
      progressPercent,
      awardsVisible: canViewAwards,
    };
  }

  function syntheticProposalForProject(project, linkedGrants = []) {
    const funded = (linkedGrants || []).some(
      (g) => g?.callId || Number(g?.amountAwarded || 0) > 0
    );
    return {
      _id: project.proposalId || project.proposal || project._id,
      title: project.title,
      status: PROPOSAL_STATUSES.APPROVED,
      requiresEthics: false,
      ethicsStatus: ETHICS_STATUSES.NOT_REQUIRED,
      proposalKind: funded ? "grant_fund_call" : "voluntary",
      fundingCallId: funded
        ? (linkedGrants.find((g) => g?.callId)?.callId || null)
        : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      submittedAt: project.createdAt,
    };
  }

  const projectsPipeline = projects.map((project) => {
    const proposalId = String(project.proposalId || project.proposal || "");
    const trackGrants = grantsByProject.get(String(project._id)) || [];
    const proposal =
      proposals.find((p) => String(p._id) === proposalId) ||
      syntheticProposalForProject(project, trackGrants);
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
  // Accept a faculty label, a single department name, or an expanded name list from facultyMatcher.
  if (Array.isArray(department) && department.length) {
    filter.department = { $in: department };
  } else if (typeof department === "string" && department.trim()) {
    filter.department = department.trim();
  }
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

function syntheticProposalForProject(project, linkedGrants = []) {
  const funded = (linkedGrants || []).some(
    (g) => g?.callId || Number(g?.amountAwarded || 0) > 0
  );
  return {
    _id: project.proposalId || project.proposal || project._id,
    title: project.title,
    status: PROPOSAL_STATUSES.APPROVED,
    requiresEthics: false,
    ethicsStatus: ETHICS_STATUSES.NOT_REQUIRED,
    proposalKind: funded ? "grant_fund_call" : "voluntary",
    fundingCallId: funded
      ? linkedGrants.find((g) => g?.callId)?.callId || null
      : null,
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
  const canViewAwards = canViewProjectAwards({
    role: viewerRole,
    hasProjectPublication: publicationUnlocksAwards(publication),
  });
  const grantsVisible = isProjectCompleted(project);
  let steps = maskGrantStepsUntilComplete(track.steps, project);
  steps = redactAwardStepDetails(steps, canViewAwards);
  const current =
    steps.find((s) => s.status === "current") ||
    steps.find((s) => s.status === "blocked") ||
    steps.filter((s) => s.status === "completed").pop();
  const progressPercent = project ? computeProgressPercentFromSteps(steps, project) : null;
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
  const ownerId = tierFilter?.researcherId || null;
  const projectQuery = ownerId
    ? { _id: projectId, researcherId: ownerId }
    : { _id: projectId, ...(tierFilter || {}) };
  const project = await Project.findOne(projectQuery);
  if (!project) return null;

  // Related docs are linked by projectId — do not re-apply researcherId (wrong field on Budget/Repo).
  const relatedScope =
    ownerId || !tierFilter?.programTier ? {} : { programTier: tierFilter.programTier };

  const proposalId = project.proposalId || project.proposal;
  let proposal = proposalId
    ? await Proposal.findOne({ _id: proposalId, ...(ownerId ? {} : relatedScope) })
    : null;

  const [trackGrants, publications, repositoryItems] = await Promise.all([
    Grant.find({
      projectId: project._id,
      callId: { $ne: null, $exists: true },
      ...relatedScope,
    }).sort({ updatedAt: -1 }),
    Publication.find({ projectId: project._id, ...relatedScope }).sort({ updatedAt: -1 }),
    RepositoryItem.find({ projectId: project._id, ...relatedScope }).sort({ updatedAt: -1 }),
  ]);
  if (!proposal) proposal = syntheticProposalForProject(project, trackGrants);
  const primaryGrant = pickPrimaryGrant(trackGrants);
  const budget = primaryGrant
    ? await Budget.findOne({ grantId: primaryGrant._id, ...relatedScope })
    : null;

  const publication = pickPublicationForProject(publications, project);
  const repositoryItem = pickRepositoryForProject(repositoryItems, project);
  const canViewAwards = canViewProjectAwards({
    role: viewerRole,
    hasProjectPublication: publicationUnlocksAwards(publication),
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
  computeProgressPercentFromSteps,
  pickPrimaryGrant,
  canViewProjectAwards,
  sanitizeLinkedGrantsForViewer,
  redactAwardStepDetails,
  maskGrantStepsUntilComplete,
  isProjectCompleted,
};
