const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BACKEND = "http://localhost:5000";
const VITE = "http://localhost:5173";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "verify-e2e", timestamp: Date.now(), ...entry }) + "\n"
  );
}

async function req(base, method, url, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 120) };
  }
  return { status: res.status, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  fs.writeFileSync(LOG, "");

  // H1: backend direct
  const healthDirect = await req(BACKEND, "GET", "/api/health");
  log({ hypothesisId: "H1", message: "backend health direct", data: healthDirect });

  // H2: vite proxy (if vite running)
  let healthProxy = { status: 0, data: { note: "vite not running" } };
  try {
    healthProxy = await req(VITE, "GET", "/api/health");
  } catch (e) {
    healthProxy = { status: 0, data: { error: String(e.message) } };
  }
  log({ hypothesisId: "H2", message: "vite proxy health", data: healthProxy });

  const login = await req(BACKEND, "POST", "/api/auth/login", {
    body: { email: "admin@rms.edu", password: "admin123" },
  });
  log({ hypothesisId: "H3", message: "login", data: { status: login.status } });

  if (login.status !== 200 || !login.data?.accessToken) {
    log({ hypothesisId: "H3", message: "login failed - run seed:admin", data: login });
    process.exit(1);
  }

  const token = login.data.accessToken;

  for (const [url, name] of [
    ["/api/grants", "grants"],
    ["/api/budgets", "budgets"],
    ["/api/publications", "publications"],
  ]) {
    const direct = await req(BACKEND, "GET", url, { token });
    let proxy = { status: 0 };
    try {
      proxy = await req(VITE, "GET", url, { token });
    } catch (e) {
      proxy = { status: 0, data: { error: e.message } };
    }
    log({
      hypothesisId: "H2",
      location: name,
      message: `${name} direct vs proxy`,
      data: { direct: direct.status, proxy: proxy.status },
    });
  }

  log({ hypothesisId: "H0", message: "verify done", data: { proxyOk: healthProxy.status === 200 } });
  console.log("wrote", LOG);
  process.exit(healthProxy.status === 200 ? 0 : 2);
})();
