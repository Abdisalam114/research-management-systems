/**
 * Repair inconsistent funding-call / grant / finance demo data.
 * Usage: node src/scripts/repairFundCallFinanceData.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { connectDB } = require("../config/db");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Budget } = require("../models/Budget");
const { syncGrantBudgets } = require("../utils/syncGrantBudgets");
const { closeExpiredOpenCalls } = require("../utils/fundingCallAutoClose");
const { linkGrantsMissingCallId } = require("../utils/linkGrantsToFundingCalls");
const { STAGE_STATUS } = require("../utils/proposalReviewPipeline");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function log(message, data) {
  const line = JSON.stringify({
    sessionId: "f558f7",
    runId: "repair-data",
    hypothesisId: "R1",
    location: "repairFundCallFinanceData.js",
    message,
    data,
    timestamp: Date.now(),
  });
  console.log(line);
  try {
    fs.appendFileSync(DEBUG_LOG, `${line}\n`);
  } catch {
    /* ignore */
  }
}

async function main() {
  await connectDB(process.env.MONGODB_URI || process.env.MONGO_URI);

  const expired = await closeExpiredOpenCalls({ actorRole: "system" });
  const linked = await linkGrantsMissingCallId();
  const budgets = await syncGrantBudgets();

  // Close calls that already have an accepted fund-call proposal or finance-authorized grant
  const acceptedProps = await Proposal.find({
    status: PROPOSAL_STATUSES.APPROVED,
    fundingCallId: { $ne: null },
  }).select("_id title fundingCallId");

  const authorizedGrants = await Grant.find({
    callId: { $ne: null },
    status: { $in: [GRANT_STATUSES.PENDING_FINANCE, GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED] },
    proposalId: { $ne: null },
  }).select("_id title callId status proposalId");

  const callIdsToClose = new Set([
    ...acceptedProps.map((p) => String(p.fundingCallId)),
    ...authorizedGrants.map((g) => String(g.callId)),
  ]);

  let callsClosed = 0;
  for (const id of callIdsToClose) {
    const call = await FundingCall.findById(id);
    if (!call || call.status !== CALL_STATUSES.OPEN) continue;
    call.status = CALL_STATUSES.CLOSED;
    call.closedAt = call.closedAt || new Date();
    await call.save();
    callsClosed += 1;
  }

  // Soft-pass financeReview on approved fund-call proposals (Director already accepted)
  let financeStagesFixed = 0;
  for (const p of acceptedProps) {
    const full = await Proposal.findById(p._id);
    if (!full?.reviewPipeline) continue;
    const fr = full.reviewPipeline.financeReview;
    if (fr && fr.status !== STAGE_STATUS.PASSED && fr.status !== STAGE_STATUS.FAILED) {
      full.reviewPipeline.financeReview = {
        status: STAGE_STATUS.PASSED,
        completedAt: new Date(),
        completedBy: null,
        decision: "authorized_with_grant",
        comment: "Aligned with Director acceptance + finance budget authorization workflow",
      };
      full.markModified("reviewPipeline");
      await full.save();
      financeStagesFixed += 1;
    }
  }

  // Clean stale compliance notes on authorized grants
  const staleNotes = await Grant.updateMany(
    {
      status: GRANT_STATUSES.ACTIVE,
      complianceNotes: /awaiting finance approval/i,
    },
    {
      $set: {
        complianceNotes: "Funding-call award authorized by finance — budget allocated (not paid).",
      },
    }
  );

  // Ensure authorized budgets have totalDisbursed set (0 if never paid)
  const authGrantIds = (
    await Grant.find({
      status: GRANT_STATUSES.ACTIVE,
      proposalId: { $ne: null },
      callId: { $ne: null },
    }).select("_id")
  ).map((g) => g._id);

  let budgetsTouched = 0;
  for (const gid of authGrantIds) {
    const b = await Budget.findOne({ grantId: gid });
    if (!b) continue;
    if (b.totalDisbursed == null) {
      b.totalDisbursed = 0;
      await b.save();
      budgetsTouched += 1;
    }
  }

  // Reconcile disbursed from paid line items (never invent payments)
  const allBudgets = await Budget.find({});
  let reconciled = 0;
  for (const b of allBudgets) {
    const itemPaid = (b.items || [])
      .filter((i) => i.status === "paid")
      .reduce((a, i) => a + Number(i.amount || 0), 0);
    const current = Number(b.totalDisbursed || 0);
    // If no payments/POs tracked on items and stored > item paid with empty payments history,
    // keep stored when seed data is intentional; only fix nulls above.
    if (itemPaid > current + 1e-9) {
      b.totalDisbursed = itemPaid;
      await b.save();
      reconciled += 1;
    }
  }

  const summary = {
    expiredClosed: expired.closedCount,
    grantsLinked: linked.linked,
    budgetsSynced: budgets,
    callsClosedAfterAccept: callsClosed,
    financeStagesFixed,
    staleNotesUpdated: staleNotes.modifiedCount || 0,
    budgetsTouched,
    disbursedReconciled: reconciled,
  };
  log("repair complete", summary);
  console.log("\nRepair summary:", summary);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
