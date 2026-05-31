/** Required proposal + ethics fields — list of missing items. */

export function getProposalMissingFields(proposal) {
  const missing = [];
  if (!String(proposal?.title || "").trim()) {
    missing.push({ section: "proposal", field: "title", label: "Title" });
  }
  if (!String(proposal?.abstract || "").trim()) {
    missing.push({ section: "proposal", field: "abstract", label: "Abstract" });
  }
  if (!String(proposal?.department || "").trim()) {
    missing.push({ section: "proposal", field: "department", label: "Department" });
  }
  if (!String(proposal?.researchArea || "").trim()) {
    missing.push({ section: "proposal", field: "researchArea", label: "Research area" });
  }
  return missing;
}

export function getEthicsMissingFields(form) {
  const missing = [];
  if (!String(form?.projectTitle || "").trim()) {
    missing.push({ section: "ethics", field: "projectTitle", label: "Project title (ethics form)" });
  }
  const fn = String(form?.principal?.firstName || "").trim();
  const ln = String(form?.principal?.lastName || "").trim();
  if (!fn) {
    missing.push({ section: "ethics", field: "principal.firstName", label: "PI first name (Principal Investigator)" });
  }
  if (!ln) {
    missing.push({ section: "ethics", field: "principal.lastName", label: "PI last name" });
  }
  if (!String(form?.projectLevel || "").trim()) {
    missing.push({ section: "ethics", field: "projectLevel", label: "Project level (Undergraduate / PGD / Master)" });
  }
  if (!String(form?.aimsObjectives || "").trim()) {
    missing.push({ section: "ethics", field: "aimsObjectives", label: "Aims & objectives" });
  }
  if (!String(form?.design || "").trim()) {
    missing.push({ section: "ethics", field: "design", label: "Design (research methodology)" });
  }
  if (!String(form?.applicantSignature?.name || "").trim()) {
    missing.push({ section: "ethics", field: "applicantSignature.name", label: "Signature (your full name)" });
  }
  return missing;
}

export function collectSubmitValidationIssues(proposal, ethicsForm, requiresEthics = true) {
  return [
    ...getProposalMissingFields(proposal),
    ...(requiresEthics ? getEthicsMissingFields(ethicsForm) : []),
  ];
}

export const SUBMIT_SUCCESS_MESSAGE =
  "You have successfully submitted your proposal and ethics form. The Director is now reviewing your submission — please await approval.";
