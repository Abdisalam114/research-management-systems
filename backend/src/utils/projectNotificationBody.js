const { Project } = require("../models/Project");
const { userDisplayName } = require("./userDisplay");

function line(label, value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return null;
  }
}

function truncate(text, max = 400) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function researcherDisplay(project) {
  const r = project.researcherId;
  if (r && typeof r === "object") {
    const name = userDisplayName(r);
    const dept = r.department ? ` (${r.department})` : "";
    const email = r.email ? `\nEmail: ${r.email}` : "";
    return `${name}${dept}${email}`;
  }
  return project.principalInvestigatorName || "—";
}

function programTierLabel(tier) {
  if (tier === "postgraduate") return "Postgraduate (PG)";
  if (tier === "undergraduate") return "Undergraduate (UG)";
  return tier || null;
}

function closureChecklistLines(checklist) {
  if (!checklist || typeof checklist !== "object") return [];
  const labels = {
    finalReportSubmitted: "Final report submitted",
    assetsReturned: "Assets returned / handover complete",
    financialCleared: "Financial clearance",
    repositoryArchived: "Repository archive",
    ethicsClosed: "Ethics closed",
  };
  return Object.entries(labels)
    .filter(([key]) => checklist[key] !== undefined)
    .map(([key, label]) => `${label}: ${checklist[key] ? "Yes" : "No"}`);
}

/**
 * Readable project summary for notification list / View details modal.
 * @param {object} project - Mongoose doc or plain object (researcherId may be populated)
 * @param {{ context?: string, intro?: string, comment?: string }} opts
 */
function buildProjectNotificationBody(project, opts = {}) {
  const { context = "update", intro, comment } = opts;
  const closure = project.closure || {};

  const intros = {
    closure_submitted: "A researcher submitted project closure for director review.",
    closure_pending_finance: "Director approved closure — finance clearance is required.",
    project_closed: "Your research project has been closed and archived.",
    update: "Project update notification.",
  };

  const rows = [intro || intros[context] || intros.update, ""];

  rows.push(
    line("Project", project.title),
    line("Status", project.status),
    line("Principal investigator", researcherDisplay(project).replace(/\n/g, " · ")),
    line("Program tier", programTierLabel(project.programTier)),
    line("Start date", formatDate(project.startDate)),
    line("End date", formatDate(project.endDate))
  );

  if (closure.status && closure.status !== "none") {
    rows.push(line("Closure status", closure.status));
  }
  if (closure.finalReport) {
    rows.push(line("Final report", truncate(closure.finalReport)));
  }
  if (closure.lessonsLearned) {
    rows.push(line("Lessons learned", truncate(closure.lessonsLearned)));
  }
  if (closure.assetHandover) {
    rows.push(line("Asset handover", truncate(closure.assetHandover)));
  }
  if (closure.auditNotes) {
    rows.push(line("Audit notes", truncate(closure.auditNotes)));
  }

  const checklistLines = closureChecklistLines(closure.checklist);
  if (checklistLines.length) {
    rows.push("", "Closure checklist:");
    checklistLines.forEach((l) => rows.push(`  • ${l}`));
  }

  if (comment?.trim()) {
    rows.push("", line("Comment", truncate(comment, 600)));
  }

  rows.push("", "Use Open below to review inside the project module.");
  return rows.filter((r) => r !== null).join("\n");
}

async function loadProjectForNotification(project) {
  const id = project?._id || project?.id;
  if (!id) return project;
  const populated = await Project.findById(id).populate("researcherId", "fullName email department");
  return populated || project;
}

module.exports = {
  buildProjectNotificationBody,
  loadProjectForNotification,
};
