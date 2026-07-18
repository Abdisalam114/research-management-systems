import { useEffect, useMemo, useState } from "react";
import * as ethicsApi from "../services/ethicsApi";
import { JurecCertificatePreview } from "./JurecCertificatePreview";
import { toDateInputValue } from "../utils/jurecFormat";

const defaultAcademicYear = () => {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
};

/** Fallback if API preview fails — must match backend JUREC_CHAIRPERSON_OPTIONS */
const FALLBACK_CHAIRPERSONS = [
  { key: "kasim", name: "Kasim Abdi Jimale", title: "Chairperson", line: "Kasim Abdi Jimale" },
  { key: "nur", name: "Dr. Nur Rashid Ahmed", title: "Chairperson", line: "Dr. Nur Rashid Ahmed" },
];

const EMPTY_CERT = {
  refNumber: "",
  serialNumber: "",
  certificateNumber: "",
  signedAt: "",
  receivedAt: "",
  reviewedAt: "",
  principalInvestigator: "",
  facultyCenter: "",
  projectTitle: "",
  chairpersonLine: "",
  signatoryTitle: "Chairperson",
};

/** Modal for Director approve/reject — full editable certificate preview before printing. */
export function EthicsDirectorDecisionModal({
  open,
  mode,
  applicationId,
  accessToken,
  applicationTitle,
  busy,
  onClose,
  onConfirm,
}) {
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [cert, setCert] = useState(EMPTY_CERT);
  const [rejectionReason, setRejectionReason] = useState("");
  const [signatoryKey, setSignatoryKey] = useState("kasim");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [signatories, setSignatories] = useState(FALLBACK_CHAIRPERSONS);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAcademicYear(defaultAcademicYear());
    setYear(String(new Date().getFullYear()));
    setRejectionReason("");
    setSignatoryKey("kasim");
    setIncludeSignature(true);
    setIncludeStamp(true);
    setSignatories(FALLBACK_CHAIRPERSONS);
    setLocalError("");
    setCert({
      ...EMPTY_CERT,
      chairpersonLine: FALLBACK_CHAIRPERSONS[0].line,
      signatoryTitle: "Chairperson",
    });
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "approve" || !applicationId || !accessToken) return;
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const res = await ethicsApi.previewCertificate(accessToken, applicationId);
        if (cancelled) return;
        const p = res.preview || {};
        const options =
          Array.isArray(res.signatories) && res.signatories.length > 0
            ? res.signatories.filter((s) => s.key === "kasim" || s.key === "nur")
            : FALLBACK_CHAIRPERSONS;
        const defaultKey =
          options.some((s) => s.key === p.signatoryKey) ? p.signatoryKey : options[0]?.key || "kasim";
        const defaultSignatory = options.find((s) => s.key === defaultKey) || options[0];
        setSignatories(options);
        setSignatoryKey(defaultKey);
        setCert({
          refNumber: "",
          serialNumber: p.serialNumber || "",
          certificateNumber: "",
          signedAt: toDateInputValue(p.signedAt),
          receivedAt: toDateInputValue(p.receivedAt),
          reviewedAt: toDateInputValue(p.reviewedAt),
          principalInvestigator: p.principalInvestigator || "",
          facultyCenter: p.facultyCenter || "",
          projectTitle: p.projectTitle || "",
          chairpersonLine: defaultSignatory?.line || defaultSignatory?.name || "",
          signatoryTitle: defaultSignatory?.title || "Chairperson",
        });
      } catch (e) {
        if (!cancelled) {
          setSignatories(FALLBACK_CHAIRPERSONS);
          setSignatoryKey("kasim");
          setCert((prev) => ({
            ...prev,
            chairpersonLine: FALLBACK_CHAIRPERSONS[0].line,
            signatoryTitle: "Chairperson",
          }));
          setLocalError(e?.response?.data?.message || "Could not load certificate preview");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, applicationId, accessToken]);

  const liveCert = useMemo(
    () => ({
      ...cert,
      signedAt: cert.signedAt ? new Date(cert.signedAt).toISOString() : null,
      receivedAt: cert.receivedAt ? new Date(cert.receivedAt).toISOString() : null,
      reviewedAt: cert.reviewedAt ? new Date(cert.reviewedAt).toISOString() : null,
    }),
    [cert]
  );

  function updateCert(field, value) {
    setCert((prev) => ({ ...prev, [field]: value }));
  }

  function handleSignatoryChange(key) {
    setSignatoryKey(key);
    const list = signatories.length ? signatories : FALLBACK_CHAIRPERSONS;
    const found = list.find((s) => s.key === key);
    if (found) {
      setCert((prev) => ({
        ...prev,
        chairpersonLine: found.line || found.name || prev.chairpersonLine,
        signatoryTitle: found.title || "Chairperson",
      }));
    }
}

  if (!open) return null;

  function handleConfirm() {
    setLocalError("");
    if (mode === "reject" && !rejectionReason.trim()) {
      setLocalError("Enter a rejection reason.");
      return;
    }
    if (mode === "approve") {
      if (!cert.refNumber?.trim() || !cert.certificateNumber?.trim()) {
        setLocalError("Ref number iyo certificate number waa in Director-ku geliyo (labadaba waa qasab).");
        return;
      }
      if (!signatoryKey || !(signatories.length ? signatories : FALLBACK_CHAIRPERSONS).some((s) => s.key === signatoryKey)) {
        setLocalError("Dooro chairperson — Kasim Abdi Jimale ama Dr. Nur Rashid Ahmed.");
        return;
      }
      onConfirm({
        decision: "approve",
        academicYear: academicYear.trim() || defaultAcademicYear(),
        year: year.trim() || String(new Date().getFullYear()),
        refNumber: cert.refNumber.trim(),
        // Serial Number is always system-generated on the server
        certificateNumber: cert.certificateNumber.trim(),
        signedAt: cert.signedAt || undefined,
        receivedAt: cert.receivedAt || undefined,
        reviewedAt: cert.reviewedAt || undefined,
        principalInvestigator: cert.principalInvestigator.trim(),
        facultyCenter: cert.facultyCenter.trim(),
        projectTitle: cert.projectTitle.trim(),
        chairpersonLine: cert.chairpersonLine.trim(),
        signatoryTitle: cert.signatoryTitle.trim() || "Chairperson",
        signatoryKey,
        includeSignature,
        includeStamp,
      });
    } else {
      onConfirm({ decision: "reject", rejectionReason: rejectionReason.trim() });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="card"
        style={{ maxWidth: mode === "approve" ? 960 : 440, width: "100%", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          {mode === "approve" ? "Edit certificate & approve" : "Reject ethics"}
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {applicationTitle || "Ethics application"}
        </p>

        {mode === "approve" ? (
          previewLoading ? (
            <p className="muted">Loading certificate draft…</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 1fr) minmax(300px, 1fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Live preview (ka hor daabacaadda)</div>
                <JurecCertificatePreview cert={liveCert} includeSignature={includeSignature} includeStamp={includeStamp} />
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Edit certificate fields</div>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Ref Number iyo Certificate Number — Director-ku ayaa gelinaya.
                </p>

                <div className="field">
                  <label>Ref Number * (Director geliyo)</label>
                  <input
                    value={cert.refNumber}
                    onChange={(e) => updateCert("refNumber", e.target.value)}
                    disabled={busy}
                    placeholder="e.g. JUREC/0001/faculty/062026"
                  />
                </div>
                <div className="field">
                  <label>Certificate Number * (Director geliyo)</label>
                  <input
                    value={cert.certificateNumber}
                    onChange={(e) => updateCert("certificateNumber", e.target.value)}
                    disabled={busy}
                    placeholder="e.g. JUREC0001/faculty/062026"
                  />
                </div>

                <div className="field">
                  <label>Serial Number (automatic)</label>
                  <input
                    value={cert.serialNumber}
                    readOnly
                    disabled
                    title="Generated automatically by the system"
                    style={{ opacity: 0.85, cursor: "not-allowed" }}
                  />
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 11 }}>
                    System ayaa otomaatig u sameeya — lama beddeli karo.
                  </p>
                </div>

                <div style={{ marginTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Approval Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    <DateBox label="Received" value={cert.receivedAt} onChange={(v) => updateCert("receivedAt", v)} disabled={busy} />
                    <DateBox label="Reviewed" value={cert.reviewedAt} onChange={(v) => updateCert("reviewedAt", v)} disabled={busy} />
                    <DateBox label="Approved" value={cert.signedAt} onChange={(v) => updateCert("signedAt", v)} disabled={busy} />
                  </div>
                </div>

                <div className="field">
                  <label>Date of issue (header date)</label>
                  <input type="date" value={cert.signedAt} onChange={(e) => updateCert("signedAt", e.target.value)} disabled={busy} />
                </div>

                <div className="field">
                  <label>Principal Investigator</label>
                  <input value={cert.principalInvestigator} onChange={(e) => updateCert("principalInvestigator", e.target.value)} disabled={busy} />
                </div>
                <div className="field">
                  <label>Faculty / Center</label>
                  <input value={cert.facultyCenter} onChange={(e) => updateCert("facultyCenter", e.target.value)} disabled={busy} />
                </div>
                <div className="field">
                  <label>Title of project</label>
                  <textarea rows={2} value={cert.projectTitle} onChange={(e) => updateCert("projectTitle", e.target.value)} disabled={busy} />
                </div>

                <div className="field">
                  <label>Chairperson (doorasho) *</label>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: 11 }}>
                    Dooro mid: Kasim Abdi Jimale ama Dr. Nur Rashid Ahmed — magaca ayaa ka muuqan doona shahaadada.
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Chairperson"
                    style={{ display: "grid", gap: 8 }}
                  >
                    {(signatories.length ? signatories : FALLBACK_CHAIRPERSONS).map((s) => {
                      const selected = signatoryKey === s.key;
                      return (
                        <label
                          key={s.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: selected
                              ? "2px solid rgba(14,165,233,0.75)"
                              : "1px solid rgba(148,163,184,0.45)",
                            background: selected ? "rgba(14,165,233,0.08)" : "transparent",
                            cursor: busy ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: selected ? 700 : 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="jurec-chairperson"
                            value={s.key}
                            checked={selected}
                            disabled={busy}
                            onChange={() => handleSignatoryChange(s.key)}
                          />
                          <span>
                            {s.name}
                            <span className="muted" style={{ display: "block", fontSize: 11, fontWeight: 500 }}>
                              {s.title || "Chairperson"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={includeSignature} onChange={(e) => setIncludeSignature(e.target.checked)} disabled={busy} />
                    Include signature (saxiix)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={includeStamp} onChange={(e) => setIncludeStamp(e.target.checked)} disabled={busy} />
                    Include official stamp (shaabad)
                  </label>
                </div>

                <div className="row">
                  <div className="field">
                    <label>Academic year</label>
                    <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} disabled={busy} />
                  </div>
                  <div className="field">
                    <label>Year</label>
                    <input value={year} onChange={(e) => setYear(e.target.value)} disabled={busy} />
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="field">
            <label>Rejection reason *</label>
            <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} disabled={busy} />
          </div>
        )}

        {localError ? <div style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{localError}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="btn primary" disabled={busy || (mode === "approve" && previewLoading)} onClick={handleConfirm}>
            {busy ? "Working…" : mode === "approve" ? "Approve & issue certificate" : "Reject"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DateBox({ label, value, onChange, disabled }) {
  return (
    <div
      style={{
        border: "1px solid rgba(14,165,233,0.35)",
        borderRadius: 8,
        padding: 8,
        background: "rgba(14,165,233,0.04)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 6, textAlign: "center" }}>{label}</div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: "100%", fontSize: 12 }}
      />
    </div>
  );
}
