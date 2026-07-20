import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { withProjectContext } from "../utils/projectContextLink";

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

function StepRow({ step, index, highlighted }) {
  const style = STATUS_STYLE[step.status] || STATUS_STYLE.pending;
  const isCurrent = step.status === "current";
  return (
    <div
      id={isCurrent ? "workflow-current-step" : undefined}
      className="card"
      style={{
        marginTop: index === 0 ? 0 : 8,
        background: style.bg,
        borderColor: highlighted || isCurrent ? "rgba(14,165,233,0.85)" : style.border,
        borderLeftWidth: 4,
        borderLeftColor: style.iconBg,
        boxShadow: highlighted || isCurrent ? "0 0 0 2px rgba(14,165,233,0.25)" : undefined,
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
            <Link
              className="btn"
              to={step.link}
              style={{ fontSize: 12 }}
              onClick={() => {
                // #region agent log
                fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
                  body: JSON.stringify({
                    sessionId: "f558f7",
                    runId: "auto-project-context",
                    hypothesisId: "P1",
                    location: "ProjectWorkflowPanel.jsx:Open",
                    message: "workflow Open with project context",
                    data: {
                      stepKey: step.key || null,
                      link: step.link,
                      hasProjectId: String(step.link || "").includes("projectId="),
                    },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
              }}
            >
              Open
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Full research workflow for one project (proposal → repository). */
export function ProjectWorkflowPanel({ workflow, projectId = null, proposalId = null }) {
  const location = useLocation();
  const panelRef = useRef(null);
  const progress = workflow?.progressPercent;
  const currentLabel = workflow?.currentStepLabel;
  const focusWorkflow =
    location.hash === "#workflow" || Boolean(location.state?.focusWorkflow);

  useEffect(() => {
    if (!focusWorkflow || !panelRef.current) return;
    panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "W1",
        location: "ProjectWorkflowPanel.jsx:focus",
        message: "scrolled to project workflow panel",
        data: { currentLabel: currentLabel || null, hash: location.hash || null },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
  }, [focusWorkflow, currentLabel, location.hash]);

  if (!workflow) return null;

  const visibleSteps = (workflow.steps || [])
    .filter((step) => {
      if (!workflow?.isVoluntary) return true;
      return !["grant_apply", "grant_award", "budget"].includes(step.key);
    })
    .map((step) => ({
      ...step,
      link: withProjectContext(step.link, { projectId, proposalId }),
    }));

  const currentSteps = visibleSteps.filter((s) => s.status === "current");
  const currentLabels = currentSteps.map((s) => s.label).filter(Boolean);
  const displayCurrentLabel =
    currentLabels.length > 1 ? currentLabels.join(" · ") : currentLabel || currentLabels[0];

  return (
    <div
      id="project-workflow"
      ref={panelRef}
      className="card"
      style={{
        marginTop: 16,
        borderColor: focusWorkflow ? "rgba(14,165,233,0.7)" : "rgba(56,189,248,0.35)",
        scrollMarginTop: 88,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16 }}>Research workflow — this project</div>
      {projectId ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Open buttons keep this project selected — no need to re-enter the title.
        </div>
      ) : null}
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {workflow?.isVoluntary
          ? "Proposal → ethics → review → project → publication → repository (no grants/budget). Steps can progress independently."
          : workflow?.projectStatus !== "completed" && workflow?.projectStatus !== "closed"
            ? "Proposal → ethics → review → project → publication → repository · Funding-call grants after Completed/Closed. Steps can progress independently."
            : workflow?.awardsVisible === false
              ? "Proposal → ethics → review → project → publication → repository · Grant amounts after publication."
              : "Proposal → ethics → review → project → funding-call grant → budget → publication → repository."}
      </div>

      {displayCurrentLabel ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(14,165,233,0.12)",
            border: "1px solid rgba(14,165,233,0.45)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Hadda waxaad joogtaa · You are here
            {currentLabels.length > 1 ? " (tallaabooyin badan — mid mid u hormar)" : ""}
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4, color: "#0c4a6e" }}>{displayCurrentLabel}</div>
          {progress != null ? (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{progress}% project progress</div>
          ) : null}
        </div>
      ) : null}

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
          {workflow.projectStatus ? (
            <>
              {" "}
              • Project: <strong>{workflow.projectStatus}</strong>
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
        {visibleSteps.map((step, idx) => (
          <StepRow
            key={step.key}
            step={step}
            index={idx}
            highlighted={focusWorkflow && step.status === "current"}
          />
        ))}
      </div>
    </div>
  );
}

/** Compact summary for project list rows and dashboards. */
export function ProjectWorkflowSummary({ workflow, projectId }) {
  if (!workflow?.currentStepLabel && workflow?.progressPercent == null) return null;
  const to = projectId ? `/projects/${projectId}#workflow` : null;
  const body = (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(14,165,233,0.08)",
        border: "1px solid rgba(14,165,233,0.28)",
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.4 }}>
        Workflow · meesha uu joogo
      </div>
      {workflow.currentStepLabel ? (
        <div style={{ marginTop: 2, fontWeight: 800, color: "#0c4a6e" }}>{workflow.currentStepLabel}</div>
      ) : null}
      {workflow.progressPercent != null ? (
        <div className="muted" style={{ marginTop: 2 }}>{workflow.progressPercent}% progress</div>
      ) : null}
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {body}
    </Link>
  );
}
