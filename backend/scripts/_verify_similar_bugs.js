const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "../../.cursor/debug-f558f7.log");

function log(hypothesisId, message, data) {
  const entry = {
    sessionId: "f558f7",
    runId: "similar-bugs",
    hypothesisId,
    location: "_verify_similar_bugs.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(entry));
  try {
    fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
}

const root = path.join(__dirname, "..");
const fe = path.join(root, "../frontend/src");

const financePage = fs.readFileSync(
  path.join(fe, "pages/FinanceProposalReviewsPage.jsx"),
  "utf8"
);
const grantCtrl = fs.readFileSync(
  path.join(root, "src/controllers/grantController.js"),
  "utf8"
);
const reviewCtrl = fs.readFileSync(
  path.join(root, "src/controllers/proposalReviewController.js"),
  "utf8"
);
const repoRoutes = fs.readFileSync(
  path.join(root, "src/routes/repositoryRoutes.js"),
  "utf8"
);
const propRoutes = fs.readFileSync(
  path.join(root, "src/routes/proposalRoutes.js"),
  "utf8"
);
const projectDetails = fs.readFileSync(
  path.join(fe, "pages/ProjectDetails.jsx"),
  "utf8"
);

log("S1", "finance queue requires committee passed", {
  ok: financePage.includes('pipe.committeeReview?.status !== "passed"'),
});
log("S2", "completePeerReview waits for assignees", {
  ok: reviewCtrl.includes("assigned reviewer(s) have not submitted yet"),
});
log("S3", "grant auth no longer soft-passes proposal finance", {
  ok: !grantCtrl.includes("budget_authorized"),
});
log("S4", "repository upload authorizeRoles", {
  ok: /upload[\s\S]{0,180}authorizeRoles\("researcher", "faculty_coordinator", "research_director"\)/.test(
    repoRoutes
  ),
});
log("S5", "my-review-assignments authorizeRoles", {
  ok: /my-review-assignments[\s\S]{0,180}authorizeRoles\("leadership", "research_director"\)/.test(
    propRoutes
  ),
});
log("S6", "ProjectDetails prefers boolean isVoluntary", {
  ok: projectDetails.includes('typeof project.isVoluntary === "boolean"'),
});
log("S7", "admin screening notify links to review page", {
  ok: reviewCtrl.includes("Admin screening passed") &&
    reviewCtrl.includes("`/proposals/${proposal._id}/review`"),
});

const allOk = [
  financePage.includes('pipe.committeeReview?.status !== "passed"'),
  reviewCtrl.includes("assigned reviewer(s) have not submitted yet"),
  !grantCtrl.includes("budget_authorized"),
  /upload[\s\S]{0,180}authorizeRoles\("researcher", "faculty_coordinator", "research_director"\)/.test(
    repoRoutes
  ),
  /my-review-assignments[\s\S]{0,180}authorizeRoles\("leadership", "research_director"\)/.test(
    propRoutes
  ),
  projectDetails.includes('typeof project.isVoluntary === "boolean"'),
].every(Boolean);

process.exit(allOk ? 0 : 1);
