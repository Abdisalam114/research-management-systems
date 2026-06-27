const EDITABLE_FIELDS = [
  "principal",
  "coResearcher",
  "otherInvestigators",
  "projectTitle",
  "projectLevel",
  "startDate",
  "endDate",
  "backgroundLiterature",
  "aimsObjectives",
  "rationale",
  "design",
  "subjectTypes",
  "subjectTypesSpecify",
  "inclusionCriteria",
  "exclusionCriteria",
  "risk",
  "riskPrecautions",
  "settings",
  "instruments",
  "instrumentsOther",
  "dataCollectionDate",
  "sampleSize",
  "dataHandling",
  "fundingSource",
  "consent",
  "dataSafety",
  "privacy",
  "conflictOfInterest",
  "applicantSignature",
];

function applyEthicsPayload(target, payload) {
  if (!payload || typeof payload !== "object") return;
  for (const key of EDITABLE_FIELDS) {
    if (payload[key] !== undefined) target[key] = payload[key];
  }
}

function parseEthicsJson(body) {
  if (!body?.ethics) return null;
  try {
    return typeof body.ethics === "string" ? JSON.parse(body.ethics) : body.ethics;
  } catch {
    return null;
  }
}

module.exports = { EDITABLE_FIELDS, applyEthicsPayload, parseEthicsJson };
