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
      location: '_verify_pg_leadership_visible.js',
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rms');
  const { User, ROLES } = require('../src/models/User');
  const { userWhere } = require('../src/utils/programTierScope');

  for (const tier of ['undergraduate', 'postgraduate']) {
    const req = { programTier: tier };
    const filter = { role: ROLES.LEADERSHIP, status: 'active' };
    const oldStyle = { ...filter, programTier: tier };
    const newStyle = userWhere(req, filter);
    const oldCount = await User.countDocuments(oldStyle);
    const newCount = await User.countDocuments(newStyle);
    const users = await User.find(newStyle).select('email programTier').lean();
    log('leadership visibility', {
      portal: tier,
      oldTierFilterCount: oldCount,
      newUserWhereCount: newCount,
      emails: users.map((u) => u.email),
      fixed: newCount > 0 && (tier === 'postgraduate' ? oldCount === 0 : true),
    });
    console.log(JSON.stringify({ tier, oldCount, newCount, emails: users.map((u) => u.email) }));
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
