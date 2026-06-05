/**
 * Verify all demo roles can log in and access their expected API endpoints.
 * Run with backend on :5000. Writes debug-6113cc.log
 */
const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = "http://localhost:5000";

const USERS = [
  { role: "research_director", email: "director@rms.edu", password: "Director2024!" },
  { role: "faculty_coordinator", email: "coordinator@rms.edu", password: "Coordinator2024!" },
  { role: "finance_officer", email: "finance@rms.edu", password: "Finance2024!" },
  { role: "researcher", email: "asha@rms.edu", password: "Researcher2024!" },
  { role: "researcher_2", email: "mahad@rms.edu", password: "Researcher2024!" },
];

/** [method, path, expectedStatuses[], description] */
const ROLE_CHECKS = {
  research_director: [
    ["GET", "/api/analytics/dashboard", [200], "dashboard metrics"],
    ["GET", "/api/analytics/institutional", [200], "institutional analytics"],
    ["GET", "/api/users/pending", [200], "pending users"],
    ["GET", "/api/departments", [200], "departments"],
    ["GET", "/api/proposals", [200], "proposals list"],
    ["GET", "/api/ethics", [200], "ethics list"],
    ["GET", "/api/grants", [200], "grants list"],
    ["GET", "/api/budgets", [200], "budgets list"],
    ["GET", "/api/payments", [200], "payments list"],
    ["GET", "/api/conversations/users", [200], "messageable users"],
    ["GET", "/api/notifications/me/unread-count", [200], "notifications"],
    ["GET", "/api/analytics/faculty-report", [200], "faculty report"],
    ["GET", "/api/analytics/finance-report", [200], "finance report"],
  ],
  faculty_coordinator: [
    ["GET", "/api/analytics/dashboard", [200], "dashboard metrics"],
    ["GET", "/api/analytics/institutional", [403], "institutional blocked"],
    ["GET", "/api/users/pending", [403], "pending users blocked"],
    ["GET", "/api/proposals", [200], "proposals list"],
    ["GET", "/api/publications", [200], "publications list"],
    ["GET", "/api/ethics", [200], "ethics list"],
    ["GET", "/api/analytics/faculty-report", [200], "faculty report"],
    ["GET", "/api/analytics/finance-report", [403], "finance report blocked"],
    ["GET", "/api/conversations/users", [200], "messageable users"],
    ["GET", "/api/groups", [200], "groups list"],
    ["GET", "/api/thesis-groups", [200], "thesis groups"],
  ],
  finance_officer: [
    ["GET", "/api/analytics/dashboard", [200], "dashboard metrics"],
    ["GET", "/api/analytics/finance-report", [200], "finance report"],
    ["GET", "/api/analytics/institutional", [403], "institutional blocked"],
    ["GET", "/api/analytics/faculty-report", [403], "faculty report blocked"],
    ["GET", "/api/budgets", [200], "budgets list"],
    ["GET", "/api/payments", [200], "payments list"],
    ["GET", "/api/grants", [200], "grants list"],
    ["GET", "/api/conversations/users", [200], "messageable users"],
    ["GET", "/api/notifications/me/unread-count", [200], "notifications"],
  ],
  researcher_2: [
    ["GET", "/api/analytics/dashboard", [200], "dashboard metrics"],
    ["GET", "/api/proposals", [200], "own proposals"],
    ["GET", "/api/conversations/users", [200], "messageable users"],
  ],
  researcher: [
    ["GET", "/api/analytics/dashboard", [200], "dashboard metrics"],
    ["GET", "/api/analytics/institutional", [403], "institutional blocked"],
    ["GET", "/api/proposals", [200], "own proposals"],
    ["GET", "/api/projects", [200], "own projects"],
    ["GET", "/api/publications", [200], "own publications"],
    ["GET", "/api/grants", [200], "own grants"],
    ["GET", "/api/budgets", [200], "own budgets"],
    ["GET", "/api/ethics", [200], "own ethics"],
    ["GET", "/api/groups", [200], "groups"],
    ["GET", "/api/repository", [200], "repository"],
    ["GET", "/api/conversations/users", [200], "messageable users"],
    ["POST", "/api/grants", [201, 400], "create grant"],
  ],
};

function log(entry) {
  fs.appendFileSync(LOG, JSON.stringify({ sessionId: "6113cc", runId: "verify-all-roles", timestamp: Date.now(), ...entry }) + "\n");
}

async function req(method, url, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  try {
    fs.writeFileSync(LOG, "");
  } catch (_) {}

  const health = await req("GET", "/api/health");
  log({ hypothesisId: "H0", message: "backend health", data: health });
  if (health.status !== 200) {
    console.error("Backend not running on :5000");
    process.exit(1);
  }

  let totalFail = 0;
  const summary = [];

  for (const user of USERS) {
    const login = await req("POST", "/api/auth/login", { body: { email: user.email, password: user.password } });
    log({ hypothesisId: "LOGIN", role: user.role, message: "login", data: { status: login.status, email: user.email } });

    if (login.status !== 200 || !login.data?.accessToken) {
      console.error(`FAIL login ${user.role}: ${login.status}`);
      summary.push({ role: user.role, login: "FAIL", checks: [] });
      totalFail++;
      continue;
    }

    const token = login.data.accessToken;
    const me = await req("GET", "/api/auth/me", { token });
    log({ hypothesisId: "ME", role: user.role, message: "auth me", data: { status: me.status, role: me.data?.user?.role } });

    const checks = ROLE_CHECKS[user.role] || [];
    const roleResults = [];

    for (const [method, url, expected, desc] of checks) {
      let body;
      if (method === "POST" && url === "/api/grants") {
        body = { title: `Role test grant ${Date.now()}`, fundingSource: "Test", amountRequested: 500, currency: "USD" };
      }
      const r = await req(method, url, { token, body });
      const ok = expected.includes(r.status);
      if (!ok) totalFail++;
      roleResults.push({ desc, url, status: r.status, expected, ok: ok ? "PASS" : "FAIL" });
      log({
        hypothesisId: "ROLE",
        role: user.role,
        message: `${desc}`,
        data: { method, url, status: r.status, expected, ok },
      });
    }

    summary.push({ role: user.role, login: "OK", checks: roleResults });
  }

  console.log("\n=== Role verification summary ===\n");
  for (const s of summary) {
    console.log(`[${s.role}] login: ${s.login}`);
    for (const c of s.checks) {
      console.log(`  ${c.ok} ${c.desc} (${c.status}, expected ${c.expected.join("|")})`);
    }
    console.log("");
  }

  log({ hypothesisId: "SUMMARY", message: "verification complete", data: { totalFail, summary } });
  console.log(totalFail === 0 ? "ALL ROLES PASSED" : `FAILED: ${totalFail} checks`);
  process.exit(totalFail === 0 ? 0 : 1);
})();
