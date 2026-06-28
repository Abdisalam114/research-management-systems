const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");

async function run() {
  await connectDB(process.env.MONGO_URI);

  const seedTitles = [
    "AI-assisted Early Disease Screening in Low-Resource Clinics",
    "Renewable Microgrid Optimization for Campus Resilience",
    "Community Water Quality Monitoring Using Low-Cost Sensors",
    "Proposal Without Document",
  ];

  const proposals = await Proposal.find({ title: { $in: seedTitles } }).select("_id title");
  const ids = proposals.map((p) => p._id);

  const projectsResult = ids.length
    ? await Project.deleteMany({ proposalId: { $in: ids } })
    : { deletedCount: 0 };

  const proposalsResult = ids.length
    ? await Proposal.deleteMany({ _id: { $in: ids } })
    : { deletedCount: 0 };

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        proposalsMatched: proposals.length,
        proposalsDeleted: proposalsResult.deletedCount || 0,
        projectsDeleted: projectsResult.deletedCount || 0,
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

