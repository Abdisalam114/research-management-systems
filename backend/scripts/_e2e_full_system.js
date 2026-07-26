/**
 * Full-system careful smoke + closure E2E (start → end).
 * Requires backend :5000.
 * Run: node scripts/_e2e_full_system.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PROGRAM_TIER_HEADER } = require("../src/constants/programTier");

const BASE = process.env.API_BASE || "http://localhost:5000";
const LOG = path.join(__dirname, "../../debug-f558f7.log");

const ACCOUNTS = [
  { email: "director@rms.edu", password: "Director2024!", role: "research_director", crossTier: true },
  { email: "coordinator@rms.edu", password: "Coordinator2024!", role: "faculty_coordinator", crossTier: true },
  { email: "finance@rms.edu", password: "Finance2024!", role: "finance_officer", crossTier: true },
  { email: "leadership@rms.edu", password: "Leadership2024!", role: "leadership", crossTier: true },
  { email: "asha@rms.edu", password: "Researcher2024!", role: "researcher", crossTier: false, tier: "undergraduate" },
  { email: "mahad@rms.edu", password: "Researcher2024!", role: "researcher", crossTier: false, tier: "postgraduate" },
];

const ROLE_ENDPOINTS = {
  research_director: [
    "/api/analytics/dashboard",
    "/api/proposals",
    "/api/projects",
    "/api/funding-calls",
    "/api/grants",
    "/api/ethics",
    "/api/publications",
    "/api/budgets",
    "/api/policies",
    "/api/thesis-groups",
    "/api/notifications/me",
  ],
  faculty_coordinator: [
    "/api/analytics/dashboard",
    "/api/proposals",
    "/api/projects",
    "/api/ethics",
    "/api/funding-calls",
    "/api/thesis-groups",
  ],
  finance_officer: [
    "/api/analytics/dashboard",
    "/api/budgets",
    "/api/analytics/finance-report",
    "/api/grants",
    "/api/projects",
    "/api/policies",
  ],
  leadership: [
    "/api/analytics/dashboard",
    "/api/grants",
    "/api/analytics/kpi-dashboard",
    "/api/proposals/my-review-assignments",
    "/api/policies",
  ],
  researcher: [
    "/api/analytics/dashboard",
    "/api/proposals",
    "/api/projects",
    "/api/funding-calls",
    "/api/grants",
    "/api/ethics",
  ],
};

function log(hypothesisId, message, data) {
  const line = JSON.stringify({
    sessionId: "f558f7",
    runId: "full-system-e2e",
    hypothesisId,
    location: "_e2e_full_system.js",
    message,
    data,
    timestamp: Date.now(),
  });
  fs.appendFileSync(LOG, `${line}\n`);
  console.log(`[${hypothesisId}] ${message}`, data && JSON.stringify(data).slice(0, 220));
}

async function api(method, urlPath, token, body, programTier) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (programTier) headers[PROGRAM_TIER_HEADER] = programTier;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, password) {
  const r = await api("POST", "/api/auth/login", null, { email, password });
  if (r.status !== 200 || !r.data?.accessToken) {
    throw new Error(`Login failed ${email}: ${r.status} ${r.data?.message || ""}`);
  }
  return r.data;
}

async function main() {
  const results = { ok: [], fail: [] };

  // 0) Health
  const health = await api("GET", "/api/health");
  if (health.status !== 200) {
    log("E0", "backend down", { status: health.status });
    process.exit(1);
  }
  results.ok.push("health");

  // 1) Auth + role APIs for both portals (shared staff)
  for (const acc of ACCOUNTS) {
    try {
      const sess = await login(acc.email, acc.password);
      const token = sess.accessToken;
      const me = await api("GET", "/api/auth/me", token);
      if (me.status !== 200 || me.data?.user?.role !== acc.role) {
        throw new Error(`me role mismatch ${me.data?.user?.role}`);
      }

      const tiers = acc.crossTier ? ["undergraduate", "postgraduate"] : [acc.tier];
      for (const tier of tiers) {
        // Cross-tier staff MUST send tier (428 without)
        if (acc.crossTier) {
          const noTier = await api("GET", "/api/projects", token);
          if (noTier.status !== 428) {
            results.fail.push(`${acc.email} expected 428 without tier got ${noTier.status}`);
          } else {
            results.ok.push(`${acc.email} requires portal`);
          }
        }

        const endpoints = ROLE_ENDPOINTS[acc.role] || [];
        for (const ep of endpoints) {
          const r = await api("GET", ep, token, undefined, tier);
          if (r.status !== 200) {
            results.fail.push(`${acc.email} ${tier} ${ep} → ${r.status} ${r.data?.message || ""}`);
          }
        }
        results.ok.push(`${acc.email} ${tier} endpoints`);
      }
    } catch (e) {
      results.fail.push(`${acc.email}: ${e.message}`);
    }
  }

  // 2) Director PG: projects + pending closures
  try {
    const dir = await login("director@rms.edu", "Director2024!");
    for (const tier of ["undergraduate", "postgraduate"]) {
      const projects = await api("GET", "/api/projects", dir.accessToken, undefined, tier);
      if (projects.status !== 200) throw new Error(`projects ${tier} ${projects.status}`);
      const list = projects.data.projects || [];
      const submitted = list.filter((p) => p.closure?.status === "submitted");
      const closing = list.filter((p) => p.status === "closing");
      log("E2", "director projects portal", {
        tier,
        total: list.length,
        submittedClosures: submitted.length,
        closing: closing.length,
        sample: submitted.slice(0, 3).map((p) => p.title),
      });
      results.ok.push(`director projects ${tier}`);
    }
  } catch (e) {
    results.fail.push(`director projects: ${e.message}`);
  }

  // 3) Finance PG: closure queue tabs data
  try {
    const fin = await login("finance@rms.edu", "Finance2024!");
    for (const tier of ["undergraduate", "postgraduate"]) {
      const projects = await api("GET", "/api/projects", fin.accessToken, undefined, tier);
      if (projects.status !== 200) throw new Error(`finance projects ${tier} ${projects.status}`);
      const list = projects.data.projects || [];
      const awaiting = list.filter((p) => p.closure?.status === "director_approved");
      const cleared = list.filter((p) => ["finance_approved", "archived"].includes(p.closure?.status));
      // Finance should not see full catalogue — only closure-related
      const nonClosure = list.filter(
        (p) => !["director_approved", "finance_approved", "archived"].includes(p.closure?.status)
      );
      log("E3", "finance closure queue", {
        tier,
        total: list.length,
        awaiting: awaiting.length,
        cleared: cleared.length,
        leakNonClosure: nonClosure.length,
      });
      if (nonClosure.length > 0) {
        results.fail.push(`finance ${tier} leaked non-closure projects: ${nonClosure.length}`);
      } else {
        results.ok.push(`finance queue scoped ${tier}`);
      }
    }
  } catch (e) {
    results.fail.push(`finance queue: ${e.message}`);
  }

  // 4) Closure E2E on PG bank system if present
  try {
    const dir = await login("director@rms.edu", "Director2024!");
    const fin = await login("finance@rms.edu", "Finance2024!");
    const tier = "postgraduate";
    const projects = await api("GET", "/api/projects", dir.accessToken, undefined, tier);
    let bank = (projects.data.projects || []).find((p) => /bank system/i.test(p.title || ""));

    if (!bank) {
      log("E4", "bank system not found — skip closure mutate", {});
      results.ok.push("closure e2e skipped (no bank system)");
    } else {
      // Ensure submitted for director approve path
      const { connectDB } = require("../src/config/db");
      const mongoose = require("mongoose");
      const { Project, CLOSURE_STATUSES, PROJECT_STATUSES } = require("../src/models/Project");
      await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
      const doc = await Project.findById(bank.id);
      if (doc && doc.closure?.status !== CLOSURE_STATUSES.SUBMITTED) {
        doc.closure = doc.closure || {};
        doc.closure.status = CLOSURE_STATUSES.SUBMITTED;
        doc.closure.directorApprovedAt = null;
        doc.closure.directorApprovedBy = null;
        doc.closure.financeApprovedAt = null;
        doc.closure.financeApprovedBy = null;
        if (doc.closure.checklist) doc.closure.checklist.financialCleared = false;
        doc.status = PROJECT_STATUSES.CLOSING;
        await doc.save();
      }
      await mongoose.disconnect().catch(() => {});

      const approveDir = await api(
        "POST",
        `/api/projects/${bank.id}/closure/director-approve`,
        dir.accessToken,
        { comment: "E2E director approve" },
        tier
      );
      if (approveDir.status !== 200) {
        throw new Error(`director approve ${approveDir.status} ${approveDir.data?.message}`);
      }
      const afterDir = approveDir.data.project;
      if (afterDir?.closure?.status !== "director_approved") {
        throw new Error(`expected director_approved got ${afterDir?.closure?.status}`);
      }
      results.ok.push("director approve closure");

      const finList = await api("GET", "/api/projects", fin.accessToken, undefined, tier);
      const inQueue = (finList.data.projects || []).find((p) => String(p.id) === String(bank.id));
      if (!inQueue || inQueue.closure?.status !== "director_approved") {
        throw new Error("finance queue missing director_approved bank system");
      }
      results.ok.push("finance sees awaiting clearance");

      const approveFin = await api(
        "POST",
        `/api/projects/${bank.id}/closure/finance-approve`,
        fin.accessToken,
        { comment: "E2E finance clear" },
        tier
      );
      if (approveFin.status !== 200) {
        throw new Error(`finance approve ${approveFin.status} ${approveFin.data?.message}`);
      }
      const closed = approveFin.data.project;
      if (closed?.status !== "completed" && closed?.closure?.status !== "archived") {
        // auto-close should set completed + archived
        throw new Error(
          `expected auto-close completed/archived got status=${closed?.status} closure=${closed?.closure?.status}`
        );
      }
      if (closed?.closure?.status !== "archived") {
        throw new Error(`expected closure archived got ${closed?.closure?.status}`);
      }
      if (closed?.status !== "completed") {
        throw new Error(`expected project completed got ${closed?.status}`);
      }
      results.ok.push("finance approve auto-closes project");
      log("E4", "closure e2e success", {
        title: closed.title,
        status: closed.status,
        closure: closed.closure?.status,
      });
    }
  } catch (e) {
    results.fail.push(`closure e2e: ${e.message}`);
    log("E4", "closure e2e failed", { err: e.message });
  }

  // 5) Researcher locked to own tier (no cross header override for scope)
  try {
    const asha = await login("asha@rms.edu", "Researcher2024!");
    // Researcher shouldn't need/use cross-tier; API uses user.programTier
    const r = await api("GET", "/api/projects", asha.accessToken);
    if (r.status !== 200) throw new Error(`asha projects ${r.status}`);
    const wrongTier = (r.data.projects || []).filter((p) => p.programTier && p.programTier !== "undergraduate");
    if (wrongTier.length) {
      results.fail.push(`asha saw non-UG projects: ${wrongTier.length}`);
    } else {
      results.ok.push("researcher UG scoped");
    }
  } catch (e) {
    results.fail.push(`researcher scope: ${e.message}`);
  }

  const summary = {
    okCount: results.ok.length,
    failCount: results.fail.length,
    fails: results.fail,
  };
  log("SUMMARY", "full system e2e done", summary);
  console.log("\n=== FULL SYSTEM E2E ===");
  console.log(`OK steps: ${results.ok.length}`);
  console.log(`FAIL: ${results.fail.length}`);
  for (const f of results.fail) console.log(" -", f);
  process.exit(results.fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
