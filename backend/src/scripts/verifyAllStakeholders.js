/**
 * Verify all institutional seed users can log in and hit role-specific APIs.
 * Run: node src/scripts/verifyAllStakeholders.js  (backend on :5000)
 */
require("dotenv").config();
const { connectDB } = require("../config/db");
const { INSTITUTIONAL_USERS } = require("./seedData");

const BASE = process.env.API_BASE || "http://localhost:5000";
const { PROGRAM_TIER_HEADER } = require("../constants/programTier");

const ROLE_CHECKS = {
  research_director: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/proposals", [200]],
    ["GET", "/api/funding-calls", [200]],
    ["GET", "/api/grants", [200]],
  ],
  faculty_coordinator: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/proposals", [200]],
    ["GET", "/api/ethics", [200]],
    ["GET", "/api/funding-calls", [200]],
  ],
  finance_officer: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/budgets", [200]],
    ["GET", "/api/analytics/finance-report", [200]],
    ["GET", "/api/grants", [200]],
    ["GET", "/api/policies", [200]],
  ],
  leadership: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/grants", [200]],
    ["GET", "/api/analytics/kpi-dashboard", [200]],
    ["GET", "/api/proposals/my-review-assignments", [200]],
    ["GET", "/api/policies", [200]],
  ],
  hr_officer: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/projects", [200]],
    ["GET", "/api/thesis-groups", [200]],
    ["GET", "/api/policies", [200]],
  ],
  donor_agency: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/analytics/donor-report", [200]],
    ["GET", "/api/grants", [200]],
  ],
  researcher: [
    ["GET", "/api/analytics/dashboard", [200]],
    ["GET", "/api/proposals", [200]],
    ["GET", "/api/funding-calls", [200]],
    ["GET", "/api/grants", [200]],
  ],
};

async function api(method, path, token, body, programTier) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (programTier) headers[PROGRAM_TIER_HEADER] = programTier;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);

  const health = await api("GET", "/api/health");
  if (health.status !== 200) {
    console.error("Backend not running on", BASE);
    process.exit(1);
  }

  let failures = 0;
  const rows = [];

  for (const spec of INSTITUTIONAL_USERS) {
    const login = await api("POST", "/api/auth/login", null, {
      email: spec.email,
      password: spec.password,
    });

    const loginOk = login.status === 200 && login.data?.accessToken;
    if (!loginOk) {
      failures += 1;
      rows.push({ email: spec.email, role: spec.role, login: "FAIL", tier: spec.programTier });
      continue;
    }

    const token = login.data.accessToken;
    const me = await api("GET", "/api/auth/me", token);
    const role = me.data?.user?.role || spec.role;
    const tierHeader =
      role === "research_director" ? spec.programTier || "undergraduate" : undefined;
    const checks = ROLE_CHECKS[role] || [["GET", "/api/analytics/dashboard", [200]]];
    let roleFail = 0;

    for (const [method, path, expected] of checks) {
      const r = await api(method, path, token, undefined, tierHeader);
      if (!expected.includes(r.status)) {
        roleFail += 1;
        failures += 1;
      }
    }

    rows.push({
      email: spec.email,
      role,
      tier: spec.programTier,
      login: "OK",
      api: roleFail === 0 ? "OK" : `FAIL(${roleFail})`,
    });
  }

  console.log("=== ALL STAKEHOLDER USERS ===\n");
  for (const r of rows) {
    console.log(`${r.login === "OK" && r.api === "OK" ? "OK" : "BAD"} | ${r.email} | ${r.role} | ${r.tier} | login=${r.login} api=${r.api}`);
  }
  const ok = rows.filter((r) => r.login === "OK" && r.api === "OK").length;
  console.log(`\nRESULT: ${ok}/${INSTITUTIONAL_USERS.length} users fully working`);
  process.exit(ok === INSTITUTIONAL_USERS.length ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
