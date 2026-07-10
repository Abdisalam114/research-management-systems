/** Parse funding call requiredDocuments text into checklist labels. */
function parseCallRequirementLabels(requiredDocuments) {
  if (!requiredDocuments || !String(requiredDocuments).trim()) return [];
  return String(requiredDocuments)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

function buildRequirementChecklist(requiredDocuments, existing = []) {
  const labels = parseCallRequirementLabels(requiredDocuments);
  if (!labels.length) return [];

  const byLabel = new Map((existing || []).map((item) => [item.label, item]));
  return labels.map((label) => {
    const prev = byLabel.get(label);
    return {
      label,
      met: Boolean(prev?.met),
      note: prev?.note ? String(prev.note) : "",
    };
  });
}

function assertRequirementsMet(checklist) {
  const unmet = (checklist || []).filter((item) => !item.met);
  if (!unmet.length) return;
  const labels = unmet.map((item) => item.label).join("; ");
  const err = new Error(`Funding call requirements not completed: ${labels}`);
  err.statusCode = 400;
  throw err;
}

module.exports = {
  parseCallRequirementLabels,
  buildRequirementChecklist,
  assertRequirementsMet,
};
