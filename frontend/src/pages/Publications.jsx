import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as publicationApi from "../services/publicationApi";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import {
  OUTPUT_TRACKING_CATEGORIES,
  PUBLICATION_TYPE_OPTIONS,
  FORM_TYPE_GROUPS,
  countByTrackingCategory,
  matchesTrackingFilter,
  publicationTypeLabel,
} from "../constants/publicationTypes";
import { workflowStageMeta } from "../constants/facultyWorkflow";

const EMPTY_FORM = {
  title: "",
  type: "paper",
  year: new Date().getFullYear(),
  venue: "",
  doi: "",
  orcid: "",
  authors: "",
  communityImpact: "",
  projectId: "",
};

function authorsFromProject(project, user) {
  const names = [];
  const pi =
    project?.principalInvestigator?.fullName ||
    project?.principalInvestigatorName ||
    user?.fullName ||
    "";
  if (pi) names.push(pi);
  for (const m of project?.teamMembers || []) {
    const n = (m.name || m.fullName || "").trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  return names.join(", ");
}

export function PublicationsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const [publications, setPublications] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(Boolean(projectIdFromUrl));
  const [form, setForm] = useState({ ...EMPTY_FORM, projectId: projectIdFromUrl });
  const [linkedProject, setLinkedProject] = useState(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const canValidate = ["faculty_coordinator", "research_director"].includes(user?.role);
  const projectLocked = Boolean(projectIdFromUrl);
  const isResearcher = user?.role === "researcher";

  const projectIdsWithOutput = useMemo(
    () => new Set(publications.map((p) => (p.projectId ? String(p.projectId) : "")).filter(Boolean)),
    [publications]
  );

  const projectsForNewOutput = useMemo(
    () => projects.filter((p) => !projectIdsWithOutput.has(String(p.id))),
    [projects, projectIdsWithOutput]
  );

  const projectAlreadyHasOutput = Boolean(
    projectIdFromUrl && projectIdsWithOutput.has(String(projectIdFromUrl))
  );

  const canAddNewOutput = canCreate && projectsForNewOutput.length > 0 && !projectAlreadyHasOutput;

  function canDeletePublication(p) {
    if (user?.role === "research_director") return true;
    if (canCreate && (p.status === "draft" || p.status === "rejected")) return true;
    return false;
  }

  async function handleDeletePublication(p) {
    const ok = window.confirm(`Delete output "${p.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setError("");
      await publicationApi.deletePublication(accessToken, p.id);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete output");
    }
  }

  useEffect(() => {
    if (projectIdFromUrl) {
      setForm((f) => ({ ...f, projectId: projectIdFromUrl }));
      setShowForm(true);
    }
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (projectAlreadyHasOutput) setShowForm(false);
  }, [projectAlreadyHasOutput]);

  const load = useCallback(async () => {
    const params = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
    const res = await publicationApi.listPublications(accessToken, params);
    let list = res.publications || [];
    // Researcher: never show another person's outputs (client belt-and-suspenders)
    if (user?.role === "researcher" && user?.id) {
      const uid = String(user.id);
      list = list.filter((p) => {
        const rid = p.researcherId;
        if (rid == null) return true;
        const owner = typeof rid === "object" ? String(rid._id || rid.id || "") : String(rid);
        return !owner || owner === uid;
      });
    }
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "owner-only-pubs",
        hypothesisId: "H3",
        location: "Publications.jsx:load",
        message: "Publications menu — data from Projects only",
        data: {
          role: user?.role || null,
          userId: user?.id ? String(user.id) : null,
          count: list.length,
          projectFilter: projectIdFromUrl || null,
          withProjectId: list.filter((p) => p.projectId).length,
          orphansExcluded: list.filter((p) => !p.projectId).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setPublications(list);
  }, [accessToken, projectIdFromUrl, user?.role, user?.id]);

  useEffect(() => {
    if (!accessToken) return;
    // Publication Tracking UI is structured from Projects
    projectApi
      .listProjects(accessToken)
      .then((res) => {
        const list = res.projects || [];
        setProjects(list);
        if (canCreate && list.length === 1 && !projectIdFromUrl) {
          const only = list[0];
          publicationApi
            .listPublications(accessToken)
            .then((res) => {
              const has = (res.publications || []).some((p) => String(p.projectId) === String(only.id));
              if (!has) setForm((f) => (f.projectId ? f : { ...f, projectId: only.id }));
            })
            .catch(() => {});
        }
      })
      .catch(() => setProjects([]));
  }, [accessToken, canCreate, projectIdFromUrl]);

  // When project is selected, auto-fill title + authors from that project
  useEffect(() => {
    if (!form.projectId || !accessToken || !canCreate) {
      setLinkedProject(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await projectApi.getProject(accessToken, form.projectId);
        if (cancelled) return;
        const p = res.project;
        setLinkedProject(p);
        setForm((f) => {
          const next = { ...f };
          const projectTitle = String(p.title || "").trim();
          const looksLikeFunding =
            /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(projectTitle);
          // Autofill research title only — never invent from funding-call / grant names
          if (!f.title.trim() && projectTitle && !looksLikeFunding) {
            next.title = projectTitle;
          }
          if (!f.authors.trim()) {
            next.authors = authorsFromProject(p, user);
          }
          return next;
        });
        setAutoFilled(true);
} catch {
        if (!cancelled) setLinkedProject(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.projectId, accessToken, canCreate, user]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const trackingStats = useMemo(
    () =>
      OUTPUT_TRACKING_CATEGORIES.map((cat) => ({
        ...cat,
        count: countByTrackingCategory(publications, cat),
      })),
    [publications]
  );

  const filtered = useMemo(() => {
    let list = filterByStatKey(publications, statusFilter);
    return list.filter((p) => matchesTrackingFilter(p, typeFilter));
  }, [publications, statusFilter, typeFilter]);

  /** Publication Tracking reads from Projects — group outputs under each project (no silo list). */
  const groupedByProject = useMemo(() => {
    const map = new Map();
    const titleFor = (projectId, fallback) => {
      const fromList = projects.find((x) => String(x.id) === String(projectId));
      return fromList?.title || fallback || "Project";
    };

    for (const p of filtered) {
      if (!p.projectId) continue; // never show orphan / non-project data
      const key = String(p.projectId);
      if (map.has(key)) continue; // 1:1 — one output per project
      map.set(key, {
        projectId: key,
        title: titleFor(key, p.projectTitle),
        status: projects.find((x) => String(x.id) === key)?.status || null,
        items: [p],
      });
    }

    // Researcher: also show My Projects that have no outputs yet (source = Projects)
    if (user?.role === "researcher" && !projectIdFromUrl) {
      for (const proj of projects) {
        const key = String(proj.id);
        if (!map.has(key)) {
          map.set(key, {
            projectId: key,
            title: proj.title,
            status: proj.status,
            items: [],
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [filtered, projects, user?.role, projectIdFromUrl]);

  const stats = useMemo(() => {
    const by = (s) => publications.filter((p) => p.status === s).length;
    const totalCitations = publications.reduce((acc, p) => acc + Number(p.citationCount || 0), 0);
    return [
      { label: "Total outputs", value: publications.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      { label: "Validated", value: by("validated"), filterKey: "validated", accent: "#1d4ed8" },
      { label: "Citations", value: totalCitations.toLocaleString(), accent: "#7dd3fc" },
    ];
  }, [publications]);

  const isCommunityType = form.type === "community_research_impact";

  function resetForm() {
    const fallback =
      projectsForNewOutput.length === 1
        ? projectsForNewOutput[0].id
        : projectsForNewOutput.some((p) => String(p.id) === String(projectIdFromUrl))
          ? projectIdFromUrl
          : "";
    setForm({ ...EMPTY_FORM, projectId: fallback });
    setAutoFilled(false);
  }

  async function saveOutput({ submitNow }) {
    setBusy(true);
    setError("");
    try {
      if (isCommunityType && !form.communityImpact.trim()) {
        setError("Community research impact description is required for this output type.");
        return;
      }
      if (!form.projectId) {
        setError("Select the research project this output belongs to.");
        return;
      }
      const authors = form.authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        authors,
        submit: submitNow,
      };
      const created = await publicationApi.createPublication(accessToken, payload);
      resetForm();
      if (!projectLocked) setShowForm(false);
      await reload();
      const linkedId = projectIdFromUrl || form.projectId || created?.publication?.projectId;
      // Return to project so Research workflow / awards / activity refresh
      if (submitNow && linkedId) {
        navigate(`/projects/${linkedId}#project-outputs`, {
          replace: true,
          state: { workflowHint: "publication_submitted" },
        });
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save publication");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Publications & Outputs"
        subtitle={
          isResearcher
            ? "Hal project = hal output (1:1). Xogta waxay ka timaadaa My Projects kaliya."
            : "Staff view: one output per project (1:1), linked via projectId."
        }
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          canAddNewOutput ? (
            <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close form" : "+ New output"}
            </button>
          ) : canCreate && projectAlreadyHasOutput ? (
            <span className="muted" style={{ fontSize: 13 }}>
              This project already has its output (1:1).
            </span>
          ) : null
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing status: <strong>{statFilterLabel(stats, statusFilter)}</strong>
          {typeFilter !== "all" ? ` • type: ${OUTPUT_TRACKING_CATEGORIES.find((c) => c.id === typeFilter)?.label}` : ""}
        </p>
      ) : null}

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Filtered to one project.{" "}
          <Link to={`/projects/${projectIdFromUrl}#project-outputs`}>Open project</Link>
          {" · "}
          <Link to="/publications">all from My Projects</Link>
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Xogta waxay ka akhrisaa <Link to="/projects">Projects</Link> — grouped by project; xog gooni ah lama hayo.
        </p>
      )}

      {loading ? <p className="muted">Loading publications…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="overviewGrid pubCategoryGrid" style={{ marginTop: 12 }}>
        {trackingStats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="overviewTile"
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderColor: typeFilter === cat.id ? "rgba(56,189,248,0.55)" : undefined,
              background: typeFilter === cat.id ? "rgba(14,165,233,0.08)" : undefined,
            }}
            onClick={() => setTypeFilter((f) => (f === cat.id ? "all" : cat.id))}
          >
            <div className="label">
              {cat.icon} {cat.label}
            </div>
            <div className="value">{cat.count}</div>
          </button>
        ))}
      </div>

      {typeFilter !== "all" ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Filter: {OUTPUT_TRACKING_CATEGORIES.find((c) => c.id === typeFilter)?.label}
          </span>
          <button type="button" className="btn" onClick={() => setTypeFilter("all")}>
            Show all
          </button>
        </div>
      ) : null}

      {canCreate && showForm && canAddNewOutput ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Register research output</div>
          {autoFilled && linkedProject ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Auto-filled from project <strong>{linkedProject.title}</strong> (title, authors). You can edit before
              submit.
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Research project (required — from Projects)</label>
              <select
                value={form.projectId}
                onChange={(e) => {
                  const id = e.target.value;
                  setForm((f) => ({
                    ...f,
                    projectId: id,
                    // Clear so new project can re-fill
                    title: "",
                    authors: "",
                  }));
                  setAutoFilled(false);
                }}
                required
                disabled={projectLocked}
              >
                <option value="">Select from My Projects…</option>
                {projectsForNewOutput.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.status ? ` (${p.status})` : ""}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Hal project = hal output keliya. Projects leh output horay lama dooran karo.
              </p>
            </div>
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Authors (auto from project team — comma separated)</label>
              <input
                value={form.authors}
                onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))}
                placeholder="PI and team members"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Output type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {FORM_TYPE_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {PUBLICATION_TYPE_OPTIONS.filter((o) => o.group === g.key).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Year</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="field">
              <label>Journal / conference / publisher / patent office</label>
              <input
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. BMC Public Health, IEEE ICRERA, Springer"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>DOI</label>
                <input value={form.doi} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))} />
              </div>
              <div className="field">
                <label>ORCID</label>
                <input value={form.orcid} onChange={(e) => setForm((f) => ({ ...f, orcid: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>
                {isCommunityType ? "Describe community / societal impact (required)" : "Community / research impact (optional)"}
              </label>
              <textarea
                rows={3}
                value={form.communityImpact}
                onChange={(e) => setForm((f) => ({ ...f, communityImpact: e.target.value }))}
                placeholder={
                  isCommunityType
                    ? "e.g. policy brief adopted by ministry, 500 farmers trained, clinic pilot in 3 districts"
                    : "Optional: local adoption, policy change, beneficiaries, outreach"
                }
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={busy} onClick={() => saveOutput({ submitNow: false })}>
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={() => saveOutput({ submitNow: true })}>
                {busy ? "Submitting…" : "Create & submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>
          From Projects — outputs {typeFilter !== "all" ? `(${filtered.length})` : `(${publications.length})`}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Menu: Publications & Outputs · Data source: Projects only (no separate silo).
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {groupedByProject.map((group) => (
            <div
              key={group.projectId}
              className="card"
              style={{ padding: 12, borderColor: "rgba(56,189,248,0.3)", background: "rgba(14,165,233,0.04)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <Link
                    to={`/projects/${group.projectId}`}
                    style={{ fontWeight: 800, fontSize: 15, color: "inherit", textDecoration: "none" }}
                  >
                    {group.title}
                  </Link>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    Project{group.status ? ` · ${group.status}` : ""} · {group.items.length} output
                    {group.items.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link className="btn" to={`/projects/${group.projectId}#project-outputs`}>
                    Open project
                  </Link>
                  {canCreate ? (
                    <Link className="btn primary" to={`/publications?projectId=${group.projectId}`}>
                      + Output
                    </Link>
                  ) : null}
                </div>
              </div>

              {group.items.length === 0 ? (
                <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>No outputs registered on this project yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {group.items.map((p) => (
            <div key={p.id} className="card" style={{ background: "rgba(15,23,42,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted">
                    {publicationTypeLabel(p.type)} • {p.year} • {p.status}
                    {p.venue ? ` • ${p.venue}` : ""}
                  </div>
                  {Array.isArray(p.authors) && p.authors.length ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      Authors: {p.authors.join(", ")}
                    </div>
                  ) : null}
                  {p.workflowStage ? (
                    <div style={{ fontSize: 12, marginTop: 4, color: workflowStageMeta(p.workflowStage).accent }}>
                      {workflowStageMeta(p.workflowStage).icon}{" "}
                      Faculty workflow: <strong>{p.workflowStageLabel || p.workflowStage}</strong>
                    </div>
                  ) : null}
                  {p.doi ? <div className="muted">DOI: {p.doi}</div> : null}
                  {p.orcid ? <div className="muted">ORCID: {p.orcid}</div> : null}
                  {typeof p.citationCount === "number" ? (
                    <div className="muted">
                      Citations: <strong>{p.citationCount}</strong>
                    </div>
                  ) : null}
                  {p.communityImpact ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      Community impact: {p.communityImpact}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.doi ? (
                    <button
                      type="button"
                      className="btn"
                      title="Look up citations via CrossRef"
                      onClick={async () => {
                        try {
                          setError("");
                          const res = await publicationApi.refreshCitations(accessToken, p.id);
                          if (res.source !== "crossref") {
                            setError(res.message);
                          }
                          await reload();
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to refresh citations");
                        }
                      }}
                    >
                      Refresh citations
                    </button>
                  ) : null}
                  {canCreate && (p.status === "draft" || p.status === "rejected") ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={async () => {
                        try {
                          setError("");
                          await publicationApi.submitPublication(accessToken, p.id);
                          await reload();
                          if (p.projectId) {
                        navigate(`/projects/${p.projectId}#project-outputs`, {
                              replace: true,
                              state: { workflowHint: "publication_submitted" },
                            });
                          }
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to submit");
                        }
                      }}
                    >
                      {p.status === "rejected" ? "Resubmit" : "Submit"}
                    </button>
                  ) : null}
                  {canValidate && p.status === "submitted" ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={async () => {
                          const comment = prompt("Validation comment (required):");
                          if (!comment) return;
                          try {
                            setError("");
                            await publicationApi.validatePublication(accessToken, p.id, {
                              decision: "validated",
                              comment,
                            });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to validate");
                          }
                        }}
                      >
                        Validate
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          const comment = prompt("Rejection reason (required):");
                          if (!comment) return;
                          try {
                            setError("");
                            await publicationApi.validatePublication(accessToken, p.id, {
                              decision: "rejected",
                              comment,
                            });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to reject");
                          }
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {canDeletePublication(p) ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171" }}
                      onClick={() => handleDeletePublication(p)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {groupedByProject.length === 0 ? (
            <div className="muted">
              No project-linked outputs. Open <Link to="/projects">Projects</Link> first, then register an output.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
