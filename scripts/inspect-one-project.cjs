const path = require("path");
const backendRoot = path.join(__dirname, "..", "backend");
require(path.join(backendRoot, "node_modules", "dotenv")).config({ path: path.join(backendRoot, ".env") });

async function main() {
  const mongoose = require(path.join(backendRoot, "node_modules", "mongoose"));
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rms");
  require(path.join(backendRoot, "src/models/User"));
  const { Project } = require(path.join(backendRoot, "src/models/Project"));
  const { Proposal } = require(path.join(backendRoot, "src/models/Proposal"));

  const p = await Project.findOne({ title: /Research Study 2024-0/ });
  const prop = p?.proposalId ? await Proposal.findById(p.proposalId) : null;
  console.log(
    JSON.stringify(
      {
        project: p ? { id: p._id, title: p.title, proposalId: p.proposalId, researcherId: p.researcherId } : null,
        proposal: prop
          ? { id: prop._id, title: prop.title, researcherId: prop.researcherId, status: prop.status }
          : null,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(console.error);
