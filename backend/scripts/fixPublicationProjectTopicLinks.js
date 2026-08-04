require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Publication } = require("../src/models/Publication");
const { Project } = require("../src/models/Project");

const DEBUG_LOG = path.join(__dirname, "../../debug-f558f7.log");
const RUN_ID = "fix-workflow-links";
const HYPOTHESIS_ID = "WD2";

const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "in", "on", "to", "and", "or", "with", "using",
  "based", "system", "systems", "study", "analysis", "model", "models", "application",
  "applications", "research", "under", "from", "into", "by", "at", "as", "via",
  "low", "high", "early", "national", "university", "urban", "shared",
]);

/** Domain keyword groups — shared group membership = topical affinity */
const DOMAIN_GROUPS = [
  { id: "diabetic_retinopathy", keys: ["diabetic", "retinopathy", "screening"] },
  { id: "solar_renewable", keys: ["solar", "rooftop", "renewable", "panel", "panels", "tropical", "climates"] },
  { id: "campus_event", keys: ["campus", "event", "events", "coordination", "mobile-first"] },
  { id: "edu_risk_analytics", keys: ["gradient", "boosting", "educational", "risk", "prediction", "predictive", "analytics", "undergraduate", "course", "performance"] },
  { id: "antimicrobial_health", keys: ["antimicrobial", "stewardship", "primary", "care"] },
  { id: "community_vaccination", keys: ["community", "health", "worker", "vaccination", "coverage", "maternal", "clinical", "cohort"] },
  { id: "microgrid_rl", keys: ["reinforcement", "learning", "microgrid", "dispatch", "hybrid", "energy"] },
  { id: "clinical_deid", keys: ["de-identification", "deidentification", "clinical", "narratives", "transformers", "transformer", "record", "language"] },
  { id: "funding_policy", keys: ["funding", "model", "reforms", "policy", "higher", "education", "research"] },
  { id: "mobile_payment", keys: ["mobile", "payment", "ecosystems", "adoption"] },
  { id: "intrusion", keys: ["intrusion", "detection", "networks"] },
  { id: "water_iot", keys: ["iot", "water", "quality", "municipal"] },
  { id: "rfid_attendance", keys: ["rfid", "attendance", "tracking"] },
  { id: "lab_energy", keys: ["energy", "consumption", "profiling", "laboratory", "computer"] },
  { id: "health_registry", keys: ["health", "registry", "multi-party", "computation", "secure"] },
  { id: "tiktok", keys: ["tiktok", "titok", "impact"] },
];

function tokenize(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/[\s\-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function domainIdsFor(title) {
  const t = String(title || "").toLowerCase();
  const tokens = new Set(tokenize(title));
  const ids = [];
  for (const g of DOMAIN_GROUPS) {
    const hit = g.keys.filter((k) => t.includes(k) || tokens.has(k));
    if (hit.length >= 1) {
      // require at least one distinctive key; prefer 2+ for noisy groups
      const distinctive = hit.filter((k) => k.length >= 5 || ["solar", "iot", "rfid", "care"].includes(k));
      if (distinctive.length >= 1 || hit.length >= 2) ids.push(g.id);
    }
  }
  return ids;
}

function keywordOverlap(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return { shared, tokensA: [...ta], tokensB: [...tb] };
}

/**
 * Score how well a publication matches a project.
 * Higher = better. < 2 means insufficient match (conservative).
 */
function matchScore(pubTitle, projectTitle) {
  const { shared } = keywordOverlap(pubTitle, projectTitle);
  const pubDomains = domainIdsFor(pubTitle);
  const projDomains = domainIdsFor(projectTitle);
  const domainHits = pubDomains.filter((d) => projDomains.includes(d));

  let score = shared;
  score += domainHits.length * 3;

  // Strong explicit phrase alignments from the brief
  const rules = [
    [/diabetic|retinopathy/, /diabetic|retinopathy/],
    [/rooftop|solar|tropical/, /solar|panel|renewable/],
    [/campus\s+event|mobile-first.*campus|campus.*mobile/, /campus\s+event/],
    [/gradient\s+boosting|educational\s+risk/, /predictive\s+analytics|undergraduate\s+course/],
    [/antimicrobial\s+stewardship/, /maternal|clinical|health\s+registry|health\s+outcomes|antimicrobial/],
    [/community\s+health\s+worker|vaccination/, /maternal|clinical|health\s+registry|health\s+outcomes|community/],
    [/reinforcement\s+learning|microgrid/, /microgrid|energy\s+dispatch/],
    [/de-identification|clinical\s+narratives/, /de-identification|clinical\s+record|transformer/],
    [/funding\s+model\s+reforms|higher\s+education.*funding/, /policy\s+analysis|funding\s+models|higher\s+education/],
    [/tiktok|titok/, /tiktok|titok/],
  ];
  const pt = pubTitle.toLowerCase();
  const jt = projectTitle.toLowerCase();
  for (const [pr, jr] of rules) {
    if (pr.test(pt) && jr.test(jt)) score += 5;
  }

  // Hard negative: clear topic clash pairs
  const clashes = [
    [/diabetic|retinopathy/, /rfid|attendance|funding|policy|microgrid|solar|renewable|energy\s+consumption/],
    [/antimicrobial|stewardship/, /iot|water|solar|renewable|energy|rfid|campus\s+event|microgrid/],
    [/community\s+health|vaccination/, /renewable|solar|energy|microgrid|rfid|campus\s+event/],
    [/gradient\s+boosting|educational\s+risk/, /diabetic|retinopathy|maternal|microgrid|solar|clinical/],
    [/campus\s+event|mobile-first/, /microgrid|clinical|funding|solar|retinopathy|maternal/],
    [/rooftop\s+solar|solar\s+installations/, /clinical|de-identification|maternal|retinopathy|rfid|funding/],
    [/funding\s+model|higher\s+education\s+research/, /energy\s+consumption|solar|microgrid|retinopathy|rfid/],
    [/reinforcement\s+learning|microgrid\s+dispatch/, /maternal|retinopathy|clinical|funding|campus|vaccination/],
    [/de-identification|clinical\s+narratives/, /solar|renewable|campus|rfid|energy\s+consumption/],
    [/mobile\s+payment/, /./], // never a good forced match unless project also payment — handled below
    [/intrusion\s+detection/, /./],
  ];

  // Mobile payment / intrusion: only match if project also has those terms
  if (/mobile\s+payment/.test(pt) && !/payment|mobile\s+payment/.test(jt)) return 0;
  if (/intrusion\s+detection/.test(pt) && !/intrusion|security|network/.test(jt)) return 0;

  for (const [pr, jr] of clashes) {
    if (pr.test(pt) && jr.test(jt) && domainHits.length === 0 && shared < 2) {
      return Math.min(score, 0);
    }
  }

  return score;
}

function isClearMismatch(pubTitle, projectTitle) {
  const score = matchScore(pubTitle, projectTitle);
  if (score >= 4) return false; // clearly related
  // clear mismatch if domains conflict or score very low with no shared significant keywords
  const { shared } = keywordOverlap(pubTitle, projectTitle);
  const pubDomains = domainIdsFor(pubTitle);
  const projDomains = domainIdsFor(projectTitle);
  const domainHits = pubDomains.filter((d) => projDomains.includes(d));
  if (domainHits.length > 0 && score >= 3) return false;
  if (shared >= 3) return false;
  if (score <= 2) return true;
  return shared < 2 && domainHits.length === 0;
}

function logAction(message, data) {
  const row = {
    sessionId: "f558f7",
    runId: RUN_ID,
    hypothesisId: HYPOTHESIS_ID,
    location: "backend/scripts/fixPublicationProjectTopicLinks.js",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(DEBUG_LOG, `${JSON.stringify(row)}\n`);
  console.error(JSON.stringify(row));
}

function projectOwnerId(p) {
  return String(p.researcherId || p.leadResearcher || "");
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI missing");
  await mongoose.connect(uri);

  const pubs = await Publication.find({
    status: { $ne: "draft" },
    projectId: { $ne: null },
  })
    .select("title status projectId researcherId")
    .lean();

  const allProjects = await Project.find({})
    .select("title researcherId leadResearcher")
    .lean();
  const projectById = Object.fromEntries(allProjects.map((p) => [String(p._id), p]));

  const relinked = [];
  const unlinked = [];

  logAction("start topic-link repair", {
    linkedNonDraftCount: pubs.length,
    projectCount: allProjects.length,
  });

  for (const pub of pubs) {
    const current = projectById[String(pub.projectId)];
    const pubTitle = pub.title;
    const curTitle = current?.title || "";
    const mismatch = !current || isClearMismatch(pubTitle, curTitle);
    const curScore = current ? matchScore(pubTitle, curTitle) : -1;

    if (!mismatch && curScore >= 4) {
      logAction("keep link (good match)", {
        pubId: String(pub._id),
        pubTitle,
        projectId: String(pub.projectId),
        projectTitle: curTitle,
        score: curScore,
      });
      continue;
    }

    if (!mismatch) {
      // borderline — conservative keep if score ok
      logAction("keep link (borderline ok)", {
        pubId: String(pub._id),
        pubTitle,
        projectId: String(pub.projectId),
        projectTitle: curTitle,
        score: curScore,
      });
      continue;
    }

    // Find better project same researcher
    const rid = String(pub.researcherId);
    const candidates = allProjects.filter((p) => projectOwnerId(p) === rid);
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      if (String(c._id) === String(pub.projectId)) continue;
      const s = matchScore(pubTitle, c.title);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }

    // Require strong match to relink (conservative)
    const RELINK_THRESHOLD = 5;
    if (best && bestScore >= RELINK_THRESHOLD && bestScore > curScore) {
      await Publication.updateOne({ _id: pub._id }, { $set: { projectId: best._id } });
      const entry = {
        pubId: String(pub._id),
        pubTitle,
        fromProjectId: String(pub.projectId),
        fromProjectTitle: curTitle || "MISSING",
        toProjectId: String(best._id),
        toProjectTitle: best.title,
        score: bestScore,
        researcherId: rid,
      };
      relinked.push(entry);
      logAction("relinked publication to better project", entry);
    } else {
      await Publication.updateOne({ _id: pub._id }, { $set: { projectId: null } });
      const entry = {
        pubId: String(pub._id),
        pubTitle,
        fromProjectId: String(pub.projectId),
        fromProjectTitle: curTitle || "MISSING",
        reason: best
          ? `best_same_researcher_score_too_low:${bestScore}:${best.title}`
          : "no_same_researcher_candidate",
        bestScore,
        researcherId: rid,
      };
      unlinked.push(entry);
      logAction("unlinked mismatched publication", entry);
    }
  }

  // Re-verify
  const after = await Publication.find({
    status: { $ne: "draft" },
    projectId: { $ne: null },
  })
    .select("title projectId researcherId")
    .lean();

  const sampleByProject = {};
  let remainingMismatches = 0;
  const mismatchDetails = [];

  for (const pub of after) {
    const proj = projectById[String(pub.projectId)];
    const pid = String(pub.projectId);
    if (!sampleByProject[pid]) {
      sampleByProject[pid] = {
        projectTitle: proj?.title || "MISSING",
        pubs: [],
      };
    }
    sampleByProject[pid].pubs.push(pub.title);
    const clash = !proj || isClearMismatch(pub.title, proj.title);
    if (clash) {
      remainingMismatches++;
      mismatchDetails.push({
        pubId: String(pub._id),
        pubTitle: pub.title,
        projectTitle: proj?.title || "MISSING",
        score: proj ? matchScore(pub.title, proj.title) : -1,
      });
    }
  }

  const summary = {
    relinked,
    unlinked,
    remainingMismatches,
    sampleByProject,
    mismatchDetails,
  };

  logAction("topic-link repair complete", {
    relinkedCount: relinked.length,
    unlinkedCount: unlinked.length,
    remainingMismatches,
    mismatchDetails,
  });

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
