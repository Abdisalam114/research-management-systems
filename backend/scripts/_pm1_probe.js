require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  console.log("URI_SET", !!uri);
  if (!uri) { console.error("NO_URI"); process.exit(1); }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const RID = "6a3ff89d5e972763368b79d1";
  const CHECK_ID = "6a3ff89d5e972763368b79f5";
  const ridObj = new mongoose.Types.ObjectId(RID);

  const pubs = db.collection("publications");
  const projects = db.collection("projects");

  // Inspect getFacultyWorkflow filter from source mentally - load publication model fields
  const pubAny = await pubs.findOne({
    title: /Benchmarking Gradient Boosting for Educational Risk Prediction/i,
  });

  let projectFromPub = null;
  if (pubAny && pubAny.projectId) {
    const pid = pubAny.projectId;
    projectFromPub = await projects.findOne({
      _id: typeof pid === "string" ? new mongoose.Types.ObjectId(pid) : pid,
    });
  }

  const predProj = await projects.findOne({
    title: /Predictive Analytics for Undergraduate Course Performance/i,
  });

  // Also search pubs by title only for researcher match
  const pubAsha = pubAny && String(pubAny.researcherId) === RID ? pubAny : await pubs.findOne({
    title: /Benchmarking Gradient Boosting for Educational Risk Prediction/i,
    researcherId: ridObj,
  }) || pubAny;

  const allByAny = await pubs
    .find({ $or: [{ researcherId: ridObj }, { researcherId: RID }] })
    .project({ title: 1, projectId: 1, status: 1, isDraft: 1, researcherId: 1 })
    .toArray();

  // Simulate getFacultyWorkflow - read controller for exact filter after connecting
  const fs = require("fs");
  const ctrl = fs.readFileSync("./src/controllers/publicationController.js", "utf8");
  const gfMatch = ctrl.match(/async function getFacultyWorkflow[\s\S]*?(?=async function |\nexports\.|module\.exports)/);
  console.log("GF_SNIPPET_LEN", gfMatch ? gfMatch[0].length : 0);

  const workflowEnriched = [];
  for (const p of allByAny) {
    const st = String(p.status || "").toLowerCase();
    if (st === "draft" || p.isDraft === true) continue;
    if (p.projectId == null || p.projectId === "") continue;
    const pr = await projects.findOne({
      _id: typeof p.projectId === "string" ? new mongoose.Types.ObjectId(p.projectId) : p.projectId,
    });
    workflowEnriched.push({
      title: p.title,
      projectId: String(p.projectId),
      projectTitle: pr ? pr.title : null,
      projectStatus: pr ? pr.status : null,
      projectExists: !!pr,
      pubStatus: p.status,
    });
  }

  let byId = null;
  try {
    byId = await projects.findOne({ _id: new mongoose.Types.ObjectId(CHECK_ID) });
  } catch (e) {
    byId = { error: e.message };
  }

  let modelFind = null;
  try {
    delete require.cache[require.resolve("./src/models/Project")];
    const ProjectModel = require("./src/models/Project");
    modelFind = await ProjectModel.findById(CHECK_ID).lean();
  } catch (e) {
    modelFind = { error: String(e.message) };
  }

  // Read listProjects status filter
  const pc = fs.readFileSync("./src/controllers/projectController.js", "utf8");
  const lpMatch = pc.match(/async function listProjects[\s\S]{0,3500}/);
  console.log("---LIST_PROJECTS_SNIPPET---");
  console.log(lpMatch ? lpMatch[0].slice(0, 3000) : "NOT_FOUND");
  console.log("---GET_FACULTY_WORKFLOW_SNIPPET---");
  console.log(gfMatch ? gfMatch[0].slice(0, 2500) : "NOT_FOUND");

  const result = {
    pub: pubAsha
      ? {
          _id: String(pubAsha._id),
          title: pubAsha.title,
          status: pubAsha.status,
          isDraft: pubAsha.isDraft,
          researcherId: pubAsha.researcherId ? String(pubAsha.researcherId) : null,
          projectId: pubAsha.projectId != null ? String(pubAsha.projectId) : null,
        }
      : null,
    projectFromPub: projectFromPub
      ? {
          _id: String(projectFromPub._id),
          title: projectFromPub.title,
          status: projectFromPub.status,
          researcherId: projectFromPub.researcherId ? String(projectFromPub.researcherId) : null,
        }
      : null,
    predictiveAnalytics: predProj
      ? {
          _id: String(predProj._id),
          title: predProj.title,
          status: predProj.status,
          researcherId: predProj.researcherId ? String(predProj.researcherId) : null,
          ownerId: predProj.ownerId ? String(predProj.ownerId) : null,
          facultyId: predProj.facultyId ? String(predProj.facultyId) : null,
          userId: predProj.userId ? String(predProj.userId) : null,
          allKeys: Object.keys(predProj),
        }
      : null,
    workflowEnriched,
    allPubsForResearcher: allByAny.map((p) => ({
      title: p.title,
      projectId: p.projectId != null ? String(p.projectId) : null,
      status: p.status,
      isDraft: p.isDraft,
      researcherId: p.researcherId ? String(p.researcherId) : null,
    })),
    projectByCheckId: byId
      ? byId.error
        ? byId
        : {
            _id: String(byId._id),
            title: byId.title,
            status: byId.status,
            researcherId: byId.researcherId ? String(byId.researcherId) : null,
          }
      : null,
    modelFindById: modelFind
      ? modelFind.error
        ? modelFind
        : {
            _id: String(modelFind._id),
            title: modelFind.title,
            status: modelFind.status,
          }
      : null,
  };

  console.log("---RESULT_JSON---");
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});