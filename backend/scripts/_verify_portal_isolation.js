/** Verify strict UG/PG portal isolation for funding calls. */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const API = "http://127.0.0.1:5000";
const H = "x-program-tier";

async function http(method, url, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { FundingCall } = require("../src/models/FundingCall");

  const dir = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "director@rms.edu", password: "Director2024!" },
  });
  const asha = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "asha@rms.edu", password: "Researcher2024!" },
  });
  const mahad = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "postgraduate" },
    body: { email: "mahad@rms.edu", password: "Researcher2024!" },
  });

  const dirToken = dir.data?.accessToken;
  const ashaToken = asha.data?.accessToken;
  const mahadToken = mahad.data?.accessToken;
  if (!dirToken || !ashaToken || !mahadToken) {
    console.error("Login failed", { dir: dir.status, asha: asha.status, mahad: mahad.status });
    process.exit(1);
  }

  const tag = `_portal_iso_${Date.now()}`;
  const ugCall = await http("POST", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: { title: `${tag}_ug`, fundingSource: "JUST", eligibilityTier: "ug", programTier: "undergraduate" },
  });
  const pgCall = await http("POST", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "postgraduate" },
    body: { title: `${tag}_pg`, fundingSource: "JUST", eligibilityTier: "pg", programTier: "postgraduate" },
  });
  const ugId = ugCall.data?.call?.id;
  const pgId = pgCall.data?.call?.id;

  await http("POST", `${API}/api/funding-calls/${ugId}/publish`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
  });
  await http("POST", `${API}/api/funding-calls/${pgId}/publish`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "postgraduate" },
  });

  const ashaList = await http("GET", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${ashaToken}`, [H]: "undergraduate" },
  });
  const mahadList = await http("GET", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
  });

  const ashaIds = (ashaList.data?.calls || []).map((c) => String(c.id));
  const mahadIds = (mahadList.data?.calls || []).map((c) => String(c.id));

  const ugCross = await http("GET", `${API}/api/funding-calls/${pgId}`, {
    headers: { Authorization: `Bearer ${ashaToken}`, [H]: "undergraduate" },
  });
  const pgCross = await http("GET", `${API}/api/funding-calls/${ugId}`, {
    headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
  });

  // Cross-portal call — both portals can open
  const allCall = await http("POST", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: { title: `${tag}_all`, fundingSource: "JUST", eligibilityTier: "all", programTier: "undergraduate" },
  });
  const allId = allCall.data?.call?.id;
  await http("POST", `${API}/api/funding-calls/${allId}/publish`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
  });

  const ashaAllList = await http("GET", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${ashaToken}`, [H]: "undergraduate" },
  });
  const mahadAllList = await http("GET", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
  });
  const mahadAllGet = await http("GET", `${API}/api/funding-calls/${allId}`, {
    headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
  });

  const results = {
    ashaSeesUg: ashaIds.includes(String(ugId)),
    ashaNotPg: !ashaIds.includes(String(pgId)),
    mahadSeesPg: mahadIds.includes(String(pgId)),
    mahadNotUg: !mahadIds.includes(String(ugId)),
    ugCantOpenPg: ugCross.status === 403 || ugCross.status === 404,
    pgCantOpenUg: pgCross.status === 403 || pgCross.status === 404,
    ashaSeesAllCall: (ashaAllList.data?.calls || []).some((c) => String(c.id) === String(allId)),
    mahadSeesAllCall: (mahadAllList.data?.calls || []).some((c) => String(c.id) === String(allId)),
    mahadOpensAllCall: mahadAllGet.status === 200,
  };
  console.log(JSON.stringify(results, null, 2));

  await FundingCall.deleteMany({ title: { $regex: tag } });
  await mongoose.disconnect();
  const ok = Object.values(results).every(Boolean);
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
