require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const API = "http://127.0.0.1:5000";
const H = "x-program-tier";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { Proposal } = require("../src/models/Proposal");
  const { User } = require("../src/models/User");
  const {
    peerReviewSentToReviewersFilter,
    peerReviewAssignedToUserFilter,
    ACTIVE_PEER_REVIEW_STATUSES,
  } = require("../src/utils/proposalReviewPipeline");

  const leadership = await User.findOne({ email: "leadership@rms.edu" });
  const pgProposals = await Proposal.find({ programTier: "postgraduate" })
    .select("title status reviewPipeline assignedReviewers peerReviews submittedAt")
    .lean();

  const ugWithAssign = await Proposal.find({
    programTier: "undergraduate",
    "assignedReviewers.0": { $exists: true },
  })
    .select("title status assignedReviewers reviewPipeline.peerReview")
    .lean();

  const allWithAssign = await Proposal.find({ "assignedReviewers.0": { $exists: true } })
    .select("title status programTier assignedReviewers reviewPipeline.peerReview")
    .lean();

  const activeUserIds = new Set(
    (await User.find({ status: "active" }).select("_id")).map((u) => String(u._id))
  );

  const orphanAssign = [];
  for (const p of allWithAssign) {
    for (const r of p.assignedReviewers || []) {
      const uid = String(r.userId);
      if (!activeUserIds.has(uid)) {
        orphanAssign.push({
          title: p.title,
          programTier: p.programTier,
          orphanId: uid,
          status: p.status,
        });
      }
    }
  }

  const directorLogin = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [H]: "postgraduate" },
    body: JSON.stringify({ email: "director@rms.edu", password: "Director2024!" }),
  }).then((r) => r.json());

  const dirPeer = await fetch(`${API}/api/proposals/my-review-assignments`, {
    headers: { Authorization: `Bearer ${directorLogin.accessToken}`, [H]: "postgraduate" },
  }).then((r) => r.json());

  const leadLogin = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [H]: "postgraduate" },
    body: JSON.stringify({ email: "leadership@rms.edu", password: "Leadership2024!" }),
  }).then((r) => r.json());

  const leadPeer = await fetch(`${API}/api/proposals/my-review-assignments`, {
    headers: { Authorization: `Bearer ${leadLogin.accessToken}`, [H]: "postgraduate" },
  }).then((r) => r.json());

  const leadPeerUg = await fetch(`${API}/api/proposals/my-review-assignments`, {
    headers: { Authorization: `Bearer ${leadLogin.accessToken}`, [H]: "undergraduate" },
  }).then((r) => r.json());

  console.log(
    JSON.stringify(
      {
        activePeerReviewStatuses: ACTIVE_PEER_REVIEW_STATUSES,
        pgProposals: pgProposals.map((p) => ({
          title: p.title,
          status: p.status,
          peerStage: p.reviewPipeline?.peerReview?.status,
          assignees: (p.assignedReviewers || []).length,
          peerReviews: (p.peerReviews || []).length,
          inActiveQueue: ACTIVE_PEER_REVIEW_STATUSES.includes(p.status),
        })),
        allWithPeerAssign: allWithAssign.map((p) => ({
          title: p.title,
          programTier: p.programTier,
          status: p.status,
          peerStage: p.reviewPipeline?.peerReview?.status,
        })),
        orphanAssign,
        apiDirectorPg: dirPeer.summary,
        apiLeadershipPg: leadPeer.summary,
        apiLeadershipUg: leadPeerUg.summary,
        leadershipUser: leadership
          ? { id: String(leadership._id), email: leadership.email, programTier: leadership.programTier }
          : null,
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
