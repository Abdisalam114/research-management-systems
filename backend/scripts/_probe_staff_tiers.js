require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, '..', '..', 'debug-f558f7.log');
function log(message, data) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: 'f558f7',
      runId: 'pg-review-fix',
      hypothesisId: 'PG1',
      location: 'probe_staff_tiers',
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rms');
  const { User } = require('../src/models/User');
  const staff = await User.find({
    role: { $in: ['leadership', 'research_director', 'finance_officer', 'faculty_coordinator'] },
  })
    .select('email role status programTier fullName')
    .lean();
  const ugLead = await User.find({ role: 'leadership', status: 'active', programTier: 'undergraduate' }).countDocuments();
  const pgLead = await User.find({ role: 'leadership', status: 'active', programTier: 'postgraduate' }).countDocuments();
  const nullLead = await User.find({
    role: 'leadership',
    status: 'active',
    $or: [{ programTier: null }, { programTier: { $exists: false } }, { programTier: '' }],
  }).countDocuments();
  const payload = {
    staff,
    ugLead,
    pgLead,
    nullLead,
    hypothesis:
      'PG assign fails because listUsers/assignReviewers use tierWhere on cross-tier Leadership users',
  };
  log('staff programTier', payload);
  console.log(JSON.stringify(payload, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
