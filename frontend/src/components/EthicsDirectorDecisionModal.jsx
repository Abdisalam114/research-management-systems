import { useEffect, useState } from "react";

const defaultAcademicYear = () => {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
};

/** Modal for Director approve/reject — replaces window.prompt (often blocked or confusing). */
export function EthicsDirectorDecisionModal({ open, mode, applicationTitle, busy, onClose, onConfirm }) {
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [serialNumber, setSerialNumber] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAcademicYear(defaultAcademicYear());
    setYear(String(new Date().getFullYear()));
    setSerialNumber("");
    setRejectionReason("");
    setLocalError("");
  }, [open, mode]);

  if (!open) return null;

  function handleConfirm() {
    setLocalError("");
    if (mode === "reject" && !rejectionReason.trim()) {
      setLocalError("Enter a rejection reason.");
      return;
    }
    if (mode === "approve") {
      onConfirm({
        decision: "approve",
        academicYear: academicYear.trim() || defaultAcademicYear(),
        year: year.trim() || String(new Date().getFullYear()),
        serialNumber: serialNumber.trim() || undefined,
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
      <div className="card" style={{ maxWidth: 440, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          {mode === "approve" ? "Approve & issue certificate" : "Reject ethics"}
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {applicationTitle || "Ethics application"}
        </p>

        {mode === "approve" ? (
          <>
            <div className="field">
              <label>Academic year</label>
              <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} disabled={busy} />
            </div>
            <div className="field">
              <label>Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} disabled={busy} />
            </div>
            <div className="field">
              <label>Serial number (optional)</label>
              <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} disabled={busy} />
            </div>
          </>
        ) : (
          <div className="field">
            <label>Rejection reason *</label>
            <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} disabled={busy} />
          </div>
        )}

        {localError ? <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{localError}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn primary" disabled={busy} onClick={handleConfirm}>
            {busy ? "Working…" : mode === "approve" ? "Approve" : "Reject"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
