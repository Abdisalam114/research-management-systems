import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as policyApi from "../services/policyApi";

const TYPES = [
  { value: "policy", label: "Policy" },
  { value: "theme", label: "Research theme" },
  { value: "priority", label: "Priority" },
  { value: "program", label: "Program" },
];

export function ResearchPoliciesPage() {
  const { accessToken } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState({ type: "policy", title: "", description: "", status: "active" });
  const [error, setError] = useState("");

  async function load() {
    const res = await policyApi.listPolicies(accessToken);
    setPolicies(res.policies || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load policies"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Strategic research management</h2>
      <p className="muted">Policies, themes, priorities, and programs (Research Director).</p>
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create entry</div>
        <div className="row">
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Description</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <button
          className="btn primary"
          onClick={async () => {
            try {
              await policyApi.createPolicy(accessToken, form);
              setForm({ type: "policy", title: "", description: "", status: "active" });
              await load();
            } catch (e) {
              setError(e?.response?.data?.message || "Create failed");
            }
          }}
        >
          Save
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Active registry</div>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>{p.type}</td>
                <td>{p.title}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
