import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import * as projectApi from "../services/projectApi";
import * as fundingCallApi from "../services/fundingCallApi";
import { PageHeader } from "../components/PageHeader";
import { GrantBudgetLines, defaultBudgetRows, budgetRowsTotal } from "../components/GrantBudgetLines";
import { filterByStatKey, isAwardedItem, statFilterLabel } from "../utils/pageHeaderFilters";

const GRANT_STATUS_STYLES = {
  draft: { bg: "rgba(148,163,184,0.2)", color: "#cbd5e1", label: "Draft" },
  submitted: { bg: "rgba(56,189,248,0.2)", color: "#7dd3fc", label: "Submitted" },
  pending_finance: { bg: "rgba(251,191,36,0.2)", color: "#fcd34d", label: "Pending finance" },
  approved: { bg: "rgba(29,78,216,0.25)", color: "#93c5fd", label: "Approved" },
  active: { bg: "rgba(34,197,94,0.2)", color: "#86efac", label: "Awarded" },
  rejected: { bg: "rgba(239,68,68,0.2)", color: "#fca5a5", label: "Rejected" },
  closed: { bg: "rgba(100,116,139,0.25)", color: "#94a3b8", label: "Closed" },
};

function GrantStatusBadge({ status }) {
  const s = GRANT_STATUS_STYLES[status] || { bg: "rgba(148,163,184,0.2)", color: "#cbd5e1", label: status };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function GrantAmounts({ grant }) {
  const requested = Number(grant.amountRequested || 0);
  const awarded = Number(grant.amountAwarded || 0);
  const currency = grant.currency || "USD";
  const fmt = (n) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.45)",
        border: "1px solid rgba(56,189,248,0.12)",
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
          Requested
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#e2e8f0", marginTop: 2 }}>{fmt(requested)}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
          Awarded
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 15,
            marginTop: 2,
            color: awarded > 0 ? "#38bdf8" : "#fbbf24",
          }}
        >
          {awarded > 0 ? fmt(awarded) : "Pending — not awarded yet"}
        </div>
      </div>
    </div>
  );
}

export function GrantsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const callIdFromUrl = searchParams.get("callId") || "";
  const [linkedCall, setLinkedCall] = useState(null);
  const [grants, setGrants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    fundingSource: "",
    donorRef: "",
    amountRequested: 0,
    currency: "USD",
    projectId: "",
    callId: "",
  });
  const [budgetRows, setBudgetRows] = useState(defaultBudgetRows);
  const [donorFilter, setDonorFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const isLeadership = user?.role === "leadership";
  const canViewAll = ["research_director", "finance_officer", "faculty_coordinator", "leadership"].includes(user?.role);

  const load = useCallback(async () => {
    const isResearcher = user?.role === "researcher";
    const grantParams = projectIdFromUrl ? { projectId: projectIdFromUrl } : {};
    const [res, projRes] = await Promise.all([
      grantApi.listGrants(accessToken, grantParams),
      isResearcher
        ? projectApi.listProjects(accessToken).catch(() => ({ projects: [] }))
        : Promise.resolve({ projects: [] }),
    ]);
    const list = res.grants || [];
    const projectList = projRes.projects || [];
    setGrants(list);
    setProjects(projectList);
    if (isResearcher && projectList.length === 1) {
      setForm((f) => (f.projectId ? f : { ...f, projectId: projectList[0].id }));
    }
  }, [accessToken, user?.role, projectIdFromUrl]);

  useEffect(() => {
    if (!callIdFromUrl || !accessToken) return;
    if (user?.role === "researcher") {
      navigate(`/grants/apply?callId=${encodeURIComponent(callIdFromUrl)}`, { replace: true });
      return;
    }
    fundingCallApi.getFundingCall(accessToken, callIdFromUrl).then((res) => {
      const c = res.call;
      setLinkedCall(c);
      setForm((f) => ({
        ...f,
        callId: c.id,
        title: f.title || c.title,
        fundingSource: c.fundingSource,
        donorRef: c.donorRef || "",
        currency: c.currency || "USD",
        amountRequested: c.amountCap || f.amountRequested,
      }));
      setBudgetRows(defaultBudgetRows().map((r) => ({ ...r, currency: c.currency || "USD" })));
      setShowForm(true);
    }).catch(() => {});
  }, [callIdFromUrl, accessToken, user?.role, navigate]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => grants.filter((g) => g.status === s).length;
    const awardedCount = grants.filter(isAwardedItem).length;
    const totalAwarded = grants.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
    return [
      { label: "Total", value: grants.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted" },
      { label: "Awarded", value: awardedCount, filterKey: "awarded", accent: "#1d4ed8", sub: "Grants with funding" },
      { label: "Awarded $", value: `$${totalAwarded.toLocaleString()}`, accent: "#38bdf8", sub: "Total awarded amount" },
      { label: "Active", value: by("active"), filterKey: "active", accent: "#6366f1" },
    ];
  }, [grants]);

  const filteredGrants = useMemo(() => {
    let list = filterByStatKey(grants, statusFilter);
    if (donorFilter) list = list.filter((g) => g.donorRef && g.donorRef.trim());
    return list;
  }, [grants, statusFilter, donorFilter]);

  useEffect(() => {
    if (loading) return;
  }, [statusFilter, filteredGrants.length, grants.length, loading]);

  return (
    <div>
      <PageHeader
        title="Grants & Funding"
        subtitle="Apply via Funding Calls — budget and optional project link on call applications only."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <Link className="btn primary" to="/funding-calls">
                Apply via Funding Calls
              </Link>
            ) : null}
            {isDirector ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={donorFilter} onChange={(e) => setDonorFilter(e.target.checked)} />
                Donor-funded only
              </label>
            ) : null}
          </>
        }
      />
      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Filtered to one project —{" "}
          <Link to="/grants">show all grants</Link>
        </p>
      ) : null}
      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filteredGrants.length})
        </p>
      ) : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canCreate && !callIdFromUrl && !showForm ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Grant applications are only created from an open <Link to="/funding-calls">Funding Call</Link>.
        </p>
      ) : null}

      {canCreate && showForm && (linkedCall || form.callId) ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Apply to funding call</div>
          {linkedCall ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Call: <strong>{linkedCall.title}</strong> — budget required; project link optional.
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="row">
              <div className="field">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="field">
                <label>Funding source</label>
                <input value={form.fundingSource} disabled />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 2 }}>
                <label>Research project (optional — funding call only)</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                >
                  <option value="">— No project (voluntary) —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <GrantBudgetLines
              budgetRows={budgetRows}
              setBudgetRows={setBudgetRows}
              currency={form.currency || "USD"}
            />
            <div className="row">
              <div className="field">
                <label>Donor reference (external donor)</label>
                <input
                  value={form.donorRef}
                  onChange={(e) => setForm((f) => ({ ...f, donorRef: e.target.value }))}
                  placeholder="e.g. UNESCO-12345"
                />
              </div>
              <div className="field">
                <label>Total requested (from budget lines)</label>
                <input type="number" value={budgetRowsTotal(budgetRows)} readOnly />
              </div>
              <div className="field">
                <label>Currency</label>
                <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  if (!form.callId) {
                    setError("Funding call is required");
                    return;
                  }
                  const lines = budgetRows
                    .filter((r) => r.category || r.description || Number(r.amount) > 0)
                    .map((r) => ({
                      category: r.category,
                      description: r.description,
                      amount: Number(r.amount) || 0,
                      currency: r.currency || form.currency || "USD",
                    }));
                  const payload = {
                    ...form,
                    projectId: form.projectId || undefined,
                    amountRequested: budgetRowsTotal(budgetRows),
                    budgetBreakdown: lines,
                  };
                  if (!payload.title?.trim()) {
                    setError("Title is required");
                    return;
                  }
                  await grantApi.createGrant(accessToken, payload);
                  setForm({
                    title: "",
                    fundingSource: "",
                    donorRef: "",
                    amountRequested: 0,
                    currency: "USD",
                    projectId: "",
                    callId: "",
                  });
                  setBudgetRows(defaultBudgetRows());
                  setLinkedCall(null);
                  setShowForm(false);
                  await reload();
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to create grant");
                }
              }}
            >
              Create draft application
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Grants</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filteredGrants.map((g) => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{g.title}</div>
                    <GrantStatusBadge status={g.status} />
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {g.fundingSource}
                    {g.donorRef ? ` • Donor ref: ${g.donorRef}` : ""}
                  </div>
                  {g.project?.title ? (
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      <span className="muted">Linked project: </span>
                      <Link to={`/projects/${g.project.id}`} style={{ fontWeight: 700 }}>
                        {g.project.title}
                      </Link>
                    </div>
                  ) : g.callId ? (
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                      No project linked (optional)
                    </div>
                  ) : null}
                  {g.fundingCall?.title ? (
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Funding call: {g.fundingCall.title}
                    </div>
                  ) : null}
                  {g.proposal?.title ? (
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                      Proposal: {g.proposal.title} ({g.proposal.status})
                    </div>
                  ) : null}
                  <GrantAmounts grant={g} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {canViewAll || canCreate ? (
                    <Link
                      className={(isDirector || isLeadership) && g.status === "submitted" ? "btn primary" : "btn"}
                      to={`/grants/${g.id}`}
                      title="View full grant details before deciding"
                    >
                      View details
                    </Link>
                  ) : null}
                  {canCreate && g.status === "draft" && g.callId ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          setError("");
                          await grantApi.submitGrant(accessToken, g.id);
                          await reload();
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to submit");
                        }
                      }}
                    >
                      Submit
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {filteredGrants.length === 0 ? (
            <div className="muted">{grants.length === 0 ? "No grants yet." : "No grants match this filter."}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
