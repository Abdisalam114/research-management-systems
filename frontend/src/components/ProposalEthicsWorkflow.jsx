import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as proposalApi from "../services/proposalApi";

const STEPS = [
  { key: "form", label: "1. Buuxi foomka ethics" },
  { key: "submit", label: "2. Hal mar u gudbi Director (Proposal + Ethics)" },
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
        Buuxi foomka ethics, kadib hal badhan ayaa proposal + ethics u gudbinaya Director. Project ma abuurmo ilaa
        Director uu ansixiyo ethics iyo proposal.
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
        <button
          type="button"
          className="btn"
          onClick={() => navigate(`/ethics?proposalId=${proposal.id}`)}
        >
          {formComplete ? "View / edit ethics form" : "Complete ethics form"}
        </button>

        {canSubmit && onSubmitCombined ? (
          <button type="button" className="btn primary" disabled={submitBusy} onClick={onSubmitCombined}>
            {submitBusy ? "Submitting…" : "Submit to Director (Proposal + Ethics)"}
          </button>
        ) : null}

        {ethicsApproved ? (
          <span className="muted">✓ Ethics approved</span>
        ) : ethicsSubmitted ? (
          <span className="muted">⏳ With Director — ethics + proposal under review</span>
        ) : !formComplete ? (
          <span className="muted">Complete ethics form to enable submit</span>
        ) : null}
      </div>
    </div>
  );
}
