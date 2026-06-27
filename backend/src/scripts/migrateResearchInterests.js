const mongoose = require("mongoose");
const { normalizeResearchInterests } = require("../models/User");

async function migrateLegacyResearchInterests() {
  const col = mongoose.connection.collection("users");
  const cursor = col.find({ researchInterests: { $type: "array" } });

  let updated = 0;
  for await (const doc of cursor) {
    await col.updateOne(
      { _id: doc._id },
      { $set: { researchInterests: normalizeResearchInterests(doc.researchInterests) } }
    );
    updated += 1;
  }

  if (updated > 0) {
    // eslint-disable-next-line no-console
    console.log(`Migrated researchInterests for ${updated} user(s)`);
  }
}

module.exports = { migrateLegacyResearchInterests };
