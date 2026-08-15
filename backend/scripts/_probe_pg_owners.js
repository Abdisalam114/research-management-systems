require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { Proposal } = require("../src/models/Proposal");
  const { Project } = require("../src/models/Project");
  const { Publication } = require("../src/models/Publication");

  const pgResearchers = await User.find({ role: "researcher", programTier: "postgraduate" })
    .select("email fullName department status")
    .lean();

  const pgProposals = await Proposal.find({ programTier: "postgraduate" })
    .populate("researcherId", "email fullName")
    .select("title status researcherId programTier createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const pgProjects = await Project.find({ programTier: "postgraduate" })
    .populate("researcherId", "email fullName")
    .select("title status researcherId programTier createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const recentAll = await Proposal.find({})
    .populate("researcherId", "email fullName programTier")
    .select("title status researcherId programTier createdAt")
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  console.log(
    JSON.stringify(
      {
        pgResearchers,
        pgProposals: pgProposals.map((p) => ({
          title: p.title,
          status: p.status,
          programTier: p.programTier,
          createdAt: p.createdAt,
          owner: p.researcherId?.email || String(p.researcherId),
        })),
        pgProjects: pgProjects.map((p) => ({
          title: p.title,
          status: p.status,
          owner: p.researcherId?.email || String(p.researcherId),
        })),
        recentProposalsAnyTier: recentAll.map((p) => ({
          title: p.title,
          status: p.status,
          programTier: p.programTier,
          owner: p.researcherId?.email,
          ownerTier: p.researcherId?.programTier,
        })),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
