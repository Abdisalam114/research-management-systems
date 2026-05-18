import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as repositoryApi from "../services/repositoryApi";
import { apiOrigin } from "../config/apiBase";

export function RepositoryPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ type: "dataset", title: "", description: "", access: "private", groupId: "" });
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    const res = await repositoryApi.listRepositoryItems(accessToken);
    setItems(res.items || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Research Repository</h2>
      {loading ? <p className="muted">Loading repository…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Upload Item</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="dataset">Dataset</option>
                <option value="publication">Publication</option>
                <option value="thesis">Thesis</option>
                <option value="document">Document</option>
              </select>
            </div>
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
            <label>File</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <button
            className="btn primary"
            onClick={async () => {
              try {
                setError("");
                if (!file) throw new Error("Pick a file first");
                const fd = new FormData();
                fd.append("file", file);
                fd.append("type", form.type);
                fd.append("title", form.title);
                fd.append("description", form.description);
                fd.append("access", form.access);
                if (form.access === "group") fd.append("groupId", form.groupId);

                await repositoryApi.uploadRepositoryItem(accessToken, fd);
                setForm({ type: "dataset", title: "", description: "", access: "private", groupId: "" });
                setFile(null);
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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Items</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {items.map((i) => (
            <div key={i.id} className="card">
              <div style={{ fontWeight: 800 }}>{i.title}</div>
              <div className="muted">
                {i.type} • {i.access}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                File:{" "}
                <a href={`${apiOrigin()}${i.filePath}`} target="_blank" rel="noreferrer">
                  {i.filePath}
                </a>
              </div>
            </div>
          ))}
          {items.length === 0 ? <div className="muted">No repository items yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

