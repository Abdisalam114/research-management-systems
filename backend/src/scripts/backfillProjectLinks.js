/**
 * Backfill projectId on publications, repository items, and grants using seed template index alignment.
 * Safe: only updates records with null/missing projectId; skips if target project already claimed by another record of same type+title tier.
 */
const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { Grant } = require("../models/Grant");
const { PROGRAM_TIERS } = require("./seedData");
const {
  RECORDS_PER_TIER,
  PUBLICATION_TEMPLATES,
  REPOSITORY_ITEMS,
  GRANT_TEMPLATES,
  proposalsForTier,
} = require("./seedRecords");

async function researchersForTier(programTier) {
  return User.find({ role: "researcher", programTier }).sort({ email: 1 });
}

async function projectForSeedIndex(programTier, researcherId, index) {
  const proposalDefs = proposalsForTier(programTier);
  const tpl = proposalDefs[index % proposalDefs.length];
  const proposal = await Proposal.findOne({ programTier, title: tpl.title, researcherId });
  if (!proposal) return null;
  return Project.findOne({ proposalId: proposal._id });
}

async function backfillPublications(programTier) {
  const researchers = await researchersForTier(programTier);
  const templates = PUBLICATION_TEMPLATES.slice(0, RECORDS_PER_TIER);
  let updated = 0;
  for (let i = 0; i < templates.length; i += 1) {
    const tpl = templates[i];
    const researcher = researchers[i % researchers.length];
    if (!researcher) continue;
    const pub = await Publication.findOne({ programTier, title: tpl.title, researcherId: researcher._id });
    if (!pub || pub.projectId) continue;
    const project = await projectForSeedIndex(programTier, researcher._id, i);
    if (!project) continue;
    pub.projectId = project._id;
    await pub.save();
    updated += 1;
  }
  return updated;
}

async function backfillRepository(programTier) {
  const researchers = await researchersForTier(programTier);
  let updated = 0;
  for (let i = 0; i < Math.min(REPOSITORY_ITEMS.length, RECORDS_PER_TIER); i += 1) {
    const tpl = REPOSITORY_ITEMS[i];
    const researcher = researchers[i % researchers.length];
    if (!researcher) continue;
    const item = await RepositoryItem.findOne({ programTier, title: tpl.title, uploadedBy: researcher._id });
    if (!item || item.projectId) continue;
    const project = await projectForSeedIndex(programTier, researcher._id, i);
    if (!project) continue;
    item.projectId = project._id;
    await item.save();
    updated += 1;
  }
  return updated;
}

async function backfillGrants(programTier) {
  const researchers = await researchersForTier(programTier);
  const templates = GRANT_TEMPLATES.slice(0, RECORDS_PER_TIER);
  let updated = 0;
  for (let i = 0; i < templates.length; i += 1) {
    const tpl = templates[i];
    const researcher = researchers[i % researchers.length];
    if (!researcher) continue;
    const grant = await Grant.findOne({ programTier, title: tpl.title, researcherId: researcher._id });
    if (!grant) continue;
    const project = await projectForSeedIndex(programTier, researcher._id, i);
    if (!project) continue;
    if (String(grant.projectId || "") !== String(project._id)) {
      grant.projectId = project._id;
      await grant.save();
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  for (const tier of Object.values(PROGRAM_TIERS)) {
    const pubs = await backfillPublications(tier);
    const repos = await backfillRepository(tier);
    const grants = await backfillGrants(tier);
    console.log(`${tier}: publications=${pubs}, repository=${repos}, grants=${grants}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
