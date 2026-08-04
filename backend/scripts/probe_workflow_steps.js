require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const projectId = new mongoose.Types.ObjectId("6a5cfc7914a8dc1c236f63b8");
  const project = await db.collection("projects").findOne({ _id: projectId });
  const proposal = project?.proposalId
    ? await db.collection("proposals").findOne({ _id: project.proposalId })
    : null;
  const publication = await db.collection("publications").findOne({ projectId });
  const grants = await db.collection("grants").find({ projectId }).toArray();
  const budget = await db.collection("budgets").findOne({ projectId });
  const repositoryItem = await db.collection("repositoryitems").findOne({ projectId });

  // Use internal builder via require and monkey - call buildSteps by reconstructing
  const journey = require("./src/utils/researchJourney");
  // Access via evaluating buildSteps - not exported. Inline copy of enforce check:
  const { PUBLICATION_STATUSES } = require("./src/models/Publication");
  const { PROPOSAL_STATUSES, ETHICS_STATUSES, PROPOSAL_KINDS } = require("./src/models/Proposal");

  // Minimal: load through controller pattern
  delete require.cache[require.resolve("./src/utils/researchJourney")];
  const rj = require("./src/utils/researchJourney");

  // Patch: call with proper mongoose docs via models
  const { Project } = require("./src/models/Project");
  const { Proposal } = require("./src/models/Proposal");
  const { Publication } = require("./src/models/Publication");
  const { Grant } = require("./src/models/Grant");

  const projDoc = await Project.findById(projectId);
  const propDoc = await Proposal.findById(project.proposalId);
  const pubDoc = await Publication.findOne({ projectId });
  const grantDocs = await Grant.find({ projectId });

  // Manually invoke logic by reading source - use buildWorkflowForProject with fixed tierWhere
  const req = {
    user: {
      role: "researcher",
      _id: new mongoose.Types.ObjectId("6a3ff89d5e972763368b79d1"),
      id: "6a3ff89d5e972763368b79d1",
    },
    programTier: "undergraduate",
    tierWhere(filter = {}) {
      return { ...filter };
    },
  };

  const wf = await rj.buildWorkflowForProject(req, projDoc);
  const data = {
    current: wf.currentStepKey,
    label: wf.currentStepLabel,
    isVoluntary: wf.isVoluntary,
    steps: (wf.steps || []).map((s) => ({ key: s.key, status: s.status, label: s.label, detail: s.detail })),
    pub: pubDoc
      ? { title: pubDoc.title, status: pubDoc.status, workflowStage: pubDoc.workflowStage }
      : null,
    projectStatus: projDoc.status,
    team: projDoc.teamMembers?.length || 0,
    milestones: projDoc.milestones?.length || 0,
    progress: projDoc.progressReports?.length || 0,
  };

  fs.appendFileSync(
    path.join(__dirname, "..", "debug-f558f7.log"),
    JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "S1",
      location: "probe_workflow_steps.js",
      message: "Benchmarking project workflow step states",
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
