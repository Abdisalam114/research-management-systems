const fs = require("fs");
const path = require("path");
const { Grant } = require("../models/Grant");
const { FundingCall } = require("../models/FundingCall");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesMatch(grantTitle, callTitle) {
  const g = norm(grantTitle);
  const c = norm(callTitle);
  if (!g || !c) return false;
  if (g === c) return true;
  if (c.startsWith(g) || g.startsWith(c)) return true;
  // shared significant token span (e.g. "Faculty Innovation Grant" vs "… Grant — Computing")
  const gWords = g.split(" ").filter((w) => w.length > 3);
  const hit = gWords.filter((w) => c.includes(w)).length;
  return gWords.length >= 2 && hit >= Math.ceil(gWords.length * 0.7);
}

function debugLog(message, data) {
  // #region agent log
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "grant-call-link",
        hypothesisId: "H4",
        location: "linkGrantsToFundingCalls.js",
        message,
        data,
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

/**
 * Link legacy/seed grants that have no callId to a FundingCall with a matching title + tier.
 */
async function linkGrantsMissingCallId(programTier) {
  // Missing / null callId only (do not query "" — ObjectId cast fails)
  const unlinkedFilter = {
    $or: [{ callId: null }, { callId: { $exists: false } }],
  };
  if (programTier) unlinkedFilter.programTier = programTier;

  const unlinked = await Grant.find(unlinkedFilter).select("_id title programTier callId");

  if (!unlinked.length) {
    debugLog("no unlinked grants", { count: 0 });
    return { linked: 0 };
  }

  const callFilter = programTier ? { programTier } : {};
  const calls = await FundingCall.find(callFilter).select("_id title programTier");
  let linked = 0;
  const samples = [];
  const unmatched = [];

  for (const grant of unlinked) {
    const sameTier = calls.filter((c) => String(c.programTier) === String(grant.programTier));
    let match = sameTier.find((c) => titlesMatch(grant.title, c.title));
    // Same portal only — never link UG grant to PG call (or vice versa)
    if (!match && !programTier) {
      match = calls.find((c) => titlesMatch(grant.title, c.title));
    }
    if (!match) {
      if (unmatched.length < 8) unmatched.push(grant.title);
      continue;
    }
    await Grant.updateOne({ _id: grant._id }, { $set: { callId: match._id } });
    linked += 1;
    if (samples.length < 8) {
      samples.push({ grant: grant.title, call: match.title, tier: grant.programTier });
    }
  }

  debugLog("linked grants to funding calls", {
    unlinkedBefore: unlinked.length,
    linked,
    samples,
    unmatched,
  });
  return { linked, unlinkedBefore: unlinked.length };
}

module.exports = { linkGrantsMissingCallId, titlesMatch };
