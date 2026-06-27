const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "..", "debug-6113cc.log");
const BASE = process.env.API_URL || "http://localhost:5000";

function log(entry) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: "6113cc", runId: "ethics-smoke", timestamp: Date.now(), ...entry }) + "\n"
  );
}

async function req(method, url, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const r = await req("POST", "/api/auth/login", { body: { email, password } });
  return r.status === 200 ? r.data.accessToken : null;
}

(async () => {
  try {
    fs.writeFileSync(LOG, "");
    const health = await req("GET", "/api/health");
    log({ hypothesisId: "H0", message: "health", data: health });
    if (health.status !== 200) {
      log({ hypothesisId: "H0", message: "backend down", data: health });
      process.exit(1);
    }

    const director = await login("director@rms.edu", "Director2024!");
    const researcher = await login("asha@rms.edu", "Researcher2024!");
    log({ hypothesisId: "H1", message: "logins", data: { director: !!director, researcher: !!researcher } });

    const listR = await req("GET", "/api/ethics", { token: researcher });
    log({ hypothesisId: "H2", message: "researcher list ethics", data: { status: listR.status, count: listR.data?.applications?.length } });

    const listD = await req("GET", "/api/ethics", { token: director });
    log({ hypothesisId: "H3", message: "director list ethics", data: { status: listD.status, count: listD.data?.applications?.length } });

    const proposals = await req("GET", "/api/proposals", { token: researcher });
    const draft = (proposals.data?.proposals || []).find((p) => p.requiresEthics && ["draft", "revision_requested"].includes(p.status));
    log({ hypothesisId: "H4", message: "draft proposal with ethics", data: { found: !!draft, id: draft?.id } });

    if (draft?.id) {
      const eth = await req("GET", `/api/proposals/${draft.id}/ethics-application`, { token: researcher });
      log({
        hypothesisId: "H5",
        message: "proposal ethics application",
        data: {
          status: eth.status,
          hasApp: !!eth.data?.application,
          formComplete: eth.data?.application?.formComplete,
          ethicsStatus: eth.data?.application?.status,
        },
      });
    }

    const submitted = (listD.data?.applications || []).find((a) => a.status === "submitted");
    if (submitted?.id) {
      const getOne = await req("GET", `/api/ethics/${submitted.id}`, { token: director });
      log({ hypothesisId: "H6", message: "get submitted ethics", data: { status: getOne.status, title: getOne.data?.application?.projectTitle } });
    }

    log({ hypothesisId: "H0", message: "ethics smoke done", data: { ok: true } });
    console.log("ethics smoke OK — see debug-6113cc.log");
  } catch (e) {
    log({ hypothesisId: "ERR", message: e.message, data: { stack: e.stack?.slice(0, 200) } });
    console.error(e);
    process.exit(1);
  }
})();
