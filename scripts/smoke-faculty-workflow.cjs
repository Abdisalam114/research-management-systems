const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = process.env.API_URL || "http://localhost:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "faculty-workflow", timestamp: Date.now(), ...entry }) + "\n"
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
  fs.writeFileSync(LOG, "");
  const coord = await req("POST", "/api/auth/login", {
    body: { email: "coordinator@rms.edu", password: "Coordinator2024!" },
  });
  if (coord.status !== 200) {
    log({ hypothesisId: "H0", message: "login failed", data: coord });
    process.exit(1);
  }
  const token = coord.data.accessToken;
  const wf = await req("GET", "/api/publications/faculty-workflow", { token });
  log({
    hypothesisId: "H1",
    message: "faculty workflow module",
    data: {
      status: wf.status,
      counts: wf.data?.counts,
      stageIds: (wf.data?.stages || []).map((s) => s.id),
    },
  });
  console.log("faculty workflow smoke OK");
})();
