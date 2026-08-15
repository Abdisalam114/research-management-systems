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
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { Proposal } = require("../src/models/Proposal");
  const { Project } = require("../src/models/Project");

  const orphanProposals = await Proposal.find({
    programTier: "postgraduate",
    $or: [{ researcherId: null }, { researcherId: { $exists: false } }],
  }).select("title status researcherId programTier").lean();

  const badRef = await Proposal.find({ programTier: "postgraduate" })
    .select("title researcherId")
    .lean();
  const { User } = require("../src/models/User");
  const broken = [];
  for (const p of badRef) {
    if (!p.researcherId) { broken.push({ title: p.title, issue: "null researcherId" }); continue; }
    const u = await User.findById(p.researcherId);
    if (!u) broken.push({ title: p.title, issue: "missing user", researcherId: String(p.researcherId) });
  }

  const login = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "postgraduate" },
    body: { email: "director@rms.edu", password: "Director2024!" },
  });
  const token = login.data?.accessToken;
  const pgList = token
    ? await http("GET", `${API}/api/proposals/all`, {
        headers: { Authorization: `Bearer ${token}`, [H]: "postgraduate" },
      })
    : { status: 0, data: null };

  console.log(JSON.stringify({
    orphanProposals,
    broken,
    directorPgProposalApi: {
      status: pgList.status,
      count: pgList.data?.proposals?.length,
      titles: (pgList.data?.proposals || []).map((p) => p.title),
    },
    backendRunning: Boolean(token),
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
