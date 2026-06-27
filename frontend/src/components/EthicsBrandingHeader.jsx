import logo from "../assets/jamhuriya-logo.png";

function MetaLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
      {label}: <span style={{ fontWeight: 600, color: "#334155" }}>{value}</span>
    </div>
  );
}

/** Shared header for ethics application form and certificate preview context. */
export function EthicsBrandingHeader({ approval, showCertificateMeta = false }) {
  const y = new Date().getFullYear();
  const defaultAcademic = `${y}/${y + 1}`;

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
      {showCertificateMeta && approval ? (
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
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Faculty of Applied Medical Sciences</div>
    </div>
  );
}
