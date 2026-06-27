const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const API = "http://127.0.0.1:5000";

function log(entry) {
  fs.appendFileSync(LOG, JSON.stringify({ sessionId: "6113cc", runId: "active-projects-verify", timestamp: Date.now(), ...entry }) + "\n");
}

async function main() {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "director@rms.edu", password: "Director2024!" }),
  });
  if (!loginRes.ok) throw new Error(`login failed ${loginRes.status}`);
  const { accessToken } = await loginRes.json();

  const res = await fetch(`${API}/api/analytics/institutional`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`institutional failed ${res.status}`);
  const data = await res.json();

  const payload = {
    hypothesisId: "B",
    location: "verify-active-projects.cjs",
    message: "institutional active projects verify",
    data: {
      totalActive: data?.projectStatus?.active,
      tableLength: data?.activeProjects?.length ?? 0,
      titles: (data?.activeProjects || []).map((p) => p.title),
    },
  };
  log(payload);
  console.log(JSON.stringify(payload.data, null, 2));
}

main().catch((e) => {
  log({ hypothesisId: "B", message: "verify failed", data: { error: e.message } });
  console.error(e);
  process.exit(1);
});
