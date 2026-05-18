import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";

export function GrantsPage() {
  const { accessToken, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState({ title: "", fundingSource: "", amountRequested: 0, currency: "USD" });

  const canCreate = user?.role === "researcher";
  const isDirector = user?.role === "research_director";

  const load = useCallback(async () => {
    const res = await grantApi.listGrants(accessToken);
    setGrants(res.grants || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Grants & Funding</h2>
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canCreate ? (
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
                  setForm({ title: "", fundingSource: "", amountRequested: 0, currency: "USD" });
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
          {grants.map((g) => (
            <div key={g.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{g.title}</div>
                  <div className="muted">
                    {g.fundingSource} • {g.status} • {g.amountRequested} {g.currency}
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

