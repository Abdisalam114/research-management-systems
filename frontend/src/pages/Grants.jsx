import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { filterByStatKey, isAwardedItem, statFilterLabel } from "../utils/pageHeaderFilters";

const GRANT_STATUS_STYLES = {
  draft: { bg: "rgba(148,163,184,0.2)", color: "#cbd5e1", label: "Draft" },
  submitted: { bg: "rgba(56,189,248,0.2)", color: "#7dd3fc", label: "Submitted" },
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

function logGrantDebug(location, message, data, hypothesisId) {
  // #region agent log
  fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
    body: JSON.stringify({
      sessionId: "6113cc",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function GrantsPage() {
  const { accessToken, user } = useAuth();
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
  });
  const [donorFilter, setDonorFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const canViewAll = ["research_director", "finance_officer", "faculty_coordinator"].includes(user?.role);

  const load = useCallback(async () => {
    const isResearcher = user?.role === "researcher";
    const [res, projRes] = await Promise.all([
      grantApi.listGrants(accessToken),
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
    const byStatus = list.reduce((acc, g) => {
      acc[g.status] = (acc[g.status] || 0) + 1;
      return acc;
    }, {});
    const totalAwarded = list.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
    logGrantDebug(
      "Grants.jsx:load",
      "grants loaded",
      {
        count: list.length,
        byStatus,
        totalAwarded,
        awardedCount: list.filter(isAwardedItem).length,
        approvedFilterCount: list.filter((g) => g.status === "approved").length,
        activeCount: list.filter((g) => g.status === "active").length,
      },
      "A,B,E"
    );
  }, [accessToken, user?.role]);

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
    logGrantDebug(
      "Grants.jsx:filter",
      "filter applied",
      { statusFilter, filteredCount: filteredGrants.length, totalCount: grants.length },
      "A,B"
    );
  }, [statusFilter, filteredGrants.length, grants.length, loading]);

  return (
    <div>
      <PageHeader
        title="Grants & Funding"
        subtitle="Track grant submissions, donor funding, and director approval."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          <>
            {canCreate ? (
              <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close form" : "+ New grant"}
              </button>
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

      {canCreate && showForm ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>New Grant</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="row">
              <div className="field">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="field">
                <label>Funding source</label>
                <input
                  value={form.fundingSource}
                  onChange={(e) => setForm((f) => ({ ...f, fundingSource: e.target.value }))}
                />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 2 }}>
                <label>Research project (required)</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                >
                  <option value="">— Select your project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.status})
                    </option>
                  ))}
                </select>
                {projects.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    No projects yet. Approve a proposal first to create a research project.
                  </p>
                ) : null}
              </div>
            </div>
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
                <label>Amount requested</label>
                <input
                  type="number"
                  value={form.amountRequested}
                  onChange={(e) => setForm((f) => ({ ...f, amountRequested: Number(e.target.value) }))}
                />
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
                  if (!form.projectId) {
                    setError("Please select a research project for this grant");
                    return;
                  }
                  await grantApi.createGrant(accessToken, form);
                  setForm({
                    title: "",
                    fundingSource: "",
                    donorRef: "",
                    amountRequested: 0,
                    currency: "USD",
                    projectId: projects.length === 1 ? projects[0].id : "",
                  });
                  setShowForm(false);
                  await reload();
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to create grant");
                }
              }}
            >
              Create
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
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#fbbf24" }}>
                      No linked research project
                    </div>
                  )}
                  <GrantAmounts grant={g} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {canViewAll || canCreate ? (
                    <Link
                      className={isDirector && g.status === "submitted" ? "btn primary" : "btn"}
                      to={`/grants/${g.id}`}
                      title="View full grant details before deciding"
                    >
                      View details
                    </Link>
                  ) : null}
                  {canCreate && g.status === "draft" ? (
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
