/**
 * Tags existing records with programTier=undergraduate (legacy default).
 * Run: node src/scripts/migrateProgramTier.js
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
const { Budget } = require("../models/Budget");
const { Payment } = require("../models/Payment");
const { PurchaseOrder } = require("../models/PurchaseOrder");
const { RepositoryItem } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { ThesisGroup } = require("../models/ThesisGroup");
const { Department } = require("../models/Department");
const { Notification } = require("../models/Notification");
const { Conversation } = require("../models/Conversation");

const MODELS = [
  User,
  Proposal,
  Project,
  EthicsApplication,
  Publication,
  Grant,
  Budget,
  Payment,
  PurchaseOrder,
  RepositoryItem,
  ResearchGroup,
  ThesisGroup,
  Department,
  Notification,
  Conversation,
];

async function migrate() {
  await connectDB(process.env.MONGO_URI);
  const tier = PROGRAM_TIERS.UNDERGRADUATE;

  for (const Model of MODELS) {
    const name = Model.collection.collectionName;
    const res = await Model.updateMany(
      { $or: [{ programTier: { $exists: false } }, { programTier: null }, { programTier: "" }] },
      { $set: { programTier: tier } }
    );
    // eslint-disable-next-line no-console
    console.log(`${name}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // Postgraduate portal tagging for bootstrap accounts
  await User.updateMany(
    { email: { $in: ["mahad@rms.edu", "amina@rms.edu", "coordinator.pg@rms.edu", "finance.pg@rms.edu"] } },
    { $set: { programTier: PROGRAM_TIERS.POSTGRADUATE } }
  );

  await User.updateMany(
    { email: { $in: ["asha@rms.edu", "sahra@rms.edu", "coordinator@rms.edu", "finance@rms.edu"] } },
    { $set: { programTier: PROGRAM_TIERS.UNDERGRADUATE } }
  );

  // eslint-disable-next-line no-console
  console.log("Program tier migration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
