import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as fundingCallApi from "../services/fundingCallApi";
import * as grantApi from "../services/grantApi";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { filterByStatKey, isAwardedItem, statFilterLabel } from "../utils/pageHeaderFilters";
import "./fundingCalls.css";

function defaultRequiredDocuments(callType) {
  if (callType === "external") {
    return [
      "Signed research proposal (PDF)",
      "Detailed budget breakdown",
      "Donor / agency compliance forms",
      "Ethics clearance (if human subjects)",
      "CV of Principal Investigator",
      "Letter of institutional support",
    ].join("\n");
  }
  return [
    "Signed research proposal (PDF)",
    "Detailed budget breakdown",
    "Ethics clearance (if human subjects)",
    "CV of Principal Investigator",
  ].join("\n");
}

function isAcceptedGrant(g) {
  return (
    isAwardedItem(g) ||
    ["pending_finance", "active", "approved"].includes(g?.status)
  );
}

function isAcceptedProposal(p) {
  return p?.status === "approved";
}

function grantStatusLabel(status) {
  if (status === "pending_finance") return "Accepted — pending finance";
  if (status === "active") return "Accepted — active / awarded";
  if (status === "approved") return "Accepted";
  if (status === "submitted") return "Submitted";
  if (status === "draft") return "Draft";
  if (status === "rejected") return "Rejected";
  return status || "—";
}

function proposalStatusLabel(status) {
  if (status === "approved") return "Accepted (proposal)";
  if (status === "under_review") return "Under review";
  if (status === "revision_requested") return "Revision requested";
  if (status === "submitted") return "Submitted";
  if (status === "draft") return "Draft";
  if (status === "rejected") return "Rejected";
  return status || "—";
}

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
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const callIdFromUrl = searchParams.get("callId") || "";
  const isDirector = user?.role === "research_director";
  const isDonor = user?.role === "donor_agency";
  const isLeadership = user?.role === "leadership";
  const isResearcher = user?.role === "researcher";
  const isFinance = user?.role === "finance_officer";
  const canCreate = isDirector || isDonor;
  const canSeeAllApps = isDirector || isLeadership || isDonor || isFinance;
  const [calls, setCalls] = useState([]);
  const [linkedGrants, setLinkedGrants] = useState([]);
  const [linkedProposals, setLinkedProposals] = useState([]);
  const [form, setForm] = useState(isDonor ? EMPTY_EXTERNAL : EMPTY_INTERNAL);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const [highlightedCallId, setHighlightedCallId] = useState("");

  const load = useCallback(async () => {
    const res = await fundingCallApi.listFundingCalls(accessToken);
    const nextCalls = res.calls || [];
    setCalls(nextCalls);
    if (isResearcher || canSeeAllApps) {
      const [gRes, pRes] = await Promise.all([
        grantApi.listGrants(accessToken).catch(() => ({ grants: [] })),
        proposalApi.listGrantFundCallProposals(accessToken).catch(() => ({ proposals: [] })),
      ]);
      const apps = (gRes.grants || []).filter((g) => g.callId);
      const props = (pRes.proposals || []).filter((p) => p.fundingCallId);
      setLinkedGrants(apps);
      setLinkedProposals(props);
    } else {
      setLinkedGrants([]);
      setLinkedProposals([]);
    }
  }, [accessToken, isResearcher, canSeeAllApps, user?.role]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, [isResearcher, canSeeAllApps]);

  // Deep-link from notification "Open" → scroll/highlight that funding call
  useEffect(() => {
    if (!callIdFromUrl || loading || !calls.length) return;
    const match = calls.find((c) => String(c.id) === String(callIdFromUrl));
    if (!match) return;
    setHighlightedCallId(String(match.id));
    if (match.status && match.status !== "all") {
      setStatusFilter(match.status === "open" || match.status === "draft" || match.status === "closed" ? match.status : "all");
    }
    const t = window.setTimeout(() => {
      const el = document.getElementById(`funding-call-${match.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [callIdFromUrl, calls, loading, setStatusFilter, user?.role]);

  const grantsByCallId = useMemo(() => {
    const map = {};
    linkedGrants.forEach((g) => {
      const key = String(g.callId);
      if (!map[key]) map[key] = [];
      map[key].push(g);
    });
    return map;
  }, [linkedGrants]);

  const proposalsByCallId = useMemo(() => {
    const map = {};
    linkedProposals.forEach((p) => {
      const key = String(p.fundingCallId);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [linkedProposals]);

  const acceptedGrants = useMemo(() => linkedGrants.filter(isAcceptedGrant), [linkedGrants]);
  const acceptedProposals = useMemo(() => linkedProposals.filter(isAcceptedProposal), [linkedProposals]);
  const acceptedTotal = acceptedGrants.length + acceptedProposals.length;

  const openCount = calls.filter((c) => c.status === "open").length;
  const draftCount = calls.filter((c) => c.status === "draft").length;
  const closedCount = calls.filter((c) => c.status === "closed").length;

  const filteredCalls = useMemo(
    () => filterByStatKey(calls, statusFilter),
    [calls, statusFilter]
  );

  function resetForm() {
    setForm(isDonor ? EMPTY_EXTERNAL : EMPTY_INTERNAL);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    const base = isDonor ? { ...EMPTY_EXTERNAL } : { ...EMPTY_INTERNAL };
    base.requiredDocuments = defaultRequiredDocuments(base.callType);
    setForm(base);
    setEditingId(null);
    setShowForm(true);
    setMessage("");
  }

  function startEdit(call) {
    setEditingId(call.id);
    const callType = isDonor ? "external" : call.callType || "internal";
    setForm({
      title: call.title,
      description: call.description || "",
      fundingSource: call.fundingSource,
      callType,
      donorRef: call.donorRef || "",
      amountCap: call.amountCap || "",
      currency: call.currency || "USD",
      deadline: call.deadline ? call.deadline.slice(0, 10) : "",
      eligibilityTier: call.eligibilityTier || "all",
      requiredDocuments: call.requiredDocuments || defaultRequiredDocuments(callType),
    });
    setShowForm(true);
    setMessage("");
  }

  function onCallTypeChange(nextType) {
    setForm((prev) => {
      const prevDefault = defaultRequiredDocuments(prev.callType);
      const docsUnchanged = !prev.requiredDocuments.trim() || prev.requiredDocuments.trim() === prevDefault.trim();
      return {
        ...prev,
        callType: nextType,
        requiredDocuments: docsUnchanged ? defaultRequiredDocuments(nextType) : prev.requiredDocuments,
      };
    });
  }

  function canEditCall(call) {
    if (call.status !== "draft") return false;
    if (isDirector) return true;
    if (isDonor && call.callType === "external" && String(call.createdBy) === String(user?.id)) return true;
    return false;
  }

  function canPublishCall(call) {
    if (call.status !== "draft") return false;
    return isDirector;
  }

  function canCloseCall(call) {
    if (call.status !== "open") return false;
    if (isDirector) return true;
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
    const resolvedType = isDonor ? "external" : form.callType === "external" ? "external" : "internal";
    if (resolvedType === "external" && !form.donorRef.trim()) {
      setError("Donor / agency reference is required for external calls.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        callType: resolvedType,
        title: form.title.trim(),
        fundingSource: form.fundingSource.trim(),
        description: form.description.trim(),
        donorRef: form.donorRef.trim(),
        requiredDocuments: form.requiredDocuments.trim() || defaultRequiredDocuments(resolvedType),
        amountCap: Number(form.amountCap) || 0,
        deadline: form.deadline || null,
      };
      if (editingId) {
        await fundingCallApi.updateFundingCall(accessToken, editingId, payload);
        setMessage("Funding call updated successfully.");
      } else {
        await fundingCallApi.createFundingCall(accessToken, payload);
        setMessage(
          resolvedType === "external"
            ? "External funding call draft saved. Research Director can Publish (no Leadership step)."
            : "Funding call draft saved. Click Publish when ready — Leadership is not required."
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
await fundingCallApi.publishFundingCall(accessToken, id);
      setMessage("Funding call published — eligible researchers have been notified.");
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

  const pendingFinanceCount = acceptedGrants.filter((g) => g.status === "pending_finance").length;

  const subtitle = isDonor
    ? "Create external (donor) funding call drafts. Research Director publishes — Leadership is not required."
    : isLeadership
      ? "View funding calls. Peer review is under Proposals / Peer Reviews (you do not publish calls)."
      : isDirector
        ? "Create and Publish Internal or External funding calls yourself — no Leadership approval needed."
        : isResearcher
          ? "Open calls to apply. Accepted applications stay visible here (and under Grants → Awarded)."
          : "Open institutional grant opportunities. Researchers apply through an open call.";

  return (
    <div className="fundingCallsPage">
      <PageHeader
        title="Funding Calls"
        subtitle={subtitle}
        stats={[
          { label: "Total calls", value: calls.length, filterKey: "all" },
          { label: "Open", value: openCount, filterKey: "open", accent: "#86efac" },
          { label: "Drafts", value: draftCount, filterKey: "draft", accent: "#fcd34d" },
          { label: "Closed", value: closedCount, filterKey: "closed", accent: "#94a3b8" },
          {
            label: "Accepted",
            value: acceptedTotal,
            filterKey: "all",
            accent: "#38bdf8",
            sub: "Proposals + grants",
          },
        ]}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {(isResearcher || canSeeAllApps) && acceptedTotal ? (
              <Link className="btn primary" to={acceptedProposals.length ? "/proposals" : "/grants?filter=awarded"}>
                {acceptedProposals.length ? "View proposals" : "View accepted in Grants"}
              </Link>
            ) : null}
            {canCreate ? (
              <button type="button" className="btn primary" onClick={showForm ? resetForm : startCreate}>
                {showForm ? "Close form" : isDonor ? "+ New external call" : "+ New funding call"}
              </button>
            ) : isLeadership ? (
              <Link className="btn" to="/policies">
                Institutional policies
              </Link>
            ) : null}
          </>
        }
      />

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Applying from a project — project context stays selected on Apply.{" "}
          <Link to="/funding-calls">clear project filter</Link>
        </p>
      ) : null}

      {callIdFromUrl && highlightedCallId ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Opened from notification — highlighting this funding call.{" "}
          <Link to="/funding-calls">show all calls</Link>
        </p>
      ) : null}

      {pendingFinanceCount > 0 && (isFinance || isDirector || isLeadership) ? (
        <div className="fundingCallsBanner fundingCallsBannerOk" style={{ marginTop: 10 }}>
          {pendingFinanceCount} award{pendingFinanceCount === 1 ? "" : "s"} waiting for budget authorization.{" "}
          <Link to="/finance/grant-approvals" style={{ fontWeight: 700 }}>
            Go to Grant funding approval →
          </Link>
        </div>
      ) : null}

      {message ? <div className="fundingCallsBanner fundingCallsBannerOk">{message}</div> : null}
      {error ? <div className="fundingCallsBanner fundingCallsBannerErr">{error}</div> : null}

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(
            [
              { label: "Total calls", filterKey: "all" },
              { label: "Open", filterKey: "open" },
              { label: "Drafts", filterKey: "draft" },
              { label: "Closed", filterKey: "closed" },
            ],
            statusFilter
          )}</strong>{" "}
          ({filteredCalls.length})
        </p>
      ) : null}

      {(isResearcher || canSeeAllApps) && acceptedTotal ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.45)" }}>
          <div style={{ fontWeight: 800 }}>Accepted funding-call applications</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Proposals accepted under a funding call appear here (and under Projects when a project was created).
            Grant awards also appear under <Link to="/grants?filter=awarded">Grants → Awarded</Link>.
          </p>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {acceptedProposals.map((p) => (
              <div
                key={`p-${p.id}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {proposalStatusLabel(p.status)}
                    {p.fundingCall?.title ? ` · Call: ${p.fundingCall.title}` : ""}
                    {p.researcherName ? ` · ${p.researcherName}` : ""}
                  </div>
                </div>
                <Link className="btn primary" to={`/proposals/${p.id}`}>
                  Open proposal
                </Link>
              </div>
            ))}
            {acceptedGrants.map((g) => (
              <div
                key={`g-${g.id}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{g.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {grantStatusLabel(g.status)}
                    {g.fundingCall?.title ? ` · Call: ${g.fundingCall.title}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.status === "pending_finance" && isFinance ? (
                    <Link className="btn primary" to="/finance/grant-approvals">
                      Authorize budget
                    </Link>
                  ) : null}
                  <Link className="btn primary" to={`/grants/${g.id}`}>
                    Open grant
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canCreate && showForm ? (
        <form className="card fundingCallFormCard" onSubmit={handleSave}>
          <div className="fundingCallFormHeader">
            <div>
              <h3 className="fundingCallFormTitle">
                {editingId
                  ? "Edit draft funding call"
                  : isDonor
                    ? "Create external funding call"
                    : "Create funding call"}
              </h3>
              <p className="fundingCallFormSub muted">
                {isDonor
                  ? "External calls are saved as draft. Research Director publishes them (no Leadership step)."
                  : "Choose Internal or External. Save draft, then Publish yourself — Leadership is not required."}
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
                : "Select Internal (university seed) or External (donor/agency). Eligibility controls who is notified (UG / PG / all)."}
            </p>
            <div className="fundingCallFormGrid">
              <div className="field">
                <label htmlFor="fc-source">Funding source *</label>
                <input
                  id="fc-source"
                  required
                  placeholder={
                    form.callType === "external" || isDonor
                      ? "e.g. UNESCO / World Bank"
                      : "e.g. Jamhuriya University Research Office"
                  }
                  value={form.fundingSource}
                  onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="fc-type">Call type *</label>
                {isDonor ? (
                  <select id="fc-type" value="external" disabled>
                    <option value="external">External / donor-funded grant</option>
                  </select>
                ) : (
                  <select
                    id="fc-type"
                    value={form.callType || "internal"}
                    onChange={(e) => onCallTypeChange(e.target.value)}
                  >
                    <option value="internal">Internal seed grant</option>
                    <option value="external">External / donor-funded grant</option>
                  </select>
                )}
              </div>
              {(isDonor || form.callType === "external") ? (
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
            <p className="fundingCallFormSectionHint muted">
              Filled automatically from call type. Edit lines if your call needs different documents.
            </p>
            <div className="fundingCallFormGrid">
              <div className="field field--full">
                <label htmlFor="fc-docs">Required documents (one per line)</label>
                <textarea
                  id="fc-docs"
                  rows={5}
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
                ? "Director will be notified to Publish this external call."
                : "After Save, click Publish call — Leadership is not needed."}
            </span>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading funding calls…</p> : null}

      <div className="fundingCallList">
        {filteredCalls.map((c) => (
          <article
            key={c.id}
            id={`funding-call-${c.id}`}
            className={`card fundingCallCard${highlightedCallId === String(c.id) ? " fundingCallCardHighlight" : ""}`}
            style={
              highlightedCallId === String(c.id)
                ? { outline: "2px solid #38bdf8", boxShadow: "0 0 0 4px rgba(56,189,248,0.25)" }
                : undefined
            }
          >
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
                {isResearcher && c.status === "open" && !(grantsByCallId[String(c.id)] || []).length ? (
                  <Link
                    className="btn primary"
                    to={
                      projectIdFromUrl
                        ? `/grants/apply?callId=${c.id}&projectId=${projectIdFromUrl}`
                        : `/grants/apply?callId=${c.id}`
                    }
                  >
                    Apply via this call
                  </Link>
                ) : null}
                {isResearcher && (grantsByCallId[String(c.id)] || []).length ? (
                  <Link
                    className="btn primary"
                    to={`/grants/${grantsByCallId[String(c.id)][0].id}`}
                  >
                    Open my application
                  </Link>
                ) : null}
                {canEditCall(c) ? (
                  <button type="button" className="btn" onClick={() => startEdit(c)}>
                    Edit draft
                  </button>
                ) : null}
                {canPublishCall(c) ? (
                  <button type="button" className="btn primary" disabled={busy} onClick={() => publish(c.id)}>
                    Publish call
                  </button>
                ) : null}
                {canCloseCall(c) ? (
                  <button type="button" className="btn" disabled={busy} onClick={() => closeCall(c.id)}>
                    Close call
                  </button>
                ) : null}
              </div>
            </div>

            {(grantsByCallId[String(c.id)] || []).length ||
            (proposalsByCallId[String(c.id)] || []).length ? (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(148,163,184,0.25)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {isResearcher ? "My applications" : "Applications on this call"}
                </div>
                {(proposalsByCallId[String(c.id)] || []).map((p) => (
                  <div
                    key={`p-${p.id}`}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.title}</span>
                    <span className={statusClass(isAcceptedProposal(p) ? "open" : p.status === "draft" ? "draft" : "closed")}>
                      {proposalStatusLabel(p.status)}
                    </span>
                    <Link to={`/proposals/${p.id}`} style={{ fontWeight: 700 }}>
                      View proposal →
                    </Link>
                  </div>
                ))}
                {(grantsByCallId[String(c.id)] || []).map((g) => (
                  <div
                    key={`g-${g.id}`}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{g.title}</span>
                    <span
                      className={statusClass(
                        isAcceptedGrant(g) ? "open" : g.status === "draft" ? "draft" : g.status === "submitted" ? "open" : "closed"
                      )}
                    >
                      {grantStatusLabel(g.status)}
                    </span>
                    <Link to={`/grants/${g.id}`} style={{ fontWeight: 700 }}>
                      View in Grants →
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {!loading && filteredCalls.length === 0 ? (
          <div className="card fundingCallEmpty">
            <div className="fundingCallEmptyIcon" aria-hidden="true">
              📢
            </div>
            <div style={{ fontWeight: 800 }}>No funding calls yet</div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {isDirector
                ? "Create your first funding call (Internal or External), then Publish."
                : isDonor
                  ? "Create an external funding call draft — Director publishes it."
                  : isLeadership
                    ? "Funding calls are published by the Research Director. Your peer-review work is under Peer Reviews."
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
