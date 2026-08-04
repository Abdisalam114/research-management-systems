require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, '..', '..', 'debug-f558f7.log');
function log(hypothesisId, message, data) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: 'f558f7',
      runId: 'pg-review-fix',
      hypothesisId,
      location: '_probe_pg_review.js',
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rms');
  const { Proposal } = require('../src/models/Proposal');
  const { User } = require('../src/models/User');
  const {
    ACTIVE_PEER_REVIEW_STATUSES,
    peerReviewSentToReviewersFilter,
    peerReviewAssignedToUserFilter,
  } = require('../src/utils/proposalReviewPipeline');

  const leadership = await User.findOne({ email: 'leadership@rms.edu' }).select('_id email role programTier');
  const director = await User.findOne({ email: 'director@rms.edu' }).select('_id email role');

  for (const tier of ['undergraduate', 'postgraduate']) {
    const all = await Proposal.find({ programTier: tier })
      .select('title status assignedReviewers peerReviews reviewPipeline.peerReview.status researcherId')
      .populate('assignedReviewers.userId', 'email role')
      .lean();
    const active = all.filter((p) => ACTIVE_PEER_REVIEW_STATUSES.includes(p.status));
    const withAssignees = all.filter((p) => (p.assignedReviewers || []).length > 0);
    const directorQ = await Proposal.find(
      peerReviewSentToReviewersFilter({ programTier: tier })
    ).select('title status');
    const leadQ = leadership
      ? await Proposal.find(
          peerReviewAssignedToUserFilter(leadership._id, { programTier: tier })
        ).select('title status')
      : [];

    const payload = {
      tier,
      totalProposals: all.length,
      byStatus: all.reduce((a, p) => {
        a[p.status] = (a[p.status] || 0) + 1;
        return a;
      }, {}),
      activeCount: active.length,
      withAssignees: withAssignees.map((p) => ({
        title: p.title,
        status: p.status,
        reviewers: (p.assignedReviewers || []).map((r) => r.userId?.email || String(r.userId)),
        peerStage: p.reviewPipeline?.peerReview?.status,
        peerReviews: (p.peerReviews || []).length,
      })),
      directorQueue: directorQ.map((p) => `${p.title}|${p.status}`),
      leadershipQueue: leadQ.map((p) => `${p.title}|${p.status}`),
      titles: all.map((p) => `${p.title}|${p.status}|assignees=${(p.assignedReviewers || []).length}`),
    };
    log(tier === 'undergraduate' ? 'UG' : 'PG', 'tier review snapshot', payload);
    console.log(JSON.stringify(payload, null, 2));
  }

  // Leadership users available for assign (any programTier?)
  const leaders = await User.find({ role: 'leadership', status: 'active' })
    .select('email fullName programTier status')
    .lean();
  log('L', 'leadership users', { leaders });

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
