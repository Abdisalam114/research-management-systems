/**
 * Sync programTier on owned records from the researcher's user.programTier.
 * Fixes PG data incorrectly tagged as UG by legacy migration.
 * Run: node src/scripts/repairProgramTierFromOwner.js
 */
const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { PROGRAM_TIERS } = require("../constants/programTier");
const { User } = require("../models/User");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { EthicsApplication } = require("../models/EthicsApplication");
const { Publication } = require("../models/Publication");
const { Grant } = require("../models/Grant");
const { ThesisGroup } = require("../models/ThesisGroup");

const OWNER_MODELS = [
  { Model: Proposal, field: "researcherId" },
  { Model: Project, field: "researcherId" },
  { Model: EthicsApplication, field: "researcherId" },
  { Model: Publication, field: "researcherId" },
  { Model: Grant, field: "researcherId" },
  { Model: ThesisGroup, field: "supervisorId" },
];

async function repair() {
  await connectDB(process.env.MONGO_URI);

  const researchers = await User.find({
    role: "researcher",
    programTier: { $in: [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE] },
  }).select("_id email programTier fullName");

  const tierByUser = new Map(researchers.map((u) => [String(u._id), u.programTier]));
  let totalFixed = 0;

  for (const { Model, field } of OWNER_MODELS) {
    const name = Model.collection.collectionName;
    const docs = await Model.find({ [field]: { $ne: null } }).select(`${field} programTier`);
    let fixed = 0;
    for (const doc of docs) {
      const ownerId = String(doc[field]);
      const expected = tierByUser.get(ownerId);
      if (!expected || doc.programTier === expected) continue;
      await Model.updateOne({ _id: doc._id }, { $set: { programTier: expected } });
      fixed += 1;
    }
    totalFixed += fixed;
    // eslint-disable-next-line no-console
    console.log(`${name}: realigned ${fixed} record(s)`);
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Total realigned: ${totalFixed}`);
  process.exit(0);
}

repair().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
