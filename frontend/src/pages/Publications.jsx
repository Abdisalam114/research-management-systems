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

  useEffect(() => {
    if (projectIdFromUrl) {
      setForm((f) => ({ ...f, projectId: projectIdFromUrl }));
      setShowForm(true);
    }
  }, [projectIdFromUrl]);

  const load = useCallback(async () => {
    const params = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
    const res = await publicationApi.listPublications(accessToken, params);
    setPublications(res.publications || []);
  }, [accessToken, projectIdFromUrl]);

  useEffect(() => {
    if (!canCreate || !accessToken) return;
    projectApi.listProjects(accessToken).then((res) => {
      const list = res.projects || [];
      setProjects(list);
      if (list.length === 1 && !projectIdFromUrl) {
        setForm((f) => (f.projectId ? f : { ...f, projectId: list[0].id }));
      }
    }).catch(() => setProjects([]));
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
          if (!f.title.trim() || f.projectId !== form.projectId) {
            // Prefer project title when empty or when switching project with empty title
            if (!f.title.trim()) next.title = p.title || "";
          }
          if (!f.authors.trim()) {
            next.authors = authorsFromProject(p, user);
          }
          return next;
        });
        setAutoFilled(true);
        // #region agent log
        fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
          body: JSON.stringify({
            sessionId: "f558f7",
            hypothesisId: "M",
            location: "Publications.jsx:autoFill",
            message: "publication form auto-filled from project",
            data: {
              projectId: form.projectId,
              hasTitle: Boolean(p?.title),
              authorPreview: authorsFromProject(p, user).slice(0, 80),
            },
            timestamp: Date.now(),
            runId: "pre-fix",
          }),
        }).catch(() => {});
        // #endregion
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
    setForm({
      ...EMPTY_FORM,
      projectId: projects.length === 1 ? projects[0].id : projectIdFromUrl || "",
    });
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
        navigate(`/projects/${linkedId}`, {
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
        title="Publication & Output Tracking"
        subtitle="Papers • Conference • Review • Case studies • Letter to editor — plus journal articles, books, patents, thesis, and community impact."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          canCreate ? (
            <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close form" : "+ New output"}
            </button>
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
          Linked to project — title & authors auto-fill from the project.{" "}
          <Link to="/publications">show all outputs</Link>
        </p>
      ) : null}

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

      {canCreate && showForm ? (
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
              <label>Research project (required)</label>
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
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
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
          Outputs {typeFilter !== "all" ? `(${filtered.length})` : `(${publications.length})`}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted">
                    {publicationTypeLabel(p.type)} • {p.year} • {p.status}
                    {p.venue ? ` • ${p.venue}` : ""}
                    {p.projectTitle ? ` • Project: ${p.projectTitle}` : p.projectId ? ` • Project linked` : ""}
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
                      🌍 Community impact: {p.communityImpact}
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
                  {canCreate && p.status === "draft" ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={async () => {
                        try {
                          setError("");
                          await publicationApi.submitPublication(accessToken, p.id);
                          await reload();
                          if (p.projectId) {
                            navigate(`/projects/${p.projectId}`, {
                              replace: true,
                              state: { workflowHint: "publication_submitted" },
                            });
                          }
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to submit");
                        }
                      }}
                    >
                      Submit
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
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 ? (
            <div className="muted">
              {publications.length === 0
                ? "No outputs yet. Use + New output (or Project → Research output) — project fields auto-fill."
                : "No outputs in this category."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
