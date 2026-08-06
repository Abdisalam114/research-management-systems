require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const OLD_MAHAD_ID = "6a3ff89d5e972763368b79d5";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { Proposal } = require("../src/models/Proposal");
  const { Project } = require("../src/models/Project");
  const { Publication } = require("../src/models/Publication");
  const { Grant } = require("../src/models/Grant");
  const { EthicsApplication } = require("../src/models/EthicsApplication");

  const mahad = await User.findOne({ email: "mahad@rms.edu" });
  if (!mahad) throw new Error("mahad@rms.edu not found");

  const filter = { researcherId: new mongoose.Types.ObjectId(OLD_MAHAD_ID) };
  const counts = {
    proposals: await Proposal.countDocuments(filter),
    projects: await Project.countDocuments(filter),
    publications: await Publication.countDocuments(filter),
    grants: await Grant.countDocuments(filter),
    ethics: await EthicsApplication.countDocuments(filter),
  };

  console.log("Before relink:", counts);
  console.log("Mahad new id:", String(mahad._id));

  const updates = await Promise.all([
    Proposal.updateMany(filter, { $set: { researcherId: mahad._id } }),
    Project.updateMany(filter, { $set: { researcherId: mahad._id } }),
    Publication.updateMany(filter, { $set: { researcherId: mahad._id } }),
    Grant.updateMany(filter, { $set: { researcherId: mahad._id } }),
    EthicsApplication.updateMany(filter, { $set: { researcherId: mahad._id } }),
  ]);

  console.log(
    JSON.stringify(
      {
        relinked: {
          proposals: updates[0].modifiedCount,
          projects: updates[1].modifiedCount,
          publications: updates[2].modifiedCount,
          grants: updates[3].modifiedCount,
          ethics: updates[4].modifiedCount,
        },
        mahadNow: {
          proposals: await Proposal.countDocuments({ researcherId: mahad._id }),
          projects: await Project.countDocuments({ researcherId: mahad._id }),
        },
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
