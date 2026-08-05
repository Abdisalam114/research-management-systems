/** Verify batch 4 fixes. node backend/scripts/_verify_batch4.js */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "../../debug-f558f7.log");
const API = "http://127.0.0.1:5000";
const H = "x-program-tier";

function log(hypothesisId, message, data) {
  const e = { sessionId: "f558f7", runId: "batch4", hypothesisId, location: "_verify_batch4.js", message, data, timestamp: Date.now() };
  console.log(JSON.stringify(e));
  fs.appendFileSync(LOG, `${JSON.stringify(e)}\n`);
}

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
  const { User } = require("../src/models/User");
  const { FundingCall, CALL_STATUSES } = require("../src/models/FundingCall");
  const { ThesisGroup, THESIS_STATUSES } = require("../src/models/ThesisGroup");

  const dir = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "director@rms.edu", password: "Director2024!" },
  });
  const dirToken = dir.data?.accessToken;

  const mahad = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "postgraduate" },
    body: { email: "mahad@rms.edu", password: "Researcher2024!" },
  });
  const mahadToken = mahad.data?.accessToken;

  const create = await http("POST", `${API}/api/funding-calls`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
    body: {
      title: `_verify_batch4_${Date.now()}`,
      fundingSource: "JUST",
      eligibilityTier: "all",
      programTier: "undergraduate",
    },
  });
  const callId = create.data?.call?.id;
  await http("POST", `${API}/api/funding-calls/${callId}/publish`, {
    headers: { Authorization: `Bearer ${dirToken}`, [H]: "undergraduate" },
  });
  const pgGet = await http("GET", `${API}/api/funding-calls/${callId}`, {
    headers: { Authorization: `Bearer ${mahadToken}`, [H]: "postgraduate" },
  });
  log("H5", "funding call PG open", { status: pgGet.status, ok: pgGet.status === 200 });
  await FundingCall.deleteOne({ _id: callId });

  const group = await ThesisGroup.findOne({ status: THESIS_STATUSES.IN_PROGRESS });
  let futureMeetingBlocked = false;
  if (group) {
    const sup = group.supervisorId;
    const supUser = await User.findById(sup);
    if (supUser) {
      const login = await http("POST", `${API}/api/auth/login`, {
        headers: { [H]: group.programTier || "undergraduate" },
        body: { email: supUser.email, password: "Researcher2024!" },
      }).catch(() => null);
      if (login?.data?.accessToken) {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const bad = await http("POST", `${API}/api/thesis-groups/${group._id}/meetings`, {
          headers: { Authorization: `Bearer ${login.data.accessToken}`, [H]: group.programTier || "undergraduate" },
          body: { date: future.toISOString().slice(0, 10), agenda: "test" },
        });
        futureMeetingBlocked = bad.status === 400;
      }
    }
    group.status = THESIS_STATUSES.COMPLETED;
    await group.save();
    log("H1", "thesis meeting guards", { futureMeetingBlocked, groupId: String(group._id) });
    group.status = THESIS_STATUSES.IN_PROGRESS;
    await group.save();
  }

  const allOk = pgGet.status === 200 && (futureMeetingBlocked || !group);
  log("SUMMARY", "batch4", { allOk });
  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
