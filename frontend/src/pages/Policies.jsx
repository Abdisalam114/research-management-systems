import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as policyApi from "../services/policyApi";
import { PageHeader } from "../components/PageHeader";

const EMPTY = {
  title: "",
  body: "",
  category: "general",
  status: "published",
};

const CATEGORIES = [
  { value: "general", label: "General / Siyaasada guud" },
  { value: "research", label: "Research" },
  { value: "funding", label: "Funding" },
  { value: "ethics", label: "Ethics" },
];

export function PoliciesPage() {
  const { accessToken, user } = useAuth();
  const isLeadership = user?.role === "leadership";
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await policyApi.listPolicies(accessToken);
    setPolicies(res.policies || []);
  }, [accessToken]);

  const { loading, error: loadError, reload } = useModuleLoad(accessToken, load, []);
  const displayError = error || loadError;

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      body: p.body || "",
      category: p.category || "general",
      status: p.status || "published",
    });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Policy title is required.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body,
        category: form.category,
        status: form.status,
      };
      if (editingId) {
        await policyApi.updatePolicy(accessToken, editingId, payload);
        setMessage("Policy updated.");
      } else {
        await policyApi.createPolicy(accessToken, payload);
        setMessage("Policy published.");
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save policy.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this policy?")) return;
    setBusy(true);
    setError("");
    try {
      await policyApi.deletePolicy(accessToken, id);
      setMessage("Policy deleted.");
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not delete policy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Institutional Policies"
        subtitle={
          isLeadership
            ? "Siyaasada guud — create and maintain university research & funding policies."
            : "Published institutional policies for research, funding, and ethics."
        }
        stats={[{ label: "Policies", value: policies.length, filterKey: "all" }]}
        actions={
          isLeadership ? (
            <button type="button" className="btn primary" onClick={showForm ? resetForm : startCreate}>
              {showForm ? "Close form" : "+ New policy"}
            </button>
          ) : null
        }
      />

      {message ? (
        <div className="fundingCallsBanner fundingCallsBannerOk" style={{ marginBottom: 12 }}>
          {message}
        </div>
      ) : null}
      {displayError ? (
        <div className="fundingCallsBanner fundingCallsBannerErr" style={{ marginBottom: 12 }}>
          {displayError}
        </div>
      ) : null}

      {isLeadership && showForm ? (
        <form className="card" style={{ padding: 20, marginBottom: 16 }} onSubmit={handleSave}>
          <h3 style={{ marginTop: 0 }}>{editingId ? "Edit policy" : "New institutional policy"}</h3>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="pol-title">Title *</label>
            <input
              id="pol-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. General Research Funding Policy 2026"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="pol-cat">Category</label>
              <select
                id="pol-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pol-status">Status</label>
              <select
                id="pol-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="pol-body">Policy text</label>
            <textarea
              id="pol-body"
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the institutional policy content…"
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Update policy" : "Save policy"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading policies…</p> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {policies.map((p) => (
          <article key={p.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{p.title}</h3>
                  <span className="fundingCallMetaChip">{p.category}</span>
                  {p.status === "draft" ? (
                    <span className="fundingCallStatus fundingCallStatusDraft">draft</span>
                  ) : null}
                </div>
                {p.body ? (
                  <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 10, fontSize: 14 }}>
                    {p.body}
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    No body text.
                  </p>
                )}
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Updated {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
                </div>
              </div>
              {isLeadership ? (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <button type="button" className="btn" disabled={busy} onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => handleDelete(p.id)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {!loading && policies.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>No policies yet</div>
            <p className="muted" style={{ marginTop: 8 }}>
              {isLeadership
                ? "Create the first institutional policy (siyaasada guud)."
                : "Leadership has not published any policies yet."}
            </p>
            {isLeadership ? (
              <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={startCreate}>
                + New policy
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
