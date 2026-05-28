const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = process.env.API_URL || "http://localhost:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "pub-tracking", timestamp: Date.now(), ...entry }) + "\n"
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
  const login = await req("POST", "/api/auth/login", { body: { email: "asha@rms.edu", password: "Researcher2024!" } });
  if (login.status !== 200) {
    log({ hypothesisId: "H0", message: "login failed", data: login });
    process.exit(1);
  }
  const token = login.data.accessToken;
  const list = await req("GET", "/api/publications", { token });
  const pubs = list.data.publications || [];
  const types = {};
  pubs.forEach((p) => {
    types[p.type] = (types[p.type] || 0) + 1;
  });
  const tracking = {
    paper: types.paper || 0,
    conference: types.conference || 0,
    review: types.review || 0,
    case_study: types.case_study || 0,
    letter_to_editor: types.letter_to_editor || 0,
    journal_article: types.journal_article || 0,
  };
  log({
    hypothesisId: "H1",
    message: "publication category counts",
    data: {
      total: pubs.length,
      coreFive: {
        paper: tracking.paper,
        conference: tracking.conference,
        review: tracking.review,
        case_study: tracking.case_study,
        letter_to_editor: tracking.letter_to_editor,
      },
      types,
    },
  });
  const create = await req("POST", "/api/publications", {
    token,
    body: {
      title: "Smoke test community impact",
      type: "community_research_impact",
      year: 2025,
      communityImpact: "Smoke test beneficiaries",
    },
  });
  log({ hypothesisId: "H2", message: "create community type", data: { status: create.status } });
  console.log("publication tracking smoke OK");
})();
