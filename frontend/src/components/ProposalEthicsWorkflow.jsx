import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as proposalApi from "../services/proposalApi";
import { getEthicsMissingFields, getProposalMissingFields } from "../utils/proposalSubmitValidation";
import { AppButton } from "./AppButton";

const STEPS = [
  { key: "form", label: "1. Complete proposal + ethics on one page" },
  { key: "submit", label: "2. Submit both to the Director with one button" },
];

export function canSubmitToDirector(proposal, ethics) {
  if (!["draft", "revision_requested"].includes(proposal?.status)) return false;
  if (!proposal?.requiresEthics) return true;
  const formComplete = ethics?.formComplete ?? proposal?.ethicsFormComplete;
  const ethicsStatus = ethics?.status || proposal?.ethicsApplication?.status || "draft";
  const ethicsPending = ["draft", "rejected"].includes(ethicsStatus);
  return Boolean(formComplete && ethicsPending);
}

/** @deprecated use canSubmitToDirector */
export function canSubmitProposalWithEthics(proposal) {
  if (!proposal?.requiresEthics) return true;
  return canSubmitToDirector(proposal, proposal?.ethicsApplication);
}

export function ProposalEthicsWorkflow({ accessToken, proposal, onRefresh, onSubmitCombined, submitBusy }) {
  const navigate = useNavigate();
  const [ethics, setEthics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || !proposal?.id) return;
    proposalApi
      .getProposalEthicsApplication(accessToken, proposal.id)
      .then((res) => setEthics(res.application))
      .catch(() => setEthics(null));
  }, [accessToken, proposal?.id, proposal?.ethicsApplication?.status, proposal?.status]);

  if (!proposal?.requiresEthics) {
    return (
      <div className="card" style={{ marginTop: 12, background: "rgba(14,165,233,0.05)" }}>
        <div className="muted">Ethics review not required for this proposal.</div>
      </div>
    );
  }

  const formComplete = ethics?.formComplete || proposal?.ethicsFormComplete;
  const ethicsStatus = ethics?.status || proposal?.ethicsApplication?.status || "draft";
  const ethicsSubmitted = ["submitted", "approved"].includes(ethicsStatus);
  const ethicsApproved = ethicsStatus === "approved" || proposal?.ethicsStatus === "approved";
  const canSubmit = canSubmitToDirector(proposal, ethics);

  return (
    <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Ethics clearance (required — submitted with proposal)</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        The proposal and ethics form are on the same page. If anything is missing when you submit, you will see a list of
        fields to complete. After submission, await the Director&apos;s response.
      </div>

      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {STEPS.map((s) => (
          <div key={s.key} className="muted" style={{ fontSize: 13 }}>
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <span>
          Ethics form: <strong>{formComplete ? "Complete ✓" : "Incomplete"}</strong>
        </span>
        <span>
          Ethics: <strong>{ethicsStatus}</strong>
        </span>
        <span>
          Proposal: <strong>{proposal.status}</strong>
        </span>
      </div>

      {error ? <div style={{ color: "#f87171", marginBottom: 8 }}>{error}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <AppButton onClick={() => navigate(`/proposals/${proposal.id}/edit`)}>
          {formComplete ? "Edit proposal + ethics" : "Complete proposal + ethics"}
        </AppButton>

        {onSubmitCombined ? (
          <AppButton variant="primary" loading={submitBusy} onClick={onSubmitCombined}>
            Submit to Director (Proposal + Ethics)
          </AppButton>
        ) : null}

        {ethicsApproved ? (
          <span className="muted">✓ Ethics approved</span>
        ) : ethicsSubmitted ? (
          <span className="muted">⏳ With Director — ethics + proposal under review</span>
        ) : !formComplete ? (
          <span className="muted">Complete the fields below before submitting</span>
        ) : null}
      </div>

      {!formComplete && !ethicsSubmitted ? (
        <MissingFieldsHint proposal={proposal} ethics={ethics} />
      ) : null}
    </div>
  );
}

function MissingFieldsHint({ proposal, ethics }) {
  const proposalMissing = getProposalMissingFields(proposal);
  const ethicsMissing = getEthicsMissingFields(ethics || {});
  const all = [...proposalMissing, ...ethicsMissing];
  if (!all.length) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(248, 113, 113, 0.08)",
        border: "1px solid rgba(248, 113, 113, 0.35)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Fields still missing:</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {all.map((item) => (
          <li key={`${item.section}-${item.field}`}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}
