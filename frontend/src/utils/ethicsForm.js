/** Mirrors backend proposalEthicsLink.isEthicsFormComplete */
import { getEthicsMissingFields } from "./proposalSubmitValidation";

export function isEthicsFormComplete(form) {
  return getEthicsMissingFields(form).length === 0;
}
