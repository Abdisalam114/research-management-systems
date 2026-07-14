import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as fundingCallApi from "../services/fundingCallApi";
import { PageHeader } from "../components/PageHeader";
import "./fundingCalls.css";

const EMPTY_INTERNAL = {
  title: "",
  description: "",
  fundingSource: "",
  callType: "internal",
  donorRef: "",
  amountCap: "",
  currency: "USD",
  deadline: "",
  eligibilityTier: "all",
  requiredDocuments: "",
};

const EMPTY_EXTERNAL = {
  ...EMPTY_INTERNAL,
  callType: "external",
};

const ELIGIBILITY_OPTIONS = [
  { value: "all", label: "All researchers (UG & PG)" },
  { value: "ug", label: "Undergraduate portal only" },
  { value: "pg", label: "Postgraduate portal only" },
  { value: "pgd", label: "Postgraduate diploma (PGD)" },
];

const CURRENCY_OPTIONS = ["USD", "SOS", "EUR", "GBP"];

function statusClass(status) {
  if (status === "open") return "fundingCallStatus fundingCallStatusOpen";
  if (status === "closed") return "fundingCallStatus fundingCallStatusClosed";
  return "fundingCallStatus fundingCallStatusDraft";
}

function eligibilityLabel(tier) {
  return ELIGIBILITY_OPTIONS.find((o) => o.value === tier)?.label || tier;
}

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency || "USD"} ${n.toLocaleString()}`;
  }
}

export function FundingCallsPage() {
  const { accessToken, user } = useAuth();
  const isDirector = user?.role === "research_director";
  const isDonor = user?.role === "donor_agency";
  const isLeadership = user?.role === "leadership";
  const isResearcher = user?.role === "researcher";
  const canCreate = isDirector || isDonor;
  const [calls, setCalls] = useState([]);
  const [form, setForm] = useState(isDonor ? EMPTY_EXTERNAL : EMPTY_INTERNAL);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fundingCallApi.listFundingCalls(accessToken);
    setCalls(res.calls || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, []);

  function resetForm() {
    setForm(isDonor ? EMPTY_EXTERNAL : EMPTY_INTERNAL);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(isDonor ? EMPTY_EXTERNAL : EMPTY_INTERNAL);
    setEditingId(null);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(call) {
    setEditingId(call.id);
    setForm({
      title: call.title,
      description: call.description || "",
      fundingSource: call.fundingSource,
      callType: isDonor ? "external" : isDirector ? "internal" : call.callType || "internal",
      donorRef: call.donorRef || "",
      amountCap: call.amountCap || "",
      currency: call.currency || "USD",
      deadline: call.deadline ? call.deadline.slice(0, 10) : "",
      eligibilityTier: call.eligibilityTier || "all",
      requiredDocuments: call.requiredDocuments || "",
    });
    setShowForm(true);
    setMessage("");
  }

  function canEditCall(call) {
    if (call.status !== "draft") return false;
    if (isDirector && call.callType !== "external") return true;
    if (isDonor && call.callType === "external" && String(call.createdBy) === String(user?.id)) return true;
    return false;
  }

  function canPublishCall(call) {
    if (call.status !== "draft") return false;
    if (isLeadership) return true;
    if (isDirector && call.callType !== "external") return true;
    return false;
  }

  function canCloseCall(call) {
    if (call.status !== "open") return false;
    if (isLeadership || isDirector) return true;
    if (isDonor && call.callType === "external" && String(call.createdBy) === String(user?.id)) return true;
    return false;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Call title is required.");
      return;
    }
    if (!form.fundingSource.trim()) {
      setError("Funding source is required.");
      return;
    }
    if (isDonor && !form.donorRef.trim()) {
      setError("Donor / agency reference is required for external calls.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        callType: isDonor ? "external" : "internal",
        title: form.title.trim(),
        fundingSource: form.fundingSource.trim(),
        description: form.description.trim(),
        donorRef: form.donorRef.trim(),
        requiredDocuments: form.requiredDocuments.trim(),
        amountCap: Number(form.amountCap) || 0,
        deadline: form.deadline || null,
      };
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          hypothesisId: "B",
          location: "FundingCalls.jsx:handleSave",
          message: "client save funding call",
          data: { role: user?.role, callType: payload.callType, editing: Boolean(editingId) },
          timestamp: Date.now(),
          runId: "pre-fix",
        }),
      }).catch(() => {});
      // #endregion
      if (editingId) {
        await fundingCallApi.updateFundingCall(accessToken, editingId, payload);
        setMessage("Funding call updated successfully.");
      } else {
        await fundingCallApi.createFundingCall(accessToken, payload);
        setMessage(
          isDonor
            ? "External funding call draft saved. Leadership must approve before it opens to researchers."
            : "Internal funding call draft saved. Publish or wait for Leadership approval."
        );
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save funding call.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id) {
    setBusy(true);
    setError("");
    try {
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          hypothesisId: "C",
          location: "FundingCalls.jsx:publish",
          message: "client publish funding call",
          data: { role: user?.role, callId: id },
          timestamp: Date.now(),
          runId: "pre-fix",
        }),
      }).catch(() => {});
      // #endregion
      await fundingCallApi.publishFundingCall(accessToken, id);
      setMessage(
        isLeadership
          ? "Funding call approved and published — eligible researchers have been notified."
          : "Funding call published — eligible researchers have been notified."
      );
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function closeCall(id) {
    setBusy(true);
    setError("");
    try {
      await fundingCallApi.closeFundingCall(accessToken, id);
      setMessage("Funding call closed — new applications are no longer accepted.");
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not close funding call.");
    } finally {
      setBusy(false);
    }
  }

  const openCount = calls.filter((c) => c.status === "open").length;
  const draftCount = calls.filter((c) => c.status === "draft").length;

  const subtitle = isDonor
    ? "Create external (donor) funding calls only. Leadership approves before researchers can apply."
    : isLeadership
      ? "Approve draft funding calls for publication, and close open calls when needed."
      : isDirector
        ? "Create internal institutional seed grants. External calls are created by the Donor Agency."
        : "Publish institutional grant opportunities. Researchers apply only through an open call (Phase 1).";

  return (
    <div className="fundingCallsPage">
      <PageHeader
        title="Funding Calls"
        subtitle={subtitle}
        stats={[
          { label: "Total calls", value: calls.length, filterKey: "all" },
          { label: "Open", value: openCount, filterKey: "open", accent: "#86efac" },
          { label: "Drafts", value: draftCount, filterKey: "draft", accent: "#fcd34d" },
        ]}
        actions={
          canCreate ? (
            <button type="button" className="btn primary" onClick={showForm ? resetForm : startCreate}>
              {showForm ? "Close form" : isDonor ? "+ New external call" : "+ New funding call"}
            </button>
          ) : isLeadership ? (
            <Link className="btn" to="/policies">
              Institutional policies
            </Link>
          ) : null
        }
      />

      {message ? <div className="fundingCallsBanner fundingCallsBannerOk">{message}</div> : null}
      {error ? <div className="fundingCallsBanner fundingCallsBannerErr">{error}</div> : null}

      {canCreate && showForm ? (
        <form className="card fundingCallFormCard" onSubmit={handleSave}>
          <div className="fundingCallFormHeader">
            <div>
              <h3 className="fundingCallFormTitle">
                {editingId
                  ? "Edit draft funding call"
                  : isDonor
                    ? "Create external funding call"
                    : "Create internal funding call"}
              </h3>
              <p className="fundingCallFormSub muted">
                {isDonor
                  ? "External calls are saved as draft until Leadership approves and publishes them."
                  : "Internal calls are saved as draft until published (Director or Leadership)."}
              </p>
            </div>
            <span className="fundingCallStatus fundingCallStatusDraft">Draft</span>
          </div>

          <section className="fundingCallFormSection">
            <h4 className="fundingCallFormSectionTitle">1. Call overview</h4>
            <div className="fundingCallFormGrid">
              <div className="field field--full">
                <label htmlFor="fc-title">Call title *</label>
                <input
                  id="fc-title"
                  required
                  placeholder={
                    isDonor
                      ? "e.g. UNESCO External Research Grant 2026"
                      : "e.g. JUST Internal Seed Grant 2026 — Faculty of Science"
                  }
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="field field--full">
                <label htmlFor="fc-description">Description & objectives</label>
                <textarea
                  id="fc-description"
                  rows={4}
                  placeholder="Describe the purpose of this call, eligible research areas, and what applicants should prepare."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="fundingCallFormSection">
            <h4 className="fundingCallFormSectionTitle">2. Funding details</h4>
            <p className="fundingCallFormSectionHint muted">
              {isDonor
                ? "Donor Agency creates external / agency-funded calls only. Call type is locked to External."
                : "Research Director creates internal university-funded seed grants only."}
            </p>
            <div className="fundingCallFormGrid">
              <div className="field">
                <label htmlFor="fc-source">Funding source *</label>
                <input
                  id="fc-source"
                  required
                  placeholder={
                    isDonor ? "e.g. UNESCO / World Bank" : "e.g. Jamhuriya University Research Office"
                  }
                  value={form.fundingSource}
                  onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="fc-type">Call type</label>
                <select id="fc-type" value={isDonor ? "external" : "internal"} disabled>
                  {isDonor ? (
                    <option value="external">External / donor-funded grant</option>
                  ) : (
                    <option value="internal">Internal seed grant</option>
                  )}
                </select>
              </div>
              {isDonor ? (
                <div className="field">
                  <label htmlFor="fc-donor">Donor / agency reference *</label>
                  <input
                    id="fc-donor"
                    required
                    placeholder="e.g. UNESCO-2026-UG-01"
                    value={form.donorRef}
                    onChange={(e) => setForm({ ...form, donorRef: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="fc-amount">Maximum award per project</label>
                <input
                  id="fc-amount"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0"
                  value={form.amountCap}
                  onChange={(e) => setForm({ ...form, amountCap: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="fc-currency">Currency</label>
                <select id="fc-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="fundingCallFormSection">
            <h4 className="fundingCallFormSectionTitle">3. Eligibility & timeline</h4>
            <div className="fundingCallFormGrid">
              <div className="field">
                <label htmlFor="fc-deadline">Application deadline</label>
                <input
                  id="fc-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="fc-eligibility">Eligible researchers</label>
                <select
                  id="fc-eligibility"
                  value={form.eligibilityTier}
                  onChange={(e) => setForm({ ...form, eligibilityTier: e.target.value })}
                >
                  {ELIGIBILITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="fundingCallFormSection">
            <h4 className="fundingCallFormSectionTitle">4. Application requirements</h4>
            <div className="fundingCallFormGrid">
              <div className="field field--full">
                <label htmlFor="fc-docs">Required documents (one per line)</label>
                <textarea
                  id="fc-docs"
                  rows={4}
                  placeholder={"Signed proposal PDF\nBudget breakdown (Excel or PDF)\nEthics approval letter (if applicable)"}
                  value={form.requiredDocuments}
                  onChange={(e) => setForm({ ...form, requiredDocuments: e.target.value })}
                />
              </div>
            </div>
          </section>

          <div className="fundingCallFormActions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Update draft" : "Save as draft"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={resetForm}>
              Cancel
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              {isDonor
                ? "Leadership will be notified to approve this external call."
                : "Publishing notifies eligible researchers in this portal."}
            </span>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading funding calls…</p> : null}

      <div className="fundingCallList">
        {calls.map((c) => (
          <article key={c.id} className="card fundingCallCard">
            <div className="fundingCallCardTop">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 className="fundingCallCardTitle">{c.title}</h3>
                  <span className={statusClass(c.status)}>{c.status}</span>
                </div>

                <div className="fundingCallMetaRow">
                  <span className={`fundingCallMetaChip ${c.callType === "external" ? "fundingCallTypeExternal" : "fundingCallTypeInternal"}`}>
                    {c.callType === "external" ? "External grant" : "Internal seed grant"}
                  </span>
                  <span className="fundingCallMetaChip">
                    Source: <strong>{c.fundingSource}</strong>
                  </span>
                  {c.donorRef ? (
                    <span className="fundingCallMetaChip">
                      Ref: <strong>{c.donorRef}</strong>
                    </span>
                  ) : null}
                  <span className="fundingCallMetaChip">
                    Cap: <strong>{formatMoney(c.amountCap, c.currency)}</strong>
                  </span>
                  {c.deadline ? (
                    <span className="fundingCallMetaChip">
                      Deadline: <strong>{new Date(c.deadline).toLocaleDateString()}</strong>
                    </span>
                  ) : null}
                  <span className="fundingCallMetaChip">
                    Eligibility: <strong>{eligibilityLabel(c.eligibilityTier)}</strong>
                  </span>
                </div>

                {c.description ? <p className="fundingCallDescription">{c.description}</p> : null}

                {c.requiredDocuments ? (
                  <div className="fundingCallDocs">
                    <div className="fundingCallDocsLabel">Required documents</div>
                    {c.requiredDocuments.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => (
                      <div key={line}>• {line}</div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="fundingCallActions">
                {isResearcher && c.status === "open" ? (
                  <Link className="btn primary" to={`/grants/apply?callId=${c.id}`}>
                    Apply via this call
                  </Link>
                ) : null}
                {canEditCall(c) ? (
                  <button type="button" className="btn" onClick={() => startEdit(c)}>
                    Edit draft
                  </button>
                ) : null}
                {canPublishCall(c) ? (
                  <button type="button" className="btn primary" disabled={busy} onClick={() => publish(c.id)}>
                    {isLeadership ? "Approve & publish" : "Publish call"}
                  </button>
                ) : null}
                {canCloseCall(c) ? (
                  <button type="button" className="btn" disabled={busy} onClick={() => closeCall(c.id)}>
                    Close call
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {!loading && calls.length === 0 ? (
          <div className="card fundingCallEmpty">
            <div className="fundingCallEmptyIcon" aria-hidden="true">
              📢
            </div>
            <div style={{ fontWeight: 800 }}>No funding calls yet</div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "Create your first internal call for researchers."
                : isDonor
                  ? "Create an external funding call draft for Leadership to approve."
                  : isLeadership
                    ? "When Director or Donor saves a draft, approve it here to open applications."
                    : "When the Research Office publishes a call, it will appear here for application."}
            </p>
            {canCreate ? (
              <button type="button" className="btn primary" style={{ marginTop: 14 }} onClick={startCreate}>
                {isDonor ? "+ Create external call" : "+ Create funding call"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
