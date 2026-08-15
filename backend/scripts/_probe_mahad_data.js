require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { Proposal } = require("../src/models/Proposal");
  const { Project } = require("../src/models/Project");
  const { Publication } = require("../src/models/Publication");
  const { Grant } = require("../src/models/Grant");

  const mahad = await User.findOne({ email: "mahad@rms.edu" }).lean();
  if (!mahad) {
    console.log("Mahad not found");
    process.exit(1);
  }
  const uid = mahad._id;

  const [proposals, projects, pubs, grants] = await Promise.all([
    Proposal.find({ researcherId: uid }).select("title status programTier createdAt department").lean(),
    Project.find({ researcherId: uid }).select("title status programTier createdAt department").lean(),
    Publication.find({ researcherId: uid }).select("title status programTier workflowStage createdAt").lean(),
    Grant.find({ researcherId: uid }).select("title status programTier createdAt").lean(),
  ]);

  const directorPgView = {
    proposals: await Proposal.countDocuments({ programTier: "postgraduate" }),
    projects: await Project.countDocuments({ programTier: "postgraduate" }),
    publications: await Publication.countDocuments({ programTier: "postgraduate" }),
    grants: await Grant.countDocuments({ programTier: "postgraduate" }),
    mahadProposalsWrongTier: proposals.filter((p) => p.programTier !== "postgraduate"),
    mahadProjectsWrongTier: projects.filter((p) => p.programTier !== "postgraduate"),
  };

  console.log(
    JSON.stringify(
      {
        mahad: {
          id: String(uid),
          email: mahad.email,
          programTier: mahad.programTier,
          status: mahad.status,
          department: mahad.department,
        },
        mahadRecords: {
          proposals,
          projects,
          publications: pubs,
          grants,
        },
        directorPgPortalCounts: directorPgView,
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
