const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { ResearchGroup, GROUP_MEMBER_ROLES } = require("../models/ResearchGroup");
const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { Notification } = require("../models/Notification");

async function run() {
  await connectDB(process.env.MONGO_URI);

  const researcher = await User.findOne({ email: "asha@just.edu" });
  const director = await User.findOne({ email: "director@just.edu" }) || (await User.findOne({ email: "admin@rms.edu" }));

  if (!researcher) {
    console.error("Run npm run seed:demo first (needs asha@just.edu).");
    process.exit(1);
  }

  await Grant.deleteMany({ title: { $regex: /^SEED:/ } });
  await Publication.deleteMany({ title: { $regex: /^SEED:/ } });
  await Budget.deleteMany({ financeNotes: "SEED_MODULE" });
  await ResearchGroup.deleteMany({ name: { $regex: /^SEED:/ } });
  await RepositoryItem.deleteMany({ title: { $regex: /^SEED:/ } });

  const grant = await Grant.create({
    title: "SEED: Campus Innovation Grant",
    fundingSource: "JUST Research Fund",
    amountRequested: 25000,
    currency: "USD",
    researcherId: researcher._id,
    status: GRANT_STATUSES.SUBMITTED,
    submittedAt: new Date(),
  });

  await Budget.create({
    grantId: grant._id,
    ownerResearcherId: researcher._id,
    totalAllocated: 25000,
    currency: "USD",
    financeNotes: "SEED_MODULE",
    items: [
      {
        type: BUDGET_ITEM_TYPES.EXPENSE,
        description: "SEED: Lab consumables",
        amount: 1200,
        status: BUDGET_ITEM_STATUSES.PENDING,
        createdBy: researcher._id,
      },
    ],
  });

  await Publication.insertMany([
    {
      title: "SEED: ML Screening in Low-Resource Clinics",
      type: "journal_article",
      year: 2025,
      researcherId: researcher._id,
      status: PUBLICATION_STATUSES.SUBMITTED,
    },
    {
      title: "SEED: Microgrid Optimization Review",
      type: "conference_paper",
      year: 2024,
      researcherId: researcher._id,
      status: PUBLICATION_STATUSES.VALIDATED,
    },
  ]);

  await ResearchGroup.create({
    name: "SEED: AI & Health Research Group",
    description: "Demo collaboration group",
    createdBy: researcher._id,
    members: [{ userId: researcher._id, role: GROUP_MEMBER_ROLES.LEAD }],
  });

  await RepositoryItem.create({
    type: "document",
    title: "SEED: Pilot Study Protocol",
    description: "Sample repository document",
    filePath: "/uploads/seed-placeholder.txt",
    fileSize: 0,
    access: REPOSITORY_ACCESS.INSTITUTION,
    uploadedBy: researcher._id,
  });

  const notifyTargets = [director, await User.findOne({ email: "admin@rms.edu" })].filter(Boolean);
  for (const u of notifyTargets) {
    await Notification.create({
      userId: u._id,
      type: "grant",
      title: "SEED: Grant awaiting review",
      body: grant.title,
      link: "/grants",
    });
  }

  console.log("Seeded modules: grants, budgets, publications, groups, repository, notifications.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
