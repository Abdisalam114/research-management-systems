const dotenv = require("dotenv");
dotenv.config();

const fs = require("fs");
const path = require("path");
const { connectDB } = require("../config/db");
const { Proposal } = require("../models/Proposal");

async function run() {
  await connectDB(process.env.MONGO_URI);

  // 1) Null out any proposal documents that point to our generated PDFs
  const docs = await Proposal.find({ document: { $regex: "^/uploads/seeded-paper-" } }).select("_id document");
  const ids = docs.map((d) => d._id);
  if (ids.length) {
    await Proposal.updateMany({ _id: { $in: ids } }, { $set: { document: null } });
  }

  // 2) Delete the generated files from /uploads
  const uploadsDir = path.join(process.cwd(), "uploads");
  let deleted = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      if (!f.startsWith("seeded-paper-")) continue;
      const fp = path.join(uploadsDir, f);
      try {
        fs.unlinkSync(fp);
        deleted += 1;
      } catch {
        // ignore per-file errors
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        proposalsUpdated: ids.length,
        filesDeleted: deleted,
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

