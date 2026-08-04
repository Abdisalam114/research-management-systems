require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { Publication } = require("../src/models/Publication");
  const { Project } = require("../src/models/Project");
  const ASHA = "6a3ff89d5e972763368b79d1";
  const myProjects = await Project.find({ researcherId: ASHA }).select("_id");
  const pubs = await Publication.find({
    researcherId: ASHA,
    projectId: { $in: myProjects.map((p) => p._id) },
  });
  const foreign = pubs.filter((p) => String(p.researcherId) !== ASHA);
  const allOthers = await Publication.countDocuments({ researcherId: { $ne: ASHA } });
  const data = {
    ashaVisible: pubs.length,
    foreignInResult: foreign.length,
    othersHiddenInDb: allOthers,
  };
  fs.appendFileSync(
    path.join(__dirname, "..", "debug-f558f7.log"),
    JSON.stringify({
      sessionId: "f558f7",
      runId: "post-fix",
      hypothesisId: "H1",
      message: "simulate researcher listPublications",
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
