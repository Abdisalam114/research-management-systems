/** Shared ethics application form state (proposal + standalone ethics page). */

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
  return {
    ...emptyEthicsForm(),
    ...a,
    startDate: dt(a.startDate),
    endDate: dt(a.endDate),
    risk: a.risk || { level: "", description: "" },
    riskPrecautions: a.riskPrecautions || { has: false, description: "" },
    consent: { ...emptyEthicsForm().consent, ...(a.consent || {}) },
    dataSafety: { ...emptyEthicsForm().dataSafety, ...(a.dataSafety || {}) },
    privacy: { ...emptyEthicsForm().privacy, ...(a.privacy || {}) },
    conflictOfInterest: { ...emptyEthicsForm().conflictOfInterest, ...(a.conflictOfInterest || {}) },
    applicantSignature: { name: a.applicantSignature?.name || "" },
    otherInvestigators: a.otherInvestigators || [],
  };
}

/** Pre-fill ethics from logged-in researcher + proposal fields. */
export function buildEthicsFromProposalAndUser(proposal, user) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";
  return {
    ...emptyEthicsForm(),
    projectTitle: proposal?.title || "",
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
export function syncEthicsFromProposal(ethics, proposal, user) {
  const parts = (user?.fullName || "").trim().split(/\s+/);
  return {
    ...ethics,
    projectTitle: proposal.title || "",
    aimsObjectives: proposal.abstract || ethics.aimsObjectives,
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

export function prepareEthicsPayload(form) {
  const payload = { ...form };
  if (payload.startDate === "") payload.startDate = null;
  if (payload.endDate === "") payload.endDate = null;
  return payload;
}
