/**
 * One-off: remove #region agent log blocks and common debug helpers.
 * Run: node src/scripts/stripDebugInstrumentation.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");

const FILES = [
  "frontend/src/pages/Ethics.jsx",
  "frontend/src/pages/ProposalForm.jsx",
  "frontend/src/pages/ThesisGroups.jsx",
  "frontend/src/layout/TopBar.jsx",
  "frontend/src/context/AuthContext.jsx",
  "frontend/src/components/EthicsApplicationForm.jsx",
  "frontend/src/utils/ethicsFormState.js",
  "frontend/src/components/DirectorDashboard.jsx",
  "frontend/src/pages/Grants.jsx",
  "frontend/src/pages/Messages.jsx",
  "frontend/src/components/SystemModulesGrid.jsx",
  "frontend/src/layout/AppLayout.jsx",
  "backend/src/controllers/analyticsController.js",
  "backend/src/controllers/proposalController.js",
  "backend/src/controllers/thesisGroupController.js",
  "backend/src/utils/researchJourney.js",
  "backend/src/controllers/ethicsController.js",
  "backend/src/controllers/repositoryController.js",
  "backend/src/controllers/publicationController.js",
  "backend/src/controllers/paymentController.js",
  "backend/src/controllers/researchGroupController.js",
  "backend/src/controllers/conversationController.js",
  "backend/src/scripts/repairProjectScopedLinks.js",
];

const REGION_RE = /\s*\/\/ #region agent log[\s\S]*?\/\/ #endregion\s*/g;

function stripRegions(content) {
  let prev;
  do {
    prev = content;
    content = content.replace(REGION_RE, "\n");
  } while (content !== prev);
  return content;
}

function stripThesisDebug(content) {
  content = content.replace(
    /function debugLog\([\s\S]*?^}\n\n/m,
    ""
  );
  content = content.replace(/\s*debugLog\([^)]*\);?\n/g, "\n");
  if (!content.includes("fs.")) {
    content = content.replace(/^const fs = require\("fs"\);\n/m, "");
  }
  if (!content.includes("path.")) {
    content = content.replace(/^const path = require\("path"\);\n/m, "");
  }
  return content;
}

function stripGrantDebug(content) {
  content = content.replace(/function logGrantDebug\([\s\S]*?^}\n\n/m, "");
  content = content.replace(/\s*logGrantDebug\([^)]*\);?\n/g, "\n");
  return content;
}

function stripAuthDebug(content) {
  content = content.replace(/function logAuthDebug\([\s\S]*?^}\n\n/m, "");
  content = content.replace(/\s*logAuthDebug\([^)]*\);?\n/g, "\n");
  return content;
}

let changed = 0;
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn("skip missing:", rel);
    continue;
  }
  let content = fs.readFileSync(file, "utf8");
  const before = content;
  content = stripRegions(content);
  if (rel.includes("thesisGroupController")) content = stripThesisDebug(content);
  if (rel.includes("Grants.jsx")) content = stripGrantDebug(content);
  if (rel.includes("AuthContext.jsx")) content = stripAuthDebug(content);
  if (content !== before) {
    fs.writeFileSync(file, content);
    changed++;
    console.log("cleaned:", rel);
  }
}
console.log("Done. Files changed:", changed);
