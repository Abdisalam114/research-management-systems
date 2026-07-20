require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { fetchItemsForUser } = require("../src/services/repositoryExportService");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const mockReq = (role, userId) => ({
    user: { role, id: userId },
    tierWhere: (f) => f,
    query: {},
  });

  const researcher = await db.collection("users").findOne({ email: "asha@rms.edu" });
  const director = await db.collection("users").findOne({ email: "director@rms.edu" });

  const researcherItems = researcher
    ? await fetchItemsForUser({ ...mockReq("researcher", researcher._id), query: {} })
    : [];
  const directorItems = director
    ? await fetchItemsForUser({ ...mockReq("research_director", director._id), query: {} })
    : [];

  const all = await db.collection("repositoryitems").find({}).toArray();
  const withProject = all.filter((i) => i.projectId).length;
  const orphans = all.length - withProject;

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "REPO3",
    message: "repository project-scoped verification",
    data: {
      totalInDb: all.length,
      withProjectId: withProject,
      orphans,
      researcherVisible: researcherItems.length,
      directorVisible: directorItems.length,
      allProjectLinked: orphans === 0,
    },
    timestamp: Date.now(),
  };

  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
