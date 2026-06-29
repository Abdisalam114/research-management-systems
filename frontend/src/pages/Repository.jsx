import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as repositoryApi from "../services/repositoryApi";
import * as projectApi from "../services/projectApi";
import { apiOrigin } from "../config/apiBase";
import { PageHeader } from "../components/PageHeader";

import { filterByStatKey, statFilterLabel, totalStatTile, typeStatTile } from "../utils/pageHeaderFilters";

export function RepositoryPage() {
  const { accessToken, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", access: "private", groupId: "", projectId: projectIdFromUrl });
  const [file, setFile] = useState(null);
  const [exporting, setExporting] = useState("");

  const canUpload = user?.role === "researcher";

  useEffect(() => {
    if (projectIdFromUrl) {
      setForm((f) => ({ ...f, projectId: projectIdFromUrl }));
    }
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!canUpload || !accessToken) return;
    projectApi.listProjects(accessToken).then((res) => {
      const list = res.projects || [];
      setProjects(list);
      if (list.length === 1) {
        setForm((f) => (f.projectId ? f : { ...f, projectId: list[0].id }));
      }
    }).catch(() => setProjects([]));
  }, [accessToken, canUpload]);

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
      typeStatTile("PDF", by("document"), "document", "#1d4ed8"),
      typeStatTile("CSV / Excel", by("dataset"), "dataset", "#38bdf8"),
    ];
  }, [items]);

  const filteredItems = useMemo(() => filterByStatKey(items, statusFilter), [items, statusFilter]);

  async function handleExport(kind) {
    try {
      setExporting(kind);
      setError("");
      if (kind === "pdf") await repositoryApi.downloadRepositoryPdf(accessToken);
      else if (kind === "excel") await repositoryApi.downloadRepositoryExcel(accessToken);
      else await repositoryApi.downloadRepositoryCsv(accessToken);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Export failed");
    } finally {
      setExporting("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Research Repository"
        subtitle="PDF, CSV, and Excel files — upload and export your repository catalog."
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
          Filtered to one project —{" "}
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
            PDF, CSV, or Excel (.xlsx / .xls) only — other formats are not allowed.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Research project (required)</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                required
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
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
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field">
              <label>File (PDF / CSV / Excel)</label>
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    if (!file) throw new Error("Pick a PDF, CSV, or Excel file");
                    const ext = file.name.split(".").pop()?.toLowerCase();
                    if (!["pdf", "csv", "xlsx", "xls"].includes(ext || "")) {
                      throw new Error("Only PDF, CSV, and Excel files are allowed");
                    }
                    if (!form.projectId) throw new Error("Select the research project this file belongs to");
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("title", form.title);
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
        <div style={{ fontWeight: 800 }}>Items</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filteredItems.map((i) => (
            <div key={i.id} className="card">
              <div style={{ fontWeight: 800 }}>{i.title}</div>
              <div className="muted">
                {i.type} • {i.access}
                {i.projectTitle ? ` • Project: ${i.projectTitle}` : i.projectId ? " • Project linked" : ""}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                File:{" "}
                <a href={`${apiOrigin()}${i.filePath}`} target="_blank" rel="noreferrer">
                  {i.filePath}
                </a>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <div className="muted">{items.length === 0 ? "No repository items yet." : "No items match this filter."}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
