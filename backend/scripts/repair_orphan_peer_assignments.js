/**
 * Re-link orphaned peer assignments (deleted peer_reviewer) to leadership@rms.edu
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { Proposal } = require("../src/models/Proposal");
const { User } = require("../src/models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const leadership = await User.findOne({ email: "leadership@rms.edu" });
  if (!leadership) throw new Error("leadership@rms.edu not found");

  const activeIds = new Set(
    (await User.find({ status: "active" }).select("_id")).map((u) => String(u._id))
  );

  let fixed = 0;
  const proposals = await Proposal.find({ "assignedReviewers.0": { $exists: true } });
  for (const p of proposals) {
    let changed = false;
    p.assignedReviewers = (p.assignedReviewers || []).map((r) => {
      const uid = String(r.userId);
      if (!activeIds.has(uid)) {
        changed = true;
        return { ...r.toObject?.() || r, userId: leadership._id, assignedAt: r.assignedAt || new Date() };
      }
      return r;
    });
    if (changed) {
      await p.save();
      fixed += 1;
    }
  }
  console.log(JSON.stringify({ fixed, leadershipId: String(leadership._id) }, null, 2));
  await mongoose.disconnect();
})();
