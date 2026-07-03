import logo from "../assets/jamhuriya-logo.png";
import { formatJurecDate } from "../utils/jurecFormat";
import { ApprovalDetailsBoxes } from "./JurecCertificatePreview";

function MetaLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
      {label}: <span style={{ fontWeight: 600, color: "#334155" }}>{value}</span>
    </div>
  );
}

/** Shared header for ethics application form and JUREC certificate preview. */
export function EthicsBrandingHeader({ approval, showCertificateMeta = false, status }) {
  const y = new Date().getFullYear();
  const defaultAcademic = `${y}/${y + 1}`;
  const isApprovedCert = showCertificateMeta && approval && status === "approved";

  return (
    <div
      style={{
        textAlign: "center",
        padding: "16px 12px",
        marginBottom: 16,
        borderBottom: "1px solid rgba(14,165,233,0.25)",
        background: "linear-gradient(180deg, rgba(14,165,233,0.06), transparent)",
        borderRadius: 12,
      }}
    >
      {isApprovedCert ? (
        <>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", letterSpacing: "0.04em" }}>
            JAMHURIYA UNIVERSITY RESEARCH ETHICS COMMITTEE
          </div>
          <div style={{ fontSize: 12, color: "#334155", marginTop: 8 }}>
            Ref: {approval.refNumber || approval.serialNumber || "—"}
            {approval.signedAt ? ` · Date: ${formatJurecDate(approval.signedAt)}` : ""}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginTop: 14 }}>
            ETHICAL APPROVAL CERTIFICATE
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>On Research Involving Human Subjects</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, alignItems: "center" }}>
            <MetaLine label="Serial Number" value={approval.serialNumber || approval.refNumber} />
            <MetaLine label="Certificate Number" value={approval.certificateNumber || approval.certificateId} />
            <MetaLine label="Date of Issue" value={approval.signedAt ? formatJurecDate(approval.signedAt) : null} />
          </div>
          <div style={{ marginTop: 14, maxWidth: 420, marginInline: "auto", textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4, textAlign: "center" }}>Approval Details</div>
            <ApprovalDetailsBoxes
              receivedAt={approval.receivedAt}
              reviewedAt={approval.reviewedAt}
              approvedAt={approval.signedAt}
            />
          </div>
        </>
      ) : showCertificateMeta && approval ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <MetaLine label="Academic Year" value={approval.academicYear || defaultAcademic} />
          <MetaLine label="Year" value={approval.year || String(y)} />
          <MetaLine label="Serial Number" value={approval.serialNumber} />
          <MetaLine label="Certificate ID" value={approval.certificateId} />
        </div>
      ) : null}

      {!isApprovedCert ? (
        <>
          <img
            src={logo}
            alt="Jamhuriya University of Science and Technology"
            style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto 10px" }}
          />
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: "0.02em" }}>
            Jamhuriya University of Science & Technology
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Research Ethical Committee (REC)</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0ea5e9", marginTop: 10 }}>
            Application for Ethical Clearance
          </div>
        </>
      ) : (
        <img
          src={logo}
          alt="Jamhuriya University"
          style={{ width: 56, height: 56, objectFit: "contain", margin: "14px auto 0" }}
        />
      )}
    </div>
  );
}
