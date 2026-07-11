/** Shared ethics application form state (proposal + standalone ethics page). */

import { PROGRAM_TIERS } from "../constants/programTier";

export function defaultProjectLevelFromTier(programTier) {
  if (programTier === PROGRAM_TIERS.UNDERGRADUATE) return "undergraduate";
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

export function ethicsApplicationToForm(a) {
  if (!a) return emptyEthicsForm();
  const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const empty = emptyEthicsForm();
  const form = {
    ...empty,
    ...a,
    principal: { ...empty.principal, ...(a.principal || {}) },
    coResearcher: { ...empty.coResearcher, ...(a.coResearcher || {}) },
    startDate: dt(a.startDate),
    endDate: dt(a.endDate),
    risk: { ...empty.risk, ...(a.risk || {}) },
    riskPrecautions: { ...empty.riskPrecautions, ...(a.riskPrecautions || {}) },
    dataHandling: { ...empty.dataHandling, ...(a.dataHandling || {}) },
    consent: { ...empty.consent, ...(a.consent || {}) },
    dataSafety: { ...empty.dataSafety, ...(a.dataSafety || {}) },
    privacy: { ...empty.privacy, ...(a.privacy || {}) },
    conflictOfInterest: { ...empty.conflictOfInterest, ...(a.conflictOfInterest || {}) },
    applicantSignature: { ...empty.applicantSignature, ...(a.applicantSignature || {}) },
    otherInvestigators: a.otherInvestigators || [],
  };
return form;
}

/** Pre-fill ethics from logged-in researcher + proposal fields. */
export function buildEthicsFromProposalAndUser(proposal, user, programTier) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  const tier = programTier || proposal?.programTier;
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
      department: proposal?.department || user?.department || "",
    },
    applicantSignature: { name: user?.fullName || "" },
  };
}

/** Keep ethics in sync when proposal title / dept / abstract change. */
export function syncEthicsFromProposal(ethics, proposal, user, programTier) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  const tier = programTier || proposal?.programTier;
  const defaultLevel = defaultProjectLevelFromTier(tier);
  return {
    ...ethics,
    projectTitle: proposal.title || "",
    projectLevel: ethics.projectLevel || defaultLevel,
    aimsObjectives: ethics.aimsObjectives || proposal.abstract || "",
    principal: {
      ...ethics.principal,
      department: proposal.department || user?.department || ethics.principal?.department || "",
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
  if (voluntary) {
    payload.fundingSource = "N/A — voluntary research (no funding)";
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
