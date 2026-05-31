const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const API = "http://127.0.0.1:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "metrics-audit", timestamp: Date.now(), ...entry }) + "\n"
  );
}

function isAwardedGrant(g) {
  return g.status === "active" || g.status === "approved" || Number(g.amountAwarded || 0) > 0;
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "director@rms.edu", password: "Director2024!" }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.json();
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}

async function main() {
  const { accessToken } = await login();
  const [institutional, grantsRes, projectsRes] = await Promise.all([
    getJson(`${API}/api/analytics/institutional`, accessToken),
    getJson(`${API}/api/grants`, accessToken),
    getJson(`${API}/api/projects`, accessToken),
  ]);

  const grants = grantsRes.grants || [];
  const projects = projectsRes.projects || [];

  const listAwardedCount = grants.filter(isAwardedGrant).length;
  const listAwardedSum = grants.filter(isAwardedGrant).reduce((a, g) => a + (Number(g.amountAwarded) || 0), 0);
  const activeFromList = projects.filter((p) => p.status === "active").length;
  const completedFromList = projects.filter((p) => p.status === "completed").length;
  const onHoldFromList = projects.filter((p) => p.status === "on_hold").length;

  const checks = {
    projectsActive: institutional.projectStatus.active === activeFromList,
    projectsCompleted: institutional.projectStatus.completed === completedFromList,
    projectsOnHold: institutional.projectStatus.onHold === onHoldFromList,
    projectsTrackedBalanced:
      institutional.projectStatus.tracked ===
      institutional.projectStatus.active + institutional.projectStatus.completed + institutional.projectStatus.onHold,
    projectsTotalBalanced: institutional.projectStatus.tracked === projects.length,
    grantsAwardedCount: institutional.grantFunding.awardedGrantCount === listAwardedCount,
    grantsAwardedSum: institutional.keyMetrics.activeGrantsValue === listAwardedSum,
    groupsTotal: institutional.samples?.groups?.total === institutional.overview.groups,
    activeProjectsSample: institutional.samples?.activeProjects?.total === institutional.projectStatus.active,
    hasMetricDefinitions: Boolean(institutional.metricDefinitions),
    hasSamples: Boolean(institutional.samples),
  };

  const payload = {
    hypothesisId: "M3",
    location: "audit-system-metrics.cjs",
    message: "cross-check institutional vs list APIs",
    data: {
      checks,
      allPassed: Object.values(checks).every(Boolean),
      institutional: {
        projects: institutional.projectStatus,
        awardedCount: institutional.grantFunding.awardedGrantCount,
        awardedSum: institutional.keyMetrics.activeGrantsValue,
        groupsTotal: institutional.overview.groups,
      },
      fromLists: {
        activeProjects: activeFromList,
        awardedCount: listAwardedCount,
        awardedSum: listAwardedSum,
        projectTotal: projects.length,
      },
    },
  };

  log(payload);
  console.log(JSON.stringify(payload.data, null, 2));
  if (!payload.data.allPassed) process.exit(1);
}

main().catch((e) => {
  log({ hypothesisId: "M3", message: "audit failed", data: { error: e.message } });
  console.error(e);
  process.exit(1);
});
