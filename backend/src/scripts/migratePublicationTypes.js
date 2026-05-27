const mongoose = require("mongoose");
const { LEGACY_PUBLICATION_TYPE_MAP } = require("../models/Publication");

async function migrateLegacyPublicationTypes() {
  const col = mongoose.connection.collection("publications");
  let total = 0;
  for (const [oldType, newType] of Object.entries(LEGACY_PUBLICATION_TYPE_MAP)) {
    const result = await col.updateMany({ type: oldType }, { $set: { type: newType } });
    total += result.modifiedCount || 0;
  }
  if (total > 0) {
    // eslint-disable-next-line no-console
    console.log(`Migrated publication type for ${total} document(s)`);
  }
}

module.exports = { migrateLegacyPublicationTypes };
