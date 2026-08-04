/** Verify batch 3 fixes: funding calls all-tier, user edit, profile mine pubs. */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "../../debug-f558f7.log");
const API = "http://127.0.0.1:5000";
const H = "x-program-tier";

function log(hypothesisId, message, data) {
  const e = { sessionId: "f558f7", runId: "batch3", hypothesisId, location: "_verify_batch3.js", message, data, timestamp: Date.now() };
  console.log(JSON.stringify(e));
  fs.appendFileSync(LOG, `${JSON.stringify(e)}\n`);
}

async function http(method, url, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { FundingCall, CALL_STATUSES } = require("../src/models/FundingCall");

  const dirLogin = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "director@rms.edu", password: "Director2024!" },
  });
  const dirToken = dirLogin.data?.accessToken;

  const ashaLogin = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "asha@rms.edu", password: "Researcher2024!" },
  });
  const ashaToken = ashaLogin.data?.accessToken;

  const mahadLogin = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "postgraduate" },
    body: { email: "mahad@rms.edu", password: "Researcher2024!" },
  });
  const mahadToken = mahadLogin.data?.accessToken;

  // Create + publish all-tier call on UG portal
  const create = await http("POST", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: {
      title: `_verify_all_tier_${Date.now()}`,
      fundingSource: "JUST Internal",
      eligibilityTier: "all",
      programTier: "undergraduate",
      amountCap: 5000,
    },
  });
  const callId = create.data?.call?.id;
  let publishOk = false;
  let pgGetOk = false;
  let ugGetOk = false;
  if (callId) {
    const pub = await http("POST", `${API}/api/funding-calls/${callId}/publish`, {
      headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    });
    publishOk = pub.status === 200;
    const pgGet = await http("GET", `${API}/api/funding-calls/${callId}`, {
      headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
    });
    pgGetOk = pgGet.status === 200;
    const ugGet = await http("GET", `${API}/api/funding-calls/${callId}`, {
      headers: { Authorization: `Bearer ${ashaToken}`, [H]: "undergraduate" },
    });
    ugGetOk = ugGet.status === 200;
    await FundingCall.deleteOne({ _id: callId });
  }
  log("H2", "funding call all-tier PG+UG", { createStatus: create.status, publishOk, pgGetOk, ugGetOk });

  const mahad = await User.findOne({ email: "mahad@rms.edu" });
  const asha = await User.findOne({ email: "asha@rms.edu" });
  const editMahad = await http("PUT", `${API}/api/users/${mahad._id}`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: { rank: mahad.rank, programTier: "postgraduate", department: mahad.department },
  });
  const editAsha = await http("PUT", `${API}/api/users/${asha._id}`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: { rank: asha.rank, programTier: "undergraduate", department: asha.department },
  });
  log("H3", "edit both researchers", {
    mahadStatus: editMahad.status,
    ashaStatus: editAsha.status,
    mahadOk: editMahad.status === 200,
    ashaOk: editAsha.status === 200,
  });

  const profilePubs = await http("GET", `${API}/api/publications?mine=1`, {
    headers: { Authorization: `Bearer ${ashaToken}`, [H]: "undergraduate" },
  });
  log("H4", "profile mine publications", {
    status: profilePubs.status,
    count: profilePubs.data?.publications?.length ?? 0,
  });

  const financeLogin = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "finance@rms.edu", password: "Finance2024!" },
  });
  const finPubs = await http("GET", `${API}/api/publications?mine=1`, {
    headers: { Authorization: `Bearer ${financeLogin.data?.accessToken}`, [H]: "undergraduate" },
  });
  log("H4", "non-researcher mine publications blocked by role filter", {
    status: finPubs.status,
    count: finPubs.data?.publications?.length ?? 0,
    note: "finance gets staff list not mine",
  });

  const allOk = publishOk && pgGetOk && ugGetOk && editMahad.status === 200 && editAsha.status === 200;
  log("SUMMARY", "batch3 verification", { allOk });

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
