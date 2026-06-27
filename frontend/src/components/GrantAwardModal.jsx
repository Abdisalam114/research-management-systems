import { useEffect, useState } from "react";

/** Modal for Director to enter awarded amount — replaces window.prompt. */
export function GrantAwardModal({ open, grant, busy, onClose, onConfirm }) {
  const [amountAwarded, setAmountAwarded] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmountAwarded(String(grant?.amountRequested ?? ""));
    setLocalError("");
  }, [open, grant]);

  if (!open) return null;

  function handleConfirm() {
    setLocalError("");
    let amount = Number(amountAwarded);
    if (!Number.isFinite(amount) || amount < 0) {
      setLocalError("Enter the awarded amount (valid number).");
      return;
    }
    if (amount === 0) amount = Number(grant?.amountRequested || 0);
    if (amount <= 0) {
      setLocalError("Awarded amount must be greater than zero.");
      return;
    }
    onConfirm(amount);
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
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Approve grant — awarded amount</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {grant?.title || "Grant"}
        </p>
        {grant?.project?.title ? (
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
            Research project: <strong>{grant.project.title}</strong>
          </p>
        ) : null}
        <p className="muted" style={{ marginTop: 0, fontSize: 12, lineHeight: 1.45 }}>
          A budget will be created automatically for the researcher when you approve this award.
        </p>
        <div className="field">
          <label>Amount awarded ({grant?.currency || "USD"})</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountAwarded}
            onChange={(e) => setAmountAwarded(e.target.value)}
            disabled={busy}
          />
        </div>
        {grant?.amountRequested ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Requested: {grant.amountRequested} {grant.currency}
          </p>
        ) : null}
        {localError ? <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{localError}</div> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn primary" disabled={busy} onClick={handleConfirm}>
            {busy ? "Working…" : "Approve"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
