function Row({ label, value }) {
  if (!value || value === "—") return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

function personLabel(p) {
  if (!p) return "—";
  const name = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  if (!name) return "—";
  return `${name}${p.department ? ` • ${p.department}` : ""}${p.email ? ` • ${p.email}` : ""}`;
}

export function ProposalEthicsReviewPanel({ ethics, isDirector, onApproveEthics, onRejectEthics, busy }) {
  if (!ethics) {
    return (
      <div className="card" style={{ marginTop: 12, borderColor: "rgba(255,99,132,0.4)" }}>
        <div style={{ fontWeight: 700 }}>Ethics form</div>
        <div className="muted" style={{ marginTop: 6 }}>No linked ethics application found.</div>
      </div>
    );
  }

  const approved = ethics.status === "approved";

  return (
    <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>Ethics application (REC) — submitted with proposal</div>
        <span style={{ fontSize: 13 }}>
          Status: <strong>{ethics.status}</strong>
          {ethics.formComplete ? " • form complete" : " • incomplete"}
        </span>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
        <Row label="Project title (ethics)" value={ethics.projectTitle} />
        <Row label="Project level" value={ethics.projectLevel} />
        <Row label="Principal investigator" value={personLabel(ethics.principal)} />
        <Row label="Co-researcher / supervisor" value={personLabel(ethics.coResearcher)} />
        <Row label="Other co-investigators" value={(ethics.otherInvestigators || []).join(", ") || "—"} />
        <Row label="Aims & objectives" value={ethics.aimsObjectives} />
        <Row label="Design" value={ethics.design} />
        <Row label="Background & literature" value={ethics.backgroundLiterature} />
        <Row label="Rationale" value={ethics.rationale} />
        <Row label="Subject types" value={(ethics.subjectTypes || []).join(", ") || "—"} />
        <Row label="Risk level" value={ethics.risk?.level} />
        <Row label="Risk description" value={ethics.risk?.description} />
        <Row label="Settings" value={ethics.settings} />
        <Row label="Instruments" value={(ethics.instruments || []).join(", ") || "—"} />
        <Row label="Sample size" value={ethics.sampleSize} />
        <Row label="Applicant signature" value={ethics.applicantSignature?.name} />
        {ethics.approval?.certificateNumber || ethics.approval?.certificateId ? (
          <Row label="Certificate Number" value={ethics.approval.certificateNumber || ethics.approval.certificateId} />
        ) : null}
        {ethics.approval?.refNumber ? <Row label="JUREC Ref" value={ethics.approval.refNumber} /> : null}
      </div>

      {isDirector && ethics.status === "submitted" ? (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="btn primary" disabled={busy} onClick={onApproveEthics}>
            Approve ethics & issue certificate
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onRejectEthics}>
            Reject ethics
          </button>
        </div>
      ) : null}

      {approved ? (
        <div className="muted" style={{ marginTop: 12, color: "#1d4ed8" }}>
          ✓ Ethics approved — you may now approve the proposal to create the project.
        </div>
      ) : ethics.status === "submitted" && !isDirector ? (
        <div className="muted" style={{ marginTop: 12 }}>Awaiting Director ethics approval.</div>
      ) : null}
    </div>
  );
}
