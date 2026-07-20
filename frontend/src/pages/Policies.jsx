import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as policyApi from "../services/policyApi";
import { PageHeader } from "../components/PageHeader";
import {
  POLICY_CATEGORY_LABELS,
  POLICY_CATEGORY_ORDER,
  POLICY_MODULE_OPTIONS,
  groupPoliciesByCategory,
  policyModuleLabel,
  policyModuleRoute,
} from "../constants/policyModules";

const EMPTY = {
  title: "",
  body: "",
  category: "general",
  moduleKey: "system_overview",
  status: "published",
};

const CATEGORIES = [
  { value: "general", label: "General / Siyaasada guud" },
  { value: "research", label: "Research" },
  { value: "funding", label: "Funding & Finance" },
  { value: "ethics", label: "Ethics (JUREC)" },
];

function PolicyCard({ policy, isLeadership, busy, onEdit, onDelete }) {
  const moduleRoute = policyModuleRoute(policy.moduleKey);
  return (
    <article className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>{policy.title}</h3>
            <span className="fundingCallMetaChip">{POLICY_CATEGORY_LABELS[policy.category] || policy.category}</span>
            {policy.moduleKey ? (
              moduleRoute ? (
                <Link className="fundingCallMetaChip" to={moduleRoute} title="Open related module">
                  {policyModuleLabel(policy.moduleKey)}
                </Link>
              ) : (
                <span className="fundingCallMetaChip">{policyModuleLabel(policy.moduleKey)}</span>
              )
            ) : null}
            {policy.status === "draft" ? (
              <span className="fundingCallStatus fundingCallStatusDraft">draft</span>
            ) : null}
          </div>
          {policy.body ? (
            <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>
              {policy.body}
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>No body text.</p>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Updated {policy.updatedAt ? new Date(policy.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
        {isLeadership ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <button type="button" className="btn" disabled={busy} onClick={() => onEdit(policy)}>
              Edit
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => onDelete(policy.id)}>
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PoliciesPage() {
  const { accessToken, user } = useAuth();
  const isLeadership = user?.role === "leadership";
  const [policies, setPolicies] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
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

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return policies;
    return policies.filter((p) => p.category === categoryFilter);
  }, [policies, categoryFilter]);

  const grouped = useMemo(() => groupPoliciesByCategory(filtered), [filtered]);

  const stats = useMemo(() => {
    const byCat = (c) => policies.filter((p) => p.category === c).length;
    return [
      { label: "Total", value: policies.length, filterKey: "all" },
      ...POLICY_CATEGORY_ORDER.map((c) => ({
        label: POLICY_CATEGORY_LABELS[c]?.split(" ")[0] || c,
        value: byCat(c),
        filterKey: c,
      })),
    ];
  }, [policies]);

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
      moduleKey: p.moduleKey || "system_overview",
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
    if (!form.moduleKey) {
      setError("System module is required.");
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
        moduleKey: form.moduleKey,
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
            ? "Siyaasada guud — one policy per RMS module; maintain university research, funding & ethics rules."
            : "Official policies for every function in the Research Management System."
        }
        stats={stats}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
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
            <label htmlFor="pol-module">System module *</label>
            <select
              id="pol-module"
              required
              value={form.moduleKey}
              onChange={(e) => setForm({ ...form, moduleKey: e.target.value })}
            >
              {POLICY_MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="pol-title">Title *</label>
            <input
              id="pol-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Voluntary Research Proposals Policy"
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
              rows={10}
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

      {!loading && filtered.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontWeight: 800 }}>No policies in this category</div>
          <p className="muted" style={{ marginTop: 8 }}>
            {isLeadership
              ? "Run institutional policy seed or create policies manually."
              : "Leadership has not published policies in this category yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {(categoryFilter === "all" ? POLICY_CATEGORY_ORDER : [categoryFilter]).map((cat) => {
            const items = grouped[cat] || [];
            if (!items.length) return null;
            return (
              <section key={cat}>
                <h2 style={{ fontSize: 16, margin: "0 0 10px", color: "#7dd3fc" }}>
                  {POLICY_CATEGORY_LABELS[cat] || cat}
                  <span className="muted" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                    ({items.length})
                  </span>
                </h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {items.map((p) => (
                    <PolicyCard
                      key={p.id}
                      policy={p}
                      isLeadership={isLeadership}
                      busy={busy}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
