/**
 * Fix demo researcher display names (single name, no wrong alias).
 * Run: node src/scripts/fixResearcherDisplayNames.js
 */
const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { EthicsApplication } = require("../models/EthicsApplication");

const NAME_FIXES = Object.freeze({
  "asha@rms.edu": "Sarah Chen",
  "mahad@rms.edu": "Mahad Hassan",
});

async function fix() {
  await connectDB(process.env.MONGO_URI);

  for (const [email, fullName] of Object.entries(NAME_FIXES)) {
    const user = await User.findOne({ email });
    if (!user) {
      // eslint-disable-next-line no-console
      console.log(`Skip ${email} — user not found`);
      continue;
    }
    user.fullName = fullName;
    await user.save();
    const parts = fullName.trim().split(/\s+/);
    const ethicsRes = await EthicsApplication.updateMany(
      { researcherId: user._id },
      {
        $set: {
          "principal.firstName": parts[0] || "",
          "principal.lastName": parts.slice(1).join(" ") || "",
          "applicantSignature.name": fullName,
        },
      }
    );
    // eslint-disable-next-line no-console
    console.log(`${email} → "${fullName}" (ethics updated: ${ethicsRes.modifiedCount})`);
  }

  process.exit(0);
}

fix().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
