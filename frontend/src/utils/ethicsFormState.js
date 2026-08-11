/** Shared ethics application form state (proposal + standalone ethics page). */

import { PROGRAM_TIERS } from "../constants/programTier";
import { normalizeProjectLevel } from "../constants/ethicsFormOptions";
import { matchFacultyByName } from "../constants/faculties";

export function defaultProjectLevelFromTier(programTier) {
  if (programTier === PROGRAM_TIERS.UNDERGRADUATE) return "undergraduate";
  if (programTier === PROGRAM_TIERS.POSTGRADUATE) return "master";
  return "";
}

export function emptyEthicsForm() {
  return {
    principal: { lastName: "", firstName: "", title: "", faculty: "", department: "", qualification: "", phone: "", email: "" },
    coResearcher: { lastName: "", firstName: "", title: "", faculty: "", department: "", qualification: "", phone: "", email: "" },
    otherInvestigators: [],
    projectTitle: "",
    projectLevel: "",
    startDate: "",
    endDate: "",
    backgroundLiterature: "",
    aimsObjectives: "",
    rationale: "",
    design: "",
    subjectTypes: [],
    subjectTypesSpecify: "",
    inclusionCriteria: "",
    exclusionCriteria: "",
    risk: { level: "", description: "" },
    riskPrecautions: { has: false, description: "" },
    settings: "",
    instruments: [],
    instrumentsOther: "",
    dataCollectionDate: "",
    sampleSize: "",
    dataHandling: { confidentiality: "", retention: "" },
    fundingSource: "",
    consent: { hasForm: false, language: "", languageOther: "", interpreter: false, items: [], seekingFrom: "" },
    dataSafety: { handling: "", rawDataPost: "", retentionDetails: "", accessRights: "" },
    privacy: { sharesData: false, sharesDataWith: "", sharingInform: "", identifiable: false, identifiableProtection: "" },
    conflictOfInterest: { collaborationHas: false, collaborationWith: "", financialHas: false, financialDescription: "", reviewedHas: false, reviewedBy: "" },
    applicantSignature: { name: "" },
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeSection(emptySection, raw) {
  const merged = { ...emptySection, ...(raw && typeof raw === "object" ? raw : {}) };
  if (Array.isArray(emptySection.items) || "items" in merged) {
    merged.items = asArray(merged.items);
  }
  return merged;
}

export function ethicsApplicationToForm(a) {
  if (!a) return emptyEthicsForm();
  const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const empty = emptyEthicsForm();
  const form = {
    ...empty,
    ...a,
    principal: mergeSection(empty.principal, a.principal),
    coResearcher: mergeSection(empty.coResearcher, a.coResearcher),
    startDate: dt(a.startDate),
    endDate: dt(a.endDate),
    risk: mergeSection(empty.risk, a.risk),
    riskPrecautions: mergeSection(empty.riskPrecautions, a.riskPrecautions),
    dataHandling: mergeSection(empty.dataHandling, a.dataHandling),
    consent: mergeSection(empty.consent, a.consent),
    dataSafety: mergeSection(empty.dataSafety, a.dataSafety),
    privacy: mergeSection(empty.privacy, a.privacy),
    conflictOfInterest: mergeSection(empty.conflictOfInterest, a.conflictOfInterest),
    applicantSignature: mergeSection(empty.applicantSignature, a.applicantSignature),
    // Spread of `a` can overwrite empty arrays with null from Mongo — force lists.
    subjectTypes: asArray(a.subjectTypes),
    instruments: asArray(a.instruments),
    otherInvestigators: asArray(a.otherInvestigators),
    projectLevel: normalizeProjectLevel(a.projectLevel),
  };
  return form;
}

/** Pre-fill ethics from logged-in researcher + proposal fields. */
export function buildEthicsFromProposalAndUser(proposal, user, programTier) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  const tier = programTier || proposal?.programTier;
  const dept = proposal?.department || user?.department || "";
  return {
    ...emptyEthicsForm(),
    projectTitle: proposal?.title || "",
    projectLevel: defaultProjectLevelFromTier(tier),
    aimsObjectives: proposal?.abstract || "",
    principal: {
      ...emptyEthicsForm().principal,
      firstName,
      lastName,
      email: user?.email || "",
      department: dept,
      faculty: matchFacultyByName(dept),
    },
    applicantSignature: { name: user?.fullName || "" },
  };
}

/** Keep ethics in sync when proposal title / dept / abstract change. */
export function syncEthicsFromProposal(ethics, proposal, user, programTier) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  const tier = programTier || proposal?.programTier;
  const defaultLevel = defaultProjectLevelFromTier(tier);
  const dept = proposal.department || user?.department || ethics.principal?.department || "";
  return {
    ...ethics,
    projectTitle: proposal.title || "",
    projectLevel: normalizeProjectLevel(ethics.projectLevel) || defaultLevel,
    aimsObjectives: ethics.aimsObjectives || proposal.abstract || "",
    principal: {
      ...ethics.principal,
      department: dept,
      faculty: ethics.principal?.faculty || matchFacultyByName(dept),
      email: user?.email || ethics.principal?.email || "",
      firstName: ethics.principal?.firstName || parts[0] || "",
      lastName: ethics.principal?.lastName || parts.slice(1).join(" ") || "",
    },
    applicantSignature: {
      name: ethics.applicantSignature?.name || user?.fullName || "",
    },
  };
}

export function prepareEthicsPayload(form, { voluntary = false } = {}) {
  const payload = { ...form };
  if (payload.startDate === "") payload.startDate = null;
  if (payload.endDate === "") payload.endDate = null;
  payload.projectLevel = normalizeProjectLevel(payload.projectLevel);
  if (voluntary) {
    payload.fundingSource = "";
    payload.conflictOfInterest = {
      ...(payload.conflictOfInterest || {}),
      financialHas: false,
      financialDescription: "",
    };
    const items = (payload.consent?.items || []).filter(
      (v) => v !== "compensation" && v !== "cost_reimbursement"
    );
    payload.consent = { ...(payload.consent || {}), items };
  }
  return payload;
}
