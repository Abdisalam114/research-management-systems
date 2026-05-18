const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = process.env.API_URL || "http://localhost:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "6113cc",
      runId: "smoke-modules",
      timestamp: Date.now(),
      ...entry,
    }) + "\n"
  );
}

async function req(method, url, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

(async () => {
  try {
    fs.writeFileSync(LOG, "");
    log({ hypothesisId: "H0", location: "smoke-modules.cjs", message: "smoke start", data: { BASE } });

    const health = await req("GET", "/api/health");
    log({ hypothesisId: "H1", location: "health", message: "health", data: health });

    const login = await req("POST", "/api/auth/login", {
      body: { email: "admin@rms.edu", password: "admin123" },
    });
    log({ hypothesisId: "H2", location: "login", message: "admin login", data: { status: login.status } });

    if (login.status !== 200 || !login.data?.accessToken) {
      log({ hypothesisId: "H2", message: "login failed", data: login });
      process.exit(1);
    }

    const token = login.data.accessToken;
    const endpoints = [
      ["/api/grants", "grants"],
      ["/api/budgets", "budgets"],
      ["/api/publications", "publications"],
      ["/api/repository", "repository"],
      ["/api/groups", "groups"],
      ["/api/notifications/me", "notifications"],
      ["/api/conversations", "conversations"],
    ];

    for (const [url, name] of endpoints) {
      const r = await req("GET", url, { token });
      const countKey = name === "repository" ? "items" : name;
      log({
        hypothesisId: "H3",
        location: name,
        message: `${name} list`,
        data: {
          status: r.status,
          count: Array.isArray(r.data?.[countKey]) ? r.data[countKey].length : null,
        },
      });
    }

    log({ hypothesisId: "H0", message: "smoke done", data: { ok: true } });
    console.log("smoke ok, log:", LOG);
  } catch (e) {
    log({ hypothesisId: "H0", message: "smoke error", data: { error: String(e.message || e) } });
    console.error(e);
    process.exit(1);
  }
})();
