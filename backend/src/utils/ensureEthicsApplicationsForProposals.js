const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Proposal, ETHICS_STATUSES: PROPOSAL_ETHICS } = require("../models/Proposal");
const { User } = require("../models/User");
const { defaultEthicsProjectLevel } = require("./ethicsDefaults");
const { getEthicsForProposal } = require("./proposalEthicsLink");

let inFlight = null;

const SNAPSHOT_PATH = path.join(
  __dirname,
  "../../data/mongo-export/snapshot/ethicsapplications.json"
);

function fromExport(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(fromExport);
  if (typeof value !== "object") return value;
  if (value.$oid) return new mongoose.Types.ObjectId(value.$oid);
  if (value.$date) {
    const raw = value.$date.$numberLong != null ? value.$date.$numberLong : value.$date;
    return new Date(typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : raw);
  }
  if (value.$numberInt != null) return Number(value.$numberInt);
  if (value.$numberLong != null) return Number(value.$numberLong);
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "__v") continue;
    out[key] = fromExport(nested);
  }
  return out;
}

function ethicsStatusFromProposal(proposal) {
  if (proposal.ethicsStatus === PROPOSAL_ETHICS.APPROVED) return ETHICS_STATUSES.APPROVED;
  if (proposal.ethicsStatus === PROPOSAL_ETHICS.REJECTED) return ETHICS_STATUSES.REJECTED;
  if (
    proposal.ethicsStatus === PROPOSAL_ETHICS.PENDING &&
    ["submitted", "under_review", "approved"].includes(proposal.status)
  ) {
    return ETHICS_STATUSES.SUBMITTED;
  }
  return ETHICS_STATUSES.DRAFT;
}

async function findEthicsForProposal(proposal) {
  return getEthicsForProposal(proposal?._id, proposal);
}

async function recreateEthicsFromProposal(proposal) {
  const user = await User.findById(proposal.researcherId).select("fullName email department");
  const parts = String(user?.fullName || "").trim().split(/\s+/);
  const status = ethicsStatusFromProposal(proposal);
  const doc = {
    proposalId: proposal._id,
    researcherId: proposal.researcherId,
    programTier: proposal.programTier,
    projectTitle: proposal.title,
    projectLevel: defaultEthicsProjectLevel(proposal.programTier),
    aimsObjectives: proposal.abstract || "",
    status,
    principal: {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      email: user?.email || "",
      department: user?.department || proposal.department || "",
    },
    applicantSignature: { name: user?.fullName || "" },
  };
  if (proposal.ethicsApplicationId) doc._id = proposal.ethicsApplicationId;
  if (status === ETHICS_STATUSES.SUBMITTED || status === ETHICS_STATUSES.APPROVED) {
    doc.submittedAt = proposal.submittedAt || new Date();
    doc.applicantSignature.signedAt = doc.submittedAt;
  }
  if (status === ETHICS_STATUSES.APPROVED) {
    doc.approval = {
      decision: "approved",
      signedAt: new Date(),
      rejectionReason: "",
    };
  }
  try {
    const ethics = await EthicsApplication.create(doc);
    if (String(proposal.ethicsApplicationId || "") !== String(ethics._id)) {
      proposal.ethicsApplicationId = ethics._id;
      await proposal.save();
    }
    return ethics;
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await findEthicsForProposal(proposal);
      if (existing) return existing;
    }
    throw err;
  }
}

async function restoreEthicsFromSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return { restored: 0 };
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return { restored: 0 };
  }
  if (!Array.isArray(snapshot) || !snapshot.length) return { restored: 0 };

  const proposals = await Proposal.find({}).select("_id ethicsApplicationId");
  const keepIds = new Set();
  for (const p of proposals) {
    keepIds.add(String(p._id));
    if (p.ethicsApplicationId) keepIds.add(String(p.ethicsApplicationId));
  }

  let restored = 0;
  for (const raw of snapshot) {
    const doc = fromExport(raw);
    if (!doc?._id) continue;
    const proposalId = doc.proposalId ? String(doc.proposalId) : "";
    if (!keepIds.has(String(doc._id)) && !keepIds.has(proposalId)) continue;
    const exists = await EthicsApplication.findById(doc._id);
    if (exists) continue;
    try {
      await EthicsApplication.collection.insertOne(doc);
      restored += 1;
    } catch {
      /* duplicate or invalid — skip */
    }
  }
  return { restored };
}

/**
 * Re-link / recreate ethics applications that proposals still point at.
 * Keeps Research Ethical Clearance in sync with Proposals.
 */
async function ensureEthicsApplicationsForProposals(tierWhere = {}) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const snapshotResult = await restoreEthicsFromSnapshot();
    const proposals = await Proposal.find({
      ...tierWhere,
      requiresEthics: { $ne: false },
    }).select(
      "_id title abstract department status ethicsStatus ethicsApplicationId researcherId programTier submittedAt requiresEthics"
    );

    let created = 0;
    let relinked = 0;
    for (const proposal of proposals) {
      let ethics = await findEthicsForProposal(proposal);
      if (!ethics) {
        ethics = await recreateEthicsFromProposal(proposal);
        created += 1;
      } else {
        let dirty = false;
        if (!ethics.proposalId || String(ethics.proposalId) !== String(proposal._id)) {
          ethics.proposalId = proposal._id;
          dirty = true;
        }
        if (proposal.researcherId && String(ethics.researcherId) !== String(proposal.researcherId)) {
          ethics.researcherId = proposal.researcherId;
          dirty = true;
        }
        if (proposal.programTier && ethics.programTier !== proposal.programTier) {
          ethics.programTier = proposal.programTier;
          dirty = true;
        }
        if (!String(ethics.projectTitle || "").trim() && proposal.title) {
          ethics.projectTitle = proposal.title;
          dirty = true;
        }
        if (dirty) {
          await ethics.save();
          relinked += 1;
        }
      }
      if (!proposal.ethicsApplicationId || String(proposal.ethicsApplicationId) !== String(ethics._id)) {
        proposal.ethicsApplicationId = ethics._id;
        await proposal.save();
        relinked += 1;
      }
    }
    return { restored: snapshotResult.restored, created, relinked };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

module.exports = {
  ensureEthicsApplicationsForProposals,
  findEthicsForProposal,
  restoreEthicsFromSnapshot,
};
