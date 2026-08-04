/**
 * Verify UG/PG data isolation — prints per-tier counts and cross-tier mismatches.
 * Run: node src/scripts/verifyProgramTierIsolation.js
 */
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
dotenv.config();

const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Publication } = require("../models/Publication");
const { FundingCall } = require("../models/FundingCall");
const { Notification } = require("../models/Notification");

const LOG_PATH = path.join(__dirname, "../../../debug-f558f7.log");

function agentLog(payload) {
  const line = JSON.stringify({ sessionId: "f558f7", timestamp: Date.now(), ...payload }) + "\n";
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    /* ignore */
  }
}

async function countMismatch(Model, ownerField, label) {
  const researchers = await User.find({ role: "researcher" }).select("_id programTier email");
  const tierByUser = new Map(researchers.map((u) => [String(u._id), u.programTier]));
  const docs = await Model.find({ [ownerField]: { $ne: null } }).select(`${ownerField} programTier title`);
  let mismatches = 0;
  for (const doc of docs) {
    const expected = tierByUser.get(String(doc[ownerField]));
    if (expected && doc.programTier && doc.programTier !== expected) mismatches += 1;
  }
  return { label, total: docs.length, mismatches };
}

async function verify() {
  await connectDB(process.env.MONGO_URI);

  const ugProposals = await Proposal.countDocuments({ programTier: "undergraduate" });
  const pgProposals = await Proposal.countDocuments({ programTier: "postgraduate" });
  const ugProjects = await Project.countDocuments({ programTier: "undergraduate" });
  const pgProjects = await Project.countDocuments({ programTier: "postgraduate" });

  const checks = await Promise.all([
    countMismatch(Proposal, "researcherId", "proposals"),
    countMismatch(Project, "researcherId", "projects"),
    countMismatch(Publication, "researcherId", "publications"),
  ]);

  const summary = {
    ugProposals,
    pgProposals,
    ugProjects,
    pgProjects,
    checks,
    fundingCalls: {
      ug: await FundingCall.countDocuments({ programTier: "undergraduate" }),
      pg: await FundingCall.countDocuments({ programTier: "postgraduate" }),
    },
  };

  agentLog({
    hypothesisId: "TIER_ISO",
    location: "verifyProgramTierIsolation.js",
    message: "tier isolation audit",
    data: summary,
    runId: "post-fix",
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

verify().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
