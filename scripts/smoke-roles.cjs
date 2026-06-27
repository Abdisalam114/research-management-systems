const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = "http://localhost:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "smoke-roles", timestamp: Date.now(), ...entry }) + "\n"
  );
}

async function req(method, url, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  const reg = await req("POST", "/api/auth/register", {
    body: {
      fullName: "Test Researcher",
      email: `researcher${Date.now()}@rms.edu`,
      password: "test12345",
      role: "researcher",
      department: "CS",
    },
  });
  log({ hypothesisId: "H4", message: "register researcher", data: { status: reg.status } });

  if (reg.status === 201 && reg.data?.accessToken) {
    const token = reg.data.accessToken;
    for (const [url, name] of [
      ["/api/grants", "grants"],
      ["/api/budgets", "budgets"],
      ["/api/publications", "publications"],
    ]) {
      const r = await req("GET", url, { token });
      log({ hypothesisId: "H4", location: name, message: `researcher ${name}`, data: { status: r.status } });
    }
    const create = await req("POST", "/api/grants", {
      token,
      body: { title: "Smoke Grant", fundingSource: "Test Fund", amountRequested: 1000, currency: "USD" },
    });
    log({ hypothesisId: "H5", message: "researcher create grant", data: { status: create.status } });
  } else {
    log({ hypothesisId: "H4", message: "register failed or pending", data: reg });
  }
})();
