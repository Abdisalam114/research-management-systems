import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as analyticsApi from "../services/analyticsApi";
import { withProjectContext } from "../utils/projectContextLink";

const LC_FILTERS = ["all", "projects", "proposals", "grants", "publications"];
const STEP_FILTERS = ["completed", "current", "pending", "blocked"];

const LC_FILTER_LABELS = {
  all: "All",
  projects: "Projects",
  proposals: "Proposals",
  grants: "Grants",
  publications: "Publications",
};

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

function itemHasGrantStep(item) {
  return (item.steps || []).some(
    (s) => ["grant_apply", "grant_award", "budget"].includes(s.key) && s.status !== "skipped"
  );
}

function itemHasPublicationStep(item) {
  return (item.steps || []).some(
    (s) =>
      (s.key === "repository" ||
        s.key === "project_completed" ||
        s.key?.startsWith("pub_") ||
        s.section === "publish") &&
      s.status !== "skipped"
  );
}

function itemMatchesLcFilter(item, kind, lcFilter) {
  if (!lcFilter || lcFilter === "all") return true;
  if (lcFilter === "projects") return kind === "project";
  if (lcFilter === "proposals") return kind === "proposal";
  if (lcFilter === "grants") return itemHasGrantStep(item);
  if (lcFilter === "publications") return itemHasPublicationStep(item);
  return true;
}

function itemMatchesStepFilter(item, stepFilter) {
  if (!stepFilter) return true;
  return (item.steps || []).some((s) => s.status === stepFilter);
}

function StatusLegend({ activeStepFilter, onStepFilterChange }) {
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
      <button
        type="button"
        className={`btn sm${!activeStepFilter ? " primary" : ""}`}
        onClick={() => onStepFilterChange("")}
      >
        All steps
      </button>
      {STEP_FILTERS.map((key) => {
        const s = STATUS_STYLE[key];
        return (
          <button
            key={key}
            type="button"
            className={`btn sm${activeStepFilter === key ? " primary" : ""}`}
            onClick={() => onStepFilterChange(activeStepFilter === key ? "" : key)}
            style={
              activeStepFilter === key
                ? undefined
                : { borderColor: s.border, color: s.color, background: s.badgeBg }
            }
          >
            {s.icon} {s.label}
          </button>
        );
      })}
    </div>
  );
}

function StepRow({ step, index, projectId = null, proposalId = null }) {
  const style = STATUS_STYLE[step.status] || STATUS_STYLE.pending;
  const link = withProjectContext(step.link, { projectId, proposalId });
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
        {link ? (
          <div style={{ marginTop: 6 }}>
            <Link className={`btn sm${step.status === "current" ? " primary" : ""}`} to={link}>
              Open
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PipelineCard({ item, kind = "project", highlighted = false, stepFilter = "" }) {
  const isProject = kind === "project";
  const progress = item.progressPercent;
  const projectHref = isProject && item.projectId ? `/projects/${item.projectId}#workflow` : null;
  const proposalHref = !isProject && item.proposalId ? `/proposals/${item.proposalId}` : null;
  const visibleSteps = (item.steps || []).filter((s) => !stepFilter || s.status === stepFilter);

  return (
    <div
      className="card"
      style={{
        marginTop: 14,
        borderColor: highlighted
          ? "rgba(14,165,233,0.85)"
          : isProject
            ? "rgba(56,189,248,0.45)"
            : "rgba(148,163,184,0.35)",
        borderStyle: isProject ? "solid" : "dashed",
        boxShadow: highlighted ? "0 0 0 2px rgba(14,165,233,0.25)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: isProject ? "#0ea5e9" : "#64748b" }}>
            {isProject ? "Project" : "Proposal (before project)"}
          </div>
          <div style={{ fontWeight: 900, fontSize: 17, marginTop: 4 }}>{item.title}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {isProject ? (
              <>
                Status: <strong>{item.projectStatus}</strong>
                {item.proposalStatus ? ` • Proposal: ${item.proposalStatus}` : null}
              </>
            ) : (
              <>Proposal status: <strong>{item.proposalStatus}</strong></>
            )}
          </div>
          {item.currentStepLabel ? (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(14,165,233,0.12)",
                border: "1px solid rgba(14,165,233,0.35)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 700, color: "#0369a1" }}>Hadda waa joogtaa:</span>{" "}
              <strong style={{ color: "#0c4a6e" }}>{item.currentStepLabel}</strong>
              {progress != null ? <span className="muted"> · {progress}%</span> : null}
            </div>
          ) : null}
        </div>
        <div className="workflowItemActions">
          {isProject && progress != null ? (
            <div style={{ minWidth: 120, textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{progress}% progress</div>
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
          {projectHref ? (
            <Link className="btn sm primary" to={projectHref}>
              Open project workflow
            </Link>
          ) : null}
          {proposalHref ? (
            <Link className="btn sm" to={proposalHref}>
              Open proposal
            </Link>
          ) : null}
          {isProject && item.projectId ? (
            <Link className="btn sm" to={`/research-workflow?tab=lifecycle&projectId=${item.projectId}`}>
              Focus here
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(56,189,248,0.15)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#64748b" }}>
          Workflow steps for this {isProject ? "project" : "proposal"}
          {stepFilter ? ` (${visibleSteps.length} matching)` : ""}
        </div>
        {visibleSteps.length ? (
          visibleSteps.map((step, idx) => (
            <StepRow
              key={step.key}
              step={step}
              index={idx}
              projectId={item.projectId || null}
              proposalId={item.proposalId || null}
            />
          ))
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>No steps match the active step filter.</div>
        )}
      </div>
    </div>
  );
}

/** Projects with embedded workflow steps (Research Workflow — Lifecycle tab). */
export function ResearchJourneyPanel() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusProjectId = searchParams.get("projectId") || "";
  const lcFilter = LC_FILTERS.includes(searchParams.get("lc")) ? searchParams.get("lc") : "all";
  const stepFilter = STEP_FILTERS.includes(searchParams.get("lcStep")) ? searchParams.get("lcStep") : "";
  const [data, setData] = useState(null);
  const [selectedResearcherId, setSelectedResearcherId] = useState("");

  const isStaff = ["research_director", "faculty_coordinator"].includes(user?.role);

  const patchLifecycleParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "lifecycle");
          Object.entries(patch).forEach(([key, value]) => {
            if (value == null || value === "" || value === "all") next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const load = useCallback(async () => {
    const res = await analyticsApi.researchJourney(
      accessToken,
      isStaff && selectedResearcherId ? selectedResearcherId : undefined
    );
    setData(res);
  }, [accessToken, isStaff, selectedResearcherId, programTier]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, [selectedResearcherId, programTier]);

  useEffect(() => {
    if (data?.mode === "picker" && !selectedResearcherId && data.researchers?.length === 1) {
      setSelectedResearcherId(data.researchers[0].id);
    }
  }, [data, selectedResearcherId]);

  const allProjects = data?.projects || [];
  const allPending = data?.pendingProposals || [];

  const filteredProjects = useMemo(() => {
    let list = focusProjectId
      ? allProjects.filter((p) => String(p.projectId) === String(focusProjectId))
      : allProjects;
    list = list.filter(
      (p) => itemMatchesLcFilter(p, "project", lcFilter) && itemMatchesStepFilter(p, stepFilter)
    );
    return list;
  }, [allProjects, focusProjectId, lcFilter, stepFilter]);

  const filteredPending = useMemo(() => {
    if (focusProjectId) return [];
    return allPending.filter(
      (p) => itemMatchesLcFilter(p, "proposal", lcFilter) && itemMatchesStepFilter(p, stepFilter)
    );
  }, [allPending, focusProjectId, lcFilter, stepFilter]);

  const timeline = data?.timeline || [];
  const hasContent = filteredProjects.length > 0 || filteredPending.length > 0;
  const showProjects = lcFilter === "all" || lcFilter === "projects" || lcFilter === "grants" || lcFilter === "publications";
  const showPending = !focusProjectId && (lcFilter === "all" || lcFilter === "proposals");

  const summaryStats = useMemo(
    () => [
      { key: "all", label: "All items", value: allProjects.length + allPending.length },
      { key: "projects", label: "Projects", value: data?.summary?.projects ?? allProjects.length },
      { key: "proposals", label: "Proposals", value: data?.summary?.proposals ?? allPending.length },
      { key: "grants", label: "Grants track", value: allProjects.filter(itemHasGrantStep).length },
      {
        key: "publications",
        label: "Publications track",
        value: allProjects.filter(itemHasPublicationStep).length,
      },
    ],
    [allProjects, allPending, data?.summary]
  );

  function clearAllFilters() {
    patchLifecycleParams({ lc: null, lcStep: null, projectId: null });
  }

  return (
    <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Projects &amp; workflow progress</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Dooro filter hoose, kadib guji <strong>Open</strong> si aad u gasho module-ka saxda ah.
      </div>

      {focusProjectId ? (
        <div className="workflowItemActions" style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Filtered to one project</span>
          <button type="button" className="btn sm" onClick={() => patchLifecycleParams({ projectId: null })}>
            Show all projects
          </button>
        </div>
      ) : null}

      {error ? <div style={{ color: "#f87171", marginTop: 12 }}>{error}</div> : null}

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
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 8 }}
            disabled={!selectedResearcherId || loading}
            onClick={() => reload()}
          >
            {loading ? "Loading…" : "View workflow"}
          </button>
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading projects…</div> : null}

      {!loading && data?.mode === "journey" ? (
        <>
          <div className="pageHeaderStats" style={{ marginTop: 12 }}>
            {summaryStats.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`pageHeaderStat pageHeaderStatBtn${lcFilter === s.key ? " pageHeaderStatActive" : ""}`}
                onClick={() => patchLifecycleParams({ lc: s.key === lcFilter && s.key !== "all" ? null : s.key })}
              >
                <div className="pageHeaderStatLabel">{s.label}</div>
                <div className="pageHeaderStatValue">{s.value}</div>
              </button>
            ))}
          </div>

          <StatusLegend
            activeStepFilter={stepFilter}
            onStepFilterChange={(key) => patchLifecycleParams({ lcStep: key || null })}
          />

          {lcFilter !== "all" || stepFilter || focusProjectId ? (
            <div className="workflowItemActions" style={{ marginTop: 12 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Active filters:{" "}
                {lcFilter !== "all" ? (
                  <strong>{LC_FILTER_LABELS[lcFilter] || lcFilter}</strong>
                ) : null}
                {stepFilter ? (
                  <>
                    {lcFilter !== "all" ? " · " : null}
                    <strong>{STATUS_STYLE[stepFilter]?.label || stepFilter}</strong>
                  </>
                ) : null}
                {focusProjectId ? <> · <strong>One project</strong></> : null}
              </span>
              <button type="button" className="btn sm" onClick={clearAllFilters}>
                Clear filters
              </button>
            </div>
          ) : null}

          {isStaff && data.researcher ? (
            <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Showing workflow for <strong>{data.researcher.fullName}</strong> ({data.researcher.department || "—"})
            </div>
          ) : null}

          {showProjects && filteredProjects.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 800, marginTop: 8 }}>
                Projects — workflow status ({filteredProjects.length})
              </div>
              {filteredProjects.map((item) => (
                <PipelineCard
                  key={item.projectId}
                  item={item}
                  kind="project"
                  stepFilter={stepFilter}
                  highlighted={focusProjectId && String(item.projectId) === String(focusProjectId)}
                />
              ))}
            </div>
          ) : null}

          {focusProjectId && !loading && filteredProjects.length === 0 && showProjects ? (
            <div className="workflowItemActions" style={{ marginTop: 12 }}>
              <span className="muted">That project was not found or does not match the filter.</span>
              <button type="button" className="btn sm" onClick={clearAllFilters}>
                Show all projects
              </button>
            </div>
          ) : null}

          {showPending && filteredPending.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 800, marginTop: 8 }}>Proposals not yet a project ({filteredPending.length})</div>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                These are still in the proposal / ethics / review stage.
              </p>
              {filteredPending.map((item) => (
                <PipelineCard key={item.proposalId} item={item} kind="proposal" stepFilter={stepFilter} />
              ))}
            </div>
          ) : null}

          {!hasContent ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted">
                {allProjects.length + allPending.length === 0
                  ? "No projects or proposals yet."
                  : "Nothing matches the current filters."}
              </div>
              {allProjects.length + allPending.length === 0 ? (
                <Link className="btn primary" to="/proposals/new" style={{ marginTop: 10, display: "inline-block" }}>
                  New voluntary proposal
                </Link>
              ) : (
                <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={clearAllFilters}>
                  Clear filters
                </button>
              )}
            </div>
          ) : null}

          {timeline.length ? (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(56,189,248,0.18)" }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Recent activity</div>
              <div style={{ display: "grid", gap: 8 }}>
                {timeline.map((ev, idx) => (
                  <div key={`${ev.at}-${idx}`} className="workflowItemRow">
                    <div>
                      <div style={{ fontWeight: 700 }}>{ev.label}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{new Date(ev.at).toLocaleString()}</div>
                    </div>
                    {ev.link ? (
                      <Link className="btn sm" to={ev.link}>
                        View
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isStaff ? (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                setSelectedResearcherId("");
                setData(null);
                reload();
              }}
            >
              ← Choose another researcher
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
