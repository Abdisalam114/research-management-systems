import { Link } from "react-router-dom";

const STATUS_STYLE = {
  completed: {
    bg: "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.55)",
    color: "#15803d",
    badgeBg: "rgba(34,197,94,0.22)",
    iconBg: "#22c55e",
    iconColor: "#fff",
    icon: "✓",
    label: "Done",
    labelSo: "Waa la dhammeeyay",
  },
  current: {
    bg: "rgba(56,189,248,0.14)",
    border: "rgba(56,189,248,0.6)",
    color: "#0369a1",
    badgeBg: "rgba(56,189,248,0.25)",
    iconBg: "#0ea5e9",
    iconColor: "#fff",
    icon: "→",
    label: "Current step",
    labelSo: "Hadda waa kan aad ku jirto",
  },
  pending: {
    bg: "rgba(148,163,184,0.1)",
    border: "rgba(100,116,139,0.35)",
    color: "#475569",
    badgeBg: "rgba(148,163,184,0.22)",
    iconBg: "#94a3b8",
    iconColor: "#fff",
    icon: "○",
    label: "Pending",
    labelSo: "Wali ma imaan",
  },
  blocked: {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.55)",
    color: "#b91c1c",
    badgeBg: "rgba(239,68,68,0.22)",
    iconBg: "#ef4444",
    iconColor: "#fff",
    icon: "✕",
    label: "Blocked",
    labelSo: "Waa la xannibay",
  },
  skipped: {
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.3)",
    color: "#7e22ce",
    badgeBg: "rgba(168,85,247,0.18)",
    iconBg: "#a855f7",
    iconColor: "#fff",
    icon: "—",
    label: "Skipped",
    labelSo: "Lama baahna",
  },
};

const LEGEND_KEYS = ["completed", "current", "pending", "blocked"];

function StatusLegend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.04)",
        border: "1px solid rgba(148,163,184,0.2)",
      }}
    >
      {LEGEND_KEYS.map((key) => {
        const s = STATUS_STYLE[key];
        return (
          <span
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: s.badgeBg,
              color: s.color,
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${s.border}`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: s.iconBg,
                color: s.iconColor,
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {s.icon}
            </span>
            {s.label}
            <span style={{ fontWeight: 500, opacity: 0.85 }}>· {s.labelSo}</span>
          </span>
        );
      })}
    </div>
  );
}

function StepRow({ step, index }) {
  const style = STATUS_STYLE[step.status] || STATUS_STYLE.pending;
  return (
    <div
      className="card"
      style={{
        marginTop: index === 0 ? 0 : 8,
        background: style.bg,
        borderColor: style.border,
        borderLeftWidth: 4,
        borderLeftColor: style.iconBg,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: style.iconBg,
          color: style.iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {style.icon}
      </div>
      <div>
        <div style={{ fontWeight: 800, color: style.color }}>{step.label}</div>
        {step.detail ? <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{step.detail}</div> : null}
        {step.at ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{new Date(step.at).toLocaleString()}</div> : null}
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "3px 8px",
            borderRadius: 6,
            background: style.badgeBg,
            color: style.color,
            border: `1px solid ${style.border}`,
          }}
        >
          {style.label}
        </span>
        {step.link ? (
          <div style={{ marginTop: 6 }}>
            <Link className="btn" to={step.link} style={{ fontSize: 12 }}>
              Open
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Full research workflow for one project (proposal → repository). */
export function ProjectWorkflowPanel({ workflow }) {
  if (!workflow) return null;

  const progress = workflow.progressPercent;

  return (
    <div className="card" style={{ marginTop: 16, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Research workflow — this project</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {workflow?.projectStatus !== "completed"
          ? "Proposal → ethics → review → project progress → budget → project completed → grants (pending) → publication → repository."
          : workflow?.awardsVisible === false
            ? "Proposal → ethics → review → project progress → budget → project completed → publication → repository."
            : "Proposal → ethics → review → project progress → budget → project completed → grant awarded → publication → repository."}
      </div>
      <StatusLegend />

      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div className="muted" style={{ fontSize: 13 }}>
          Proposal: <strong>{workflow.proposalStatus || "—"}</strong>
          {workflow.currentStepLabel ? (
            <>
              {" "}
              • Current: <strong style={{ color: "#0369a1" }}>{workflow.currentStepLabel}</strong>
            </>
          ) : null}
        </div>
        {progress != null ? (
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textAlign: "right" }}>{progress}% progress</div>
            <div
              style={{
                marginTop: 4,
                height: 6,
                borderRadius: 999,
                background: "rgba(148,163,184,0.25)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  height: "100%",
                  background: "#0ea5e9",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {(workflow.steps || []).map((step, idx) => (
          <StepRow key={step.key} step={step} index={idx} />
        ))}
      </div>
    </div>
  );
}

/** Compact summary for project list rows. */
export function ProjectWorkflowSummary({ workflow }) {
  if (!workflow?.currentStepLabel) return null;
  return (
    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
      Workflow: <strong style={{ color: "#0369a1" }}>{workflow.currentStepLabel}</strong>
      {workflow.progressPercent != null ? ` • ${workflow.progressPercent}% progress` : null}
    </div>
  );
}
