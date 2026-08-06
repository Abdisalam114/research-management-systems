import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useScrollToTop } from "../hooks/useScrollToTop";
import * as repositoryApi from "../services/repositoryApi";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";

import { filterByStatKey, statFilterLabel, totalStatTile, typeStatTile } from "../utils/pageHeaderFilters";

export function RepositoryPage() {
  const { accessToken, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const projectLocked = Boolean(projectIdFromUrl);
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [linkedProject, setLinkedProject] = useState(null);
  const [showForm, setShowForm] = useState(Boolean(projectIdFromUrl));
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", access: "private", groupId: "", projectId: projectIdFromUrl });
  const [file, setFile] = useState(null);
  const [exporting, setExporting] = useState("");
  const [openingFileId, setOpeningFileId] = useState("");

  useScrollToTop([showForm, projectIdFromUrl]);

  const canUpload = user?.role === "researcher";

  useEffect(() => {
    if (projectIdFromUrl) {
      setForm((f) => ({ ...f, projectId: projectIdFromUrl }));
      setShowForm(true);
    }
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!canUpload || !accessToken) return;
    projectApi.listProjects(accessToken).then((res) => {
      const list = res.projects || [];
      setProjects(list);
      if (list.length === 1 && !projectIdFromUrl) {
        setForm((f) => (f.projectId ? f : { ...f, projectId: list[0].id }));
      }
    }).catch(() => setProjects([]));
  }, [accessToken, canUpload, projectIdFromUrl]);

  // Auto-fill title from the opened project — no manual re-entry
  useEffect(() => {
    if (!form.projectId || !accessToken || !canUpload) {
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
          if (f.projectId !== form.projectId) return f;
          if (f.title.trim()) return f;
          const projectTitle = String(p.title || "").trim();
          const looksLikeFunding =
            /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(projectTitle);
          // Keep projectId locked; do not invent file titles from funding-call names
          if (!projectTitle || looksLikeFunding) return f;
          return { ...f, title: projectTitle };
        });
      } catch {
        if (!cancelled) setLinkedProject(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.projectId, accessToken, canUpload, projectLocked]);

  const load = useCallback(async () => {
    const params = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
    const res = await repositoryApi.listRepositoryItems(accessToken, params);
    setItems(res.items || []);
  }, [accessToken, projectIdFromUrl]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => items.filter((i) => i.type === s).length;
    return [
      totalStatTile("Total items", items.length),
      typeStatTile("Documents", by("document"), "document", "#0ea5e9"),
      typeStatTile("CSV / Excel", by("dataset"), "dataset", "#38bdf8"),
    ];
  }, [items]);

  const filteredItems = useMemo(() => filterByStatKey(items, statusFilter), [items, statusFilter]);

  const groupedByProject = useMemo(() => {
    const map = new Map();
    const titleFor = (projectId, fallback) => {
      const fromList = projects.find((x) => String(x.id) === String(projectId));
      return fromList?.title || fallback || "Project";
    };

    for (const item of filteredItems) {
      if (!item.projectId) continue;
      const key = String(item.projectId);
      if (!map.has(key)) {
        map.set(key, {
          projectId: key,
          title: titleFor(key, item.projectTitle),
          items: [],
        });
      }
      map.get(key).items.push(item);
    }

    if (canUpload && !projectIdFromUrl && statusFilter === "all") {
      for (const proj of projects) {
        const key = String(proj.id);
        if (!map.has(key)) {
          map.set(key, { projectId: key, title: proj.title, items: [] });
        }
      }
    }

    return [...map.values()].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [filteredItems, projects, canUpload, projectIdFromUrl, statusFilter]);

  function canDeleteItem(item) {
    if (user?.role === "research_director") return true;
    if (!canUpload || !user?.id) return false;
    const uid = String(user.id);
    const owner = item.uploadedBy;
    const ownerId =
      owner == null
        ? ""
        : typeof owner === "object"
          ? String(owner._id || owner.id || "")
          : String(owner);
    return ownerId === uid;
  }

  async function handleDeleteItem(item) {
    const ok = window.confirm(`Delete repository file "${item.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setError("");
      await repositoryApi.deleteRepositoryItem(accessToken, item.id);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Delete failed");
    }
  }

  async function handleExport(kind) {
    try {
      setExporting(kind);
      setError("");
      const params = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
      if (kind === "pdf") await repositoryApi.downloadRepositoryPdf(accessToken, params);
      else if (kind === "excel") await repositoryApi.downloadRepositoryExcel(accessToken, params);
      else await repositoryApi.downloadRepositoryCsv(accessToken, params);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Export failed");
    } finally {
      setExporting("");
    }
  }

  async function handleOpenFile(item) {
    try {
      setOpeningFileId(item.id);
      setError("");
      await repositoryApi.openRepositoryFile(accessToken, item.id, item.fileName || item.title || "repository-file");
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Could not open file");
    } finally {
      setOpeningFileId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Research Repository"
        subtitle={
          canUpload
            ? "Upload project files (PDF, Word, CSV, Excel, TXT, ZIP) from My Projects."
            : "Project-linked repository files — grouped by research project."
        }
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canUpload ? (
              <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close upload" : "+ Upload file"}
              </button>
            ) : null}
            <div className="btnGroup" role="group" aria-label="Export formats">
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport("pdf")}>
                {exporting === "pdf" ? "Exporting…" : "📄 PDF"}
              </button>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport("excel")}>
                {exporting === "excel" ? "Exporting…" : "📊 Excel"}
              </button>
              <button type="button" className="btn" disabled={!!exporting} onClick={() => handleExport("csv")}>
                {exporting === "csv" ? "Exporting…" : "📋 CSV"}
              </button>
            </div>
          </>
        }
      />

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Project locked: <strong>{linkedProject?.title || "selected project"}</strong> — title auto-filled.{" "}
          <Link to="/repository">show all items</Link>
        </p>
      ) : null}

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filteredItems.length})
        </p>
      ) : null}
      {loading ? <p className="muted">Loading repository…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canUpload && showForm ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Upload file</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Allowed: PDF, Word, CSV, Excel, TXT, or ZIP (max 10 MB).
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Research project (required)</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, title: "" }))}
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
              {projectLocked ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Taken from the project you opened — no need to choose again.
                </div>
              ) : null}
            </div>
            <div className="row">
              <div className="field">
                <label>Access</label>
                <select value={form.access} onChange={(e) => setForm((f) => ({ ...f, access: e.target.value }))}>
                  <option value="private">Private</option>
                  <option value="institution">Institution</option>
                  <option value="group">Group</option>
                </select>
              </div>
            </div>
            {form.access === "group" ? (
              <div className="field">
                <label>Group ID</label>
                <input value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} />
              </div>
            ) : null}
            <div className="field">
              <label>Title (required)</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                placeholder={linkedProject?.title ? "Enter a file title for this project" : "File title"}
              />
              {linkedProject?.title &&
              /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(linkedProject.title) ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Enter a descriptive file title — project title was not auto-filled because it looks like a funding call name.
                </div>
              ) : null}
            </div>
            <div className="field">
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field">
              <label>File (PDF / Word / CSV / Excel / TXT / ZIP)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.csv,.xlsx,.xls,.txt,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="formActions">
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  try {
                    setError("");
                    if (!file) throw new Error("Pick a PDF, Word, CSV, Excel, TXT, or ZIP file");
                    const ext = file.name.split(".").pop()?.toLowerCase();
                    if (!["pdf", "doc", "docx", "csv", "xlsx", "xls", "txt", "zip"].includes(ext || "")) {
                      throw new Error("Only PDF, Word, CSV, Excel, TXT, or ZIP files are allowed");
                    }
                    if (!form.projectId) throw new Error("Select the research project this file belongs to");
                    if (!form.title.trim()) throw new Error("Enter a title for this file");
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("title", form.title.trim());
                    fd.append("description", form.description);
                    fd.append("access", form.access);
                    fd.append("projectId", form.projectId);
                    if (form.access === "group") fd.append("groupId", form.groupId);

                    await repositoryApi.uploadRepositoryItem(accessToken, fd);
                    setForm({
                      title: "",
                      description: "",
                      access: "private",
                      groupId: "",
                      projectId: projects.length === 1 ? projects[0].id : projectIdFromUrl || "",
                    });
                    setFile(null);
                    setShowForm(false);
                    await reload();
                  } catch (e) {
                    setError(e?.response?.data?.message || e.message || "Upload failed");
                  }
                }}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Items by project</div>
        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          {groupedByProject.map((group) => (
            <div key={group.projectId} className="card" style={{ borderColor: "rgba(148,163,184,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <Link
                    to={`/projects/${group.projectId}`}
                    style={{ fontWeight: 800, fontSize: 15, color: "inherit", textDecoration: "none" }}
                  >
                    {group.title}
                  </Link>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {group.items.length} file{group.items.length === 1 ? "" : "s"}
                  </div>
                </div>
                {canUpload ? (
                  <Link className="btn primary" to={`/repository?projectId=${group.projectId}`}>
                    + Upload
                  </Link>
                ) : null}
              </div>

              {group.items.length === 0 ? (
                <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>No files for this project yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {group.items.map((i) => (
                    <div key={i.id} className="card" style={{ background: "rgba(15,23,42,0.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{i.title}</div>
                          <div className="muted">
                            {i.type} • {i.access}
                          </div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: "4px 10px", fontSize: 13 }}
                              disabled={openingFileId === i.id}
                              onClick={() => handleOpenFile(i)}
                            >
                              {openingFileId === i.id ? "Opening…" : `Download ${i.fileName || "file"}`}
                            </button>
                          </div>
                        </div>
                        {canDeleteItem(i) ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171", alignSelf: "start" }}
                            onClick={() => handleDeleteItem(i)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {groupedByProject.length === 0 ? (
            <div className="muted">
              {canUpload ? (
                <>
                  No project-linked files yet. Open <Link to="/projects">Projects</Link>, then upload from a project.
                </>
              ) : (
                <>No repository files in this portal yet.</>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
