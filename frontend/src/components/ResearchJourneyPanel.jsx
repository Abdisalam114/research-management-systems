import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as analyticsApi from "../services/analyticsApi";

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
                flexShrink: 0,
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

/** Research pipeline tracker — proposal through repository (embedded in Research Workflow Status). */
export function ResearchJourneyPanel() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState(null);
  const [selectedResearcherId, setSelectedResearcherId] = useState("");
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);

  const isStaff = ["research_director", "faculty_coordinator"].includes(user?.role);

  const load = useCallback(async () => {
    const res = await analyticsApi.researchJourney(
      accessToken,
      isStaff && selectedResearcherId ? selectedResearcherId : undefined
    );
    setData(res);
    setActiveTrackIdx(0);
  }, [accessToken, isStaff, selectedResearcherId]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, [selectedResearcherId]);

  useEffect(() => {
    if (data?.mode === "picker" && !selectedResearcherId && data.researchers?.length === 1) {
      setSelectedResearcherId(data.researchers[0].id);
    }
  }, [data, selectedResearcherId]);

  const tracks = data?.tracks || [];
  const activeTrack = tracks[activeTrackIdx] || null;
  const timeline = data?.timeline || [];

  return (
    <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Research pipeline</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Proposal → ethics → project → grant → budget → publication → repository.
      </div>
      <StatusLegend />

      {error ? (
        <div style={{ color: "#f87171", marginTop: 12 }}>{error}</div>
      ) : null}

      {isStaff && data?.mode === "picker" ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Select researcher</div>
          <div className="field">
            <label>Researcher</label>
            <select
              value={selectedResearcherId}
              onChange={(e) => {
                setError("");
                setSelectedResearcherId(e.target.value);
              }}
            >
              <option value="">— Choose researcher —</option>
              {(data.researchers || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.department || "—"})
                  {r.latestProposal ? ` — ${r.latestProposal.status}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading pipeline…</div> : null}

      {!loading && data?.mode === "journey" ? (
        <>
          {data.summary ? (
            <div className="overviewGrid" style={{ marginTop: 12 }}>
              <div className="overviewTile"><div className="label">Proposals</div><div className="value">{data.summary.proposals}</div></div>
              <div className="overviewTile"><div className="label">Projects</div><div className="value">{data.summary.projects}</div></div>
              <div className="overviewTile"><div className="label">Grants</div><div className="value">{data.summary.grants}</div></div>
              <div className="overviewTile"><div className="label">Publications</div><div className="value">{data.summary.publications}</div></div>
            </div>
          ) : null}

          {tracks.length > 1 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Research lines</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {tracks.map((t, idx) => (
                  <button
                    key={t.proposalId}
                    type="button"
                    className={idx === activeTrackIdx ? "btn primary" : "btn"}
                    onClick={() => setActiveTrackIdx(idx)}
                  >
                    {t.title.slice(0, 40)}{t.title.length > 40 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeTrack ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{activeTrack.title}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                Proposal: {activeTrack.proposalStatus}
                {activeTrack.currentStepLabel ? ` • Current: ${activeTrack.currentStepLabel}` : ""}
              </div>
              <div style={{ marginTop: 14 }}>
                {activeTrack.steps.map((step, idx) => (
                  <StepRow key={step.key} step={step} index={idx} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="muted">No proposals yet. Start by creating a research proposal.</div>
              <Link className="btn primary" to="/proposals/new" style={{ marginTop: 10, display: "inline-block" }}>
                New proposal
              </Link>
            </div>
          )}

          {timeline.length ? (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(56,189,248,0.18)" }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Recent activity timeline</div>
              <div style={{ display: "grid", gap: 8 }}>
                {timeline.map((ev, idx) => (
                  <div key={`${ev.at}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{ev.label}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{new Date(ev.at).toLocaleString()}</div>
                    </div>
                    {ev.link ? <Link className="btn" to={ev.link} style={{ fontSize: 12 }}>View</Link> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isStaff ? (
            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => { setSelectedResearcherId(""); reload(); }}>
              ← Choose another researcher
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
