import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
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
  const { programTier, programTierLabel } = useProgramTier();
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
  const [successMsg, setSuccessMsg] = useState("");
  const [decisionModal, setDecisionModal] = useState(null); // { publication, decision, comment, project, loading }
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [viewPub, setViewPub] = useState(null);

  function publicationExternalUrl(p) {
    if (p?.url && /^https?:\/\//i.test(String(p.url))) return p.url;
    if (p?.doi) {
      const doi = String(p.doi).replace(/^https?:\/\/doi.org\//i, "").trim();
      return doi ? `https://doi.org/${doi}` : null;
    }
    return null;
  }

  function downloadPublicationSummary(p) {
    const external = publicationExternalUrl(p);
    const lines = [
      `Title: ${p.title || "—"}`,
      `Type: ${publicationTypeLabel(p.type)}`,
      `Year: ${p.year ?? "—"}`,
      `Venue: ${p.venue || "—"}`,
      `Status: ${p.statusLabel || p.status || "—"}`,
      `Workflow: ${p.workflowStageLabel || p.workflowStage || "—"}`,
      `Authors: ${Array.isArray(p.authors) ? p.authors.join(", ") : "—"}`,
      `DOI: ${p.doi || "—"}`,
      `ORCID: ${p.orcid || "—"}`,
      `URL: ${external || "—"}`,
      p.communityImpact ? `Community impact: ${p.communityImpact}` : "",
      p.validationComment ? `Latest review: ${p.validationComment}` : "",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.title || "publication").slice(0, 60).replace(/[^\w\-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
    if (
      canCreate &&
      (p.status === "draft" || p.status === "rejected" || p.status === "revision_requested")
    ) {
      return true;
    }
    return false;
  }

  function canResubmit(p) {
    return canCreate && (p.status === "draft" || p.status === "rejected" || p.status === "revision_requested");
  }

  function canDecide(p) {
    return canValidate && (p.status === "submitted" || p.status === "revision_requested");
  }

  async function decidePublication(p, decision) {
    setError("");
    setSuccessMsg("");
    setDecisionModal({
      publication: p,
      decision,
      comment: "",
      project: null,
      loading: Boolean(p.projectId),
    });
    if (!p.projectId) return;
    try {
      const res = await projectApi.getProject(accessToken, p.projectId);
      setDecisionModal((m) => (m ? { ...m, project: res.project || null, loading: false } : m));
    } catch {
      setDecisionModal((m) => (m ? { ...m, loading: false } : m));
    }
  }

  async function confirmPublicationDecision() {
    if (!decisionModal?.publication || !decisionModal?.decision) return;
    const comment = String(decisionModal.comment || "").trim();
    if (!comment) {
      setError("Reviewer comment is required before Accept / Revise / Reject");
      return;
    }
    setDecisionBusy(true);
    try {
      setError("");
      setSuccessMsg("");
      const res = await publicationApi.validatePublication(accessToken, decisionModal.publication.id, {
        decision: decisionModal.decision,
        comment,
      });
setSuccessMsg(res.message || `Decision: ${decisionModal.decision}`);
      if (decisionModal.decision === "accept") setStatusFilter("validated");
      else if (decisionModal.decision === "revise") setStatusFilter("revision_requested");
      else setStatusFilter("rejected");
      setDecisionModal(null);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save decision");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function addComment(p) {
    const comment = prompt("Add review comment:");
    if (!comment) return;
    try {
      setError("");
      await publicationApi.addPublicationComment(accessToken, p.id, comment);
      setSuccessMsg("Comment added");
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to add comment");
    }
  }

  async function recordJournalDecision(p) {
    const decision = prompt(
      "Journal / venue decision (international):\nType: accept | reject | revise | pending",
      p.journalDecision || "pending"
    );
    if (!decision) return;
    const note =
      decision.trim().toLowerCase() === "pending"
        ? ""
        : prompt("Note / reviewer feedback for this journal decision (required):");
    if (decision.trim().toLowerCase() !== "pending" && !note) return;
    try {
      setError("");
      const res = await publicationApi.setJournalDecision(accessToken, p.id, {
        decision: decision.trim().toLowerCase(),
        note: note || "",
      });
      setSuccessMsg(res.message || "Journal decision saved");
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save journal decision");
    }
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
setPublications(list);
  }, [accessToken, projectIdFromUrl, user?.role, user?.id, programTier]);

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
  }, [accessToken, canCreate, projectIdFromUrl, programTier]);

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
  }, [form.projectId, accessToken, canCreate, user, programTier]);

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
    let list = filterByStatKey(publications, statusFilter, {
      customFilters: {
        published: (p) => p.workflowStage === "published",
      },
    });
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

    // Researcher: show My Projects without outputs only on "all" / draft — never under Submitted/Validated
    // (otherwise published outputs disappear and empty cards look like they still need Submit)
    if (user?.role === "researcher" && !projectIdFromUrl && (statusFilter === "all" || statusFilter === "draft")) {
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
  }, [filtered, projects, user?.role, projectIdFromUrl, statusFilter]);

  const stats = useMemo(() => {
    const by = (s) => publications.filter((p) => p.status === s).length;
    const publishedCount = publications.filter((p) => p.workflowStage === "published").length;
    const totalCitations = publications.reduce((acc, p) => acc + Number(p.citationCount || 0), 0);
    return [
      { label: "Total outputs", value: publications.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Under review", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      {
        label: "Revise",
        value: by("revision_requested"),
        filterKey: "revision_requested",
        accent: "#f59e0b",
      },
      { label: "Accepted", value: by("validated"), filterKey: "validated", accent: "#16a34a" },
      { label: "Rejected", value: by("rejected"), filterKey: "rejected", accent: "#ef4444" },
      {
        label: "Published",
        value: publishedCount,
        filterKey: "published",
        accent: "#22c55e",
      },
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
      setStatusFilter("all");
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
            ? "Hal project = hal output (1:1). Review cycle: submit → accept / revise / reject (heer caalami) + comments."
            : "Staff review: Accept, Revise & resubmit, or Reject — with reviewer comments (international style)."
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
      {successMsg ? (
        <div className="card" style={{ borderColor: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.08)" }}>
          {successMsg}
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
                  {canCreate && group.items.length === 0 ? (
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
                    {publicationTypeLabel(p.type)} • {p.year} •{" "}
                    <strong>{p.statusLabel || p.status}</strong>
                    {p.venue ? ` • ${p.venue}` : ""}
                  </div>
                  {p.journalDecision && p.journalDecision !== "pending" ? (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#fbbf24" }}>
                      Journal decision: <strong>{p.journalDecisionLabel || p.journalDecision}</strong>
                      {p.journalDecisionNote ? ` — ${p.journalDecisionNote}` : ""}
                    </div>
                  ) : null}
                  {p.validationComment ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Latest review note: {p.validationComment}
                    </div>
                  ) : null}
                  {Array.isArray(p.reviewerComments) && p.reviewerComments.length ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 8,
                        background: "rgba(14,165,233,0.08)",
                        border: "1px solid rgba(56,189,248,0.25)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                        Reviewer comments ({p.reviewerComments.length})
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {p.reviewerComments.slice(-5).map((c) => (
                          <li key={c.id} style={{ marginBottom: 4 }}>
                            <strong>{c.authorName || c.authorRole || "Reviewer"}</strong>
                            {c.decisionLabel ? ` [${c.decisionLabel}]` : ""}: {c.comment}
                            {c.at ? (
                              <span className="muted"> · {new Date(c.at).toLocaleString()}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                  {publicationExternalUrl(p) ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Link:{" "}
                      <a href={publicationExternalUrl(p)} target="_blank" rel="noopener noreferrer">
                        {publicationExternalUrl(p)}
                      </a>
                    </div>
                  ) : null}
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
                  {p.status !== "draft" ? (
                    <>
                      <button type="button" className="btn" onClick={() => setViewPub(p)}>
                        View details
                      </button>
                      <button type="button" className="btn" onClick={() => downloadPublicationSummary(p)}>
                        Download summary
                      </button>
                      {publicationExternalUrl(p) ? (
                        <a
                          className="btn"
                          href={publicationExternalUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open published link
                        </a>
                      ) : null}
                    </>
                  ) : null}
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
                  {canResubmit(p) ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={async () => {
                        try {
                          setError("");
                          await publicationApi.submitPublication(accessToken, p.id);
                          setStatusFilter("submitted");
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
                      {p.status === "revision_requested"
                        ? "Resubmit after revision"
                        : p.status === "rejected"
                          ? "Resubmit"
                          : "Submit for review"}
                    </button>
                  ) : null}
                  {canDecide(p) ? (
                    <>
                      <button type="button" className="btn primary" onClick={() => decidePublication(p, "accept")}>
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ borderColor: "rgba(245,158,11,0.6)", color: "#fbbf24" }}
                        onClick={() => decidePublication(p, "revise")}
                      >
                        Revise
                      </button>
                      <button type="button" className="btn" onClick={() => decidePublication(p, "reject")}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  {p.status !== "draft" ? (
                    <button type="button" className="btn" onClick={() => addComment(p)}>
                      Add comment
                    </button>
                  ) : null}
                  {(canCreate || canValidate) && p.status !== "draft" ? (
                    <button type="button" className="btn" onClick={() => recordJournalDecision(p)}>
                      Journal decision
                    </button>
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

      {decisionModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(2, 6, 23, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => (!decisionBusy ? setDecisionModal(null) : null)}
        >
          <div
            className="card"
            style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 18, textTransform: "capitalize" }}>
              {decisionModal.decision === "accept"
                ? "Accept / Publish output"
                : decisionModal.decision === "revise"
                  ? "Revise & resubmit"
                  : "Reject output"}
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Review all project details and add a required comment before confirming.
            </p>

            <div className="card" style={{ marginTop: 12, background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Output</div>
              <div><strong>Title:</strong> {decisionModal.publication.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Type: {publicationTypeLabel(decisionModal.publication.type)} · Status:{" "}
                {decisionModal.publication.status}
                {decisionModal.publication.venue ? ` · Venue: ${decisionModal.publication.venue}` : ""}
                {decisionModal.publication.year ? ` · Year: ${decisionModal.publication.year}` : ""}
              </div>
              {decisionModal.publication.authors?.length ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Authors: {Array.isArray(decisionModal.publication.authors)
                    ? decisionModal.publication.authors.join(", ")
                    : decisionModal.publication.authors}
                </div>
              ) : null}
            </div>

            <div className="card" style={{ marginTop: 12, background: "rgba(15,23,42,0.45)" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Linked project (all details)</div>
              {decisionModal.loading ? (
                <div className="muted">Loading project…</div>
              ) : decisionModal.project ? (
                <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                  <div><strong>Title:</strong> {decisionModal.project.title}</div>
                  <div><strong>Status:</strong> {decisionModal.project.status}</div>
                  {decisionModal.project.programTierLabel || decisionModal.project.programTier ? (
                    <div>
                      <strong>Portal:</strong>{" "}
                      {decisionModal.project.programTierLabel || decisionModal.project.programTier}
                    </div>
                  ) : null}
                  {decisionModal.project.principalInvestigatorName ||
                  decisionModal.project.principalInvestigator?.fullName ? (
                    <div>
                      <strong>PI:</strong>{" "}
                      {decisionModal.project.principalInvestigatorName ||
                        decisionModal.project.principalInvestigator?.fullName}
                    </div>
                  ) : null}
                  {decisionModal.project.department ? (
                    <div><strong>Department:</strong> {decisionModal.project.department}</div>
                  ) : null}
                  {decisionModal.project.researchArea ? (
                    <div><strong>Research area:</strong> {decisionModal.project.researchArea}</div>
                  ) : null}
                  {decisionModal.project.startDate || decisionModal.project.endDate ? (
                    <div>
                      <strong>Dates:</strong>{" "}
                      {decisionModal.project.startDate
                        ? new Date(decisionModal.project.startDate).toLocaleDateString()
                        : "—"}{" "}
                      →{" "}
                      {decisionModal.project.endDate
                        ? new Date(decisionModal.project.endDate).toLocaleDateString()
                        : "—"}
                    </div>
                  ) : null}
                  {(decisionModal.project.teamMembers || []).length ? (
                    <div>
                      <strong>Team:</strong>{" "}
                      {decisionModal.project.teamMembers
                        .map((m) => m.name || m.fullName || m.email)
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ) : null}
                  {decisionModal.project.abstract || decisionModal.project.description ? (
                    <div>
                      <strong>Summary:</strong>{" "}
                      {decisionModal.project.abstract || decisionModal.project.description}
                    </div>
                  ) : null}
                  <Link className="btn" style={{ marginTop: 6, width: "fit-content" }} to={`/projects/${decisionModal.project.id}`}>
                    Open full project
                  </Link>
                </div>
              ) : (
                <div className="muted">
                  {decisionModal.publication.projectTitle
                    ? `Project: ${decisionModal.publication.projectTitle}`
                    : "No linked project details available."}
                </div>
              )}
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>
                Reviewer comment / decision note <span style={{ color: "#f87171" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={decisionModal.comment}
                onChange={(e) => setDecisionModal((m) => (m ? { ...m, comment: e.target.value } : m))}
                placeholder={
                  decisionModal.decision === "accept"
                    ? "Acceptance note (required before publish)…"
                    : decisionModal.decision === "revise"
                      ? "Revision instructions for the researcher…"
                      : "Rejection reason…"
                }
                style={{ width: "100%" }}
              />
            </div>

            <div className="formActions" style={{ marginTop: 12 }}>
              <button type="button" className="btn" disabled={decisionBusy} onClick={() => setDecisionModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={decisionBusy || !String(decisionModal.comment || "").trim()}
                onClick={confirmPublicationDecision}
              >
                {decisionBusy
                  ? "Saving…"
                  : decisionModal.decision === "accept"
                    ? "Confirm Accept / Publish"
                    : decisionModal.decision === "revise"
                      ? "Confirm Revise"
                      : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewPub ? (
        <div
          className="modalBackdrop"
          role="presentation"
          onClick={() => setViewPub(null)}
          onKeyDown={(e) => e.key === "Escape" && setViewPub(null)}
        >
          <div
            className="card modalPanel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: "92vw" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{viewPub.title}</div>
              <button type="button" className="btn" onClick={() => setViewPub(null)}>
                Close
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12, fontSize: 14 }}>
              <div><strong>Type:</strong> {publicationTypeLabel(viewPub.type)}</div>
              <div><strong>Year:</strong> {viewPub.year ?? "—"}</div>
              <div><strong>Venue:</strong> {viewPub.venue || "—"}</div>
              <div><strong>Status:</strong> {viewPub.statusLabel || viewPub.status}</div>
              {viewPub.workflowStage ? (
                <div><strong>Workflow:</strong> {viewPub.workflowStageLabel || viewPub.workflowStage}</div>
              ) : null}
              {Array.isArray(viewPub.authors) && viewPub.authors.length ? (
                <div><strong>Authors:</strong> {viewPub.authors.join(", ")}</div>
              ) : null}
              {viewPub.doi ? <div><strong>DOI:</strong> {viewPub.doi}</div> : null}
              {viewPub.orcid ? <div><strong>ORCID:</strong> {viewPub.orcid}</div> : null}
              {publicationExternalUrl(viewPub) ? (
                <div>
                  <strong>Published link:</strong>{" "}
                  <a href={publicationExternalUrl(viewPub)} target="_blank" rel="noopener noreferrer">
                    {publicationExternalUrl(viewPub)}
                  </a>
                </div>
              ) : null}
              {viewPub.communityImpact ? (
                <div><strong>Community impact:</strong> {viewPub.communityImpact}</div>
              ) : null}
              {viewPub.validationComment ? (
                <div><strong>Latest review:</strong> {viewPub.validationComment}</div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" onClick={() => downloadPublicationSummary(viewPub)}>
                Download summary
              </button>
              {publicationExternalUrl(viewPub) ? (
                <a className="btn" href={publicationExternalUrl(viewPub)} target="_blank" rel="noopener noreferrer">
                  Open published link
                </a>
              ) : null}
              {viewPub.projectId ? (
                <Link className="btn" to={`/projects/${viewPub.projectId}#project-outputs`}>
                  Open project
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
