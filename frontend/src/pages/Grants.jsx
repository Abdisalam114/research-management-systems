import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import { PageHeader } from "../components/PageHeader";
import { GrantAwardModal } from "../components/GrantAwardModal";
import { filterByStatKey, isAwardedItem, statFilterLabel } from "../utils/pageHeaderFilters";

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", fundingSource: "", donorRef: "", amountRequested: 0, currency: "USD" });
  const [donorFilter, setDonorFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const [awardModalGrant, setAwardModalGrant] = useState(null);
  const [awardBusy, setAwardBusy] = useState(false);

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";

  const load = useCallback(async () => {
    const res = await grantApi.listGrants(accessToken);
    const list = res.grants || [];
    setGrants(list);
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
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => grants.filter((g) => g.status === s).length;
    const awardedCount = grants.filter(isAwardedItem).length;
    const totalAwarded = grants.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
    return [
      { label: "Total", value: grants.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted" },
      { label: "Awarded", value: awardedCount, filterKey: "awarded", accent: "#1d4ed8" },
      { label: "Active", value: by("active"), filterKey: "active", accent: "#6366f1" },
      { label: "Awarded $", value: totalAwarded.toLocaleString(), filterKey: "awarded", accent: "#38bdf8" },
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

  async function handleAwardConfirm(amountAwarded) {
    if (!awardModalGrant) return;
    logGrantDebug(
      "Grants.jsx:awardConfirm",
      "approve grant",
      { grantId: awardModalGrant.id, amountAwarded },
      "C"
    );
    try {
      setAwardBusy(true);
      setError("");
      await grantApi.directorDecision(accessToken, awardModalGrant.id, {
        decision: "approved",
        amountAwarded,
      });
      setAwardModalGrant(null);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to approve");
    } finally {
      setAwardBusy(false);
    }
  }

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
                  await grantApi.createGrant(accessToken, form);
                  setForm({ title: "", fundingSource: "", donorRef: "", amountRequested: 0, currency: "USD" });
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{g.title}</div>
                  <div className="muted">
                    {g.fundingSource} • {g.status} • {g.amountRequested} {g.currency}
                    {Number(g.amountAwarded || 0) > 0 ? ` • awarded: ${g.amountAwarded} ${g.currency}` : ""}
                    {g.donorRef ? ` • donor: ${g.donorRef}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                  {isDirector && g.status === "submitted" ? (
                    <>
                      <button type="button" className="btn primary" onClick={() => setAwardModalGrant(g)}>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          try {
                            setError("");
                            await grantApi.directorDecision(accessToken, g.id, { decision: "rejected" });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to reject");
                          }
                        }}
                      >
                        Reject
                      </button>
                    </>
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

      <GrantAwardModal
        open={Boolean(awardModalGrant)}
        grant={awardModalGrant}
        busy={awardBusy}
        onClose={() => {
          if (!awardBusy) setAwardModalGrant(null);
        }}
        onConfirm={handleAwardConfirm}
      />
    </div>
  );
}
