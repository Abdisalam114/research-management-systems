import logo from "../assets/jamhuriya-logo.png";
import { formatJurecDate, formatJurecDateShort } from "../utils/jurecFormat";

/** Live visual preview of the JUREC certificate (matches PDF layout). */
export function JurecCertificatePreview({ cert, includeSignature, includeStamp }) {
  if (!cert) return null;

  return (
    <div
      style={{
        background: "#fff",
        color: "#0f172a",
        border: "1px solid rgba(148,163,184,0.45)",
        borderRadius: 8,
        padding: "20px 22px",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 11,
        lineHeight: 1.45,
        boxShadow: "0 4px 20px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 11, letterSpacing: "0.04em" }}>
        JAMHURIYA UNIVERSITY RESEARCH ETHICS COMMITTEE
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10 }}>
        <span>Ref: {cert.refNumber || "—"}</span>
        <span>Date: {formatJurecDate(cert.signedAt)}</span>
      </div>

      <div style={{ textAlign: "center", margin: "14px 0 10px" }}>
        <img src={logo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
      </div>

      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14 }}>ETHICAL APPROVAL CERTIFICATE</div>
      <div style={{ textAlign: "center", fontSize: 11, marginTop: 4 }}>On Research Involving Human Subjects</div>

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        <PreviewRow label="Certificate Number" value={cert.certificateNumber} />
        <PreviewRow label="Serial Number" value={cert.serialNumber} highlight />
        <PreviewRow label="Date of Issue" value={formatJurecDate(cert.signedAt)} />
        <PreviewRow label="Principal Investigator" value={cert.principalInvestigator} />
        <PreviewRow label="Faculty/Center" value={cert.facultyCenter} />
        <PreviewRow label="Title of Project" value={cert.projectTitle} />
      </div>

      <p style={{ marginTop: 14, fontSize: 10, textAlign: "justify", color: "#334155" }}>
        The committee has considered the research proposal and accompanying documents submitted by the principal
        investigator. The committee confirms that the research adheres to the ethical standards and guidelines set forth
        by Jamhuriya University of Science and Technology and relevant national and international regulations.
      </p>

      <div style={{ marginTop: 14, fontSize: 10 }}>
        <strong>Approval Details:</strong>
        <ApprovalDetailsBoxes
          receivedAt={cert.receivedAt}
          reviewedAt={cert.reviewedAt}
          approvedAt={cert.signedAt}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24, gap: 16 }}>
        <div style={{ flex: 1 }}>
          {includeSignature ? (
            <div style={{ marginBottom: 6, fontStyle: "italic", fontSize: 18, color: "#334155", lineHeight: 1 }}>
              {cert.chairpersonLine || "—"}
            </div>
          ) : null}
          <div style={{ fontWeight: 600 }}>{cert.chairpersonLine || "—"}</div>
          <div>{cert.signatoryTitle || "Chairperson"}</div>
          <div>Jamhuriya University Research Ethics Committee</div>
          <div>Mogadishu – Somalia</div>
        </div>
        {includeStamp ? (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "2px solid #b91c1c",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#b91c1c",
              fontSize: 8,
              fontWeight: 800,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <span>JUREC</span>
            <span style={{ fontSize: 6, fontWeight: 600 }}>OFFICIAL STAMP</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewRow({ label, value, highlight }) {
  return (
    <div style={{ fontSize: 10 }}>
      <strong>{label}:</strong>{" "}
      <span style={highlight ? { color: "#0284c7", fontWeight: 700 } : undefined}>{value || "—"}</span>
    </div>
  );
}

export function ApprovalDetailsBoxes({ receivedAt, reviewedAt, approvedAt }) {
  const items = [
    { label: "Received", date: receivedAt },
    { label: "Reviewed", date: reviewedAt },
    { label: "Approved", date: approvedAt },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            border: "1px solid #94a3b8",
            borderRadius: 6,
            padding: "8px 6px",
            textAlign: "center",
            background: "#f8fafc",
            minHeight: 48,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 9, color: "#0f172a", marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 9, color: "#334155" }}>{formatJurecDateShort(item.date)}</div>
        </div>
      ))}
    </div>
  );
}
