import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import { PageHeader } from "../components/PageHeader";

export function GrantsPage() {
  const { accessToken, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", fundingSource: "", donorRef: "", amountRequested: 0, currency: "USD" });
  const [donorFilter, setDonorFilter] = useState(false);

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";

  const load = useCallback(async () => {
    const res = await grantApi.listGrants(accessToken);
    setGrants(res.grants || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => grants.filter((g) => g.status === s).length;
    const totalAwarded = grants.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
    return [
      { label: "Total", value: grants.length },
      { label: "Submitted", value: by("submitted") },
      { label: "Approved", value: by("approved"), accent: "#1d4ed8" },
      { label: "Awarded $", value: totalAwarded.toLocaleString(), accent: "#38bdf8" },
    ];
  }, [grants]);

  return (
    <div>
      <PageHeader
        title="Grants & Funding"
        subtitle="Track grant submissions, donor funding, and director approval."
        stats={stats}
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
          {grants
            .filter((g) => !donorFilter || (g.donorRef && g.donorRef.trim()))
            .map((g) => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{g.title}</div>
                  <div className="muted">
                    {g.fundingSource} • {g.status} • {g.amountRequested} {g.currency}
                    {g.donorRef ? ` • donor: ${g.donorRef}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {canCreate && g.status === "draft" ? (
                    <button
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
                      <button
                        className="btn primary"
                        onClick={async () => {
                          const amountAwarded = Number(prompt("Amount awarded?", String(g.amountRequested || 0)));
                          if (!Number.isFinite(amountAwarded)) return;
                          try {
                            setError("");
                            await grantApi.directorDecision(accessToken, g.id, {
                              decision: "approved",
                              amountAwarded,
                            });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to approve");
                          }
                        }}
                      >
                        Approve
                      </button>
                      <button
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
          {grants.length === 0 ? <div className="muted">No grants yet.</div> : null}
        </div>
      </div>
    </div>
  );
}



