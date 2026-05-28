/** Mirrors backend proposalEthicsLink.isEthicsFormComplete */
export function isEthicsFormComplete(form) {
  if (!form) return false;
  return Boolean(
    String(form.projectTitle || "").trim() &&
      String(form.principal?.firstName || "").trim() &&
      String(form.principal?.lastName || "").trim() &&
      String(form.projectLevel || "").trim() &&
      String(form.aimsObjectives || "").trim() &&
      String(form.design || "").trim() &&
      String(form.applicantSignature?.name || "").trim()
  );
}
