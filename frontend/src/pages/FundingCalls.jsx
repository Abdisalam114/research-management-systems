import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as fundingCallApi from "../services/fundingCallApi";
import { PageHeader } from "../components/PageHeader";

const EMPTY = {
  title: "",
  description: "",
  fundingSource: "",
  donorRef: "",
  amountCap: "",
  currency: "USD",
  deadline: "",
  eligibilityTier: "all",
  requiredDocuments: "",
};

export function FundingCallsPage() {
  const { accessToken, user } = useAuth();
  const isDirector = user?.role === "research_director";
  const [calls, setCalls] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fundingCallApi.listFundingCalls(accessToken);
    setCalls(res.calls || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, []);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        amountCap: Number(form.amountCap) || 0,
        deadline: form.deadline || null,
      };
      if (editingId) {
        await fundingCallApi.updateFundingCall(accessToken, editingId, payload);
        setMessage("Call updated");
      } else {
        await fundingCallApi.createFundingCall(accessToken, payload);
        setMessage("Call created (draft)");
      }
      setForm(EMPTY);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish(id) {
    setBusy(true);
    try {
      await fundingCallApi.publishFundingCall(accessToken, id);
      setMessage("Call published — researchers notified");
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function closeCall(id) {
    setBusy(true);
    try {
      await fundingCallApi.closeFundingCall(accessToken, id);
      await reload();
    } catch (err) {
      setError(err?.response?.data?.message || "Close failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pageStack">
      <PageHeader title="Funding Calls" subtitle="Published grant opportunities (URGMS Step 1)" />
      {message ? <div className="bannerOk">{message}</div> : null}
      {error ? <div className="bannerErr">{error}</div> : null}

      {isDirector ? (
        <form className="card panel" onSubmit={handleSave}>
          <h3>{editingId ? "Edit draft call" : "Create funding call"}</h3>
          <div className="formGrid">
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Funding source<input required value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })} /></label>
            <label>Amount cap<input type="number" min="0" value={form.amountCap} onChange={(e) => setForm({ ...form, amountCap: e.target.value })} /></label>
            <label>Deadline<input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            <label>Eligibility
              <select value={form.eligibilityTier} onChange={(e) => setForm({ ...form, eligibilityTier: e.target.value })}>
                <option value="all">All</option>
                <option value="ug">Undergraduate</option>
                <option value="pg">Postgraduate</option>
              </select>
            </label>
          </div>
          <label>Description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Required documents<textarea rows={2} value={form.requiredDocuments} onChange={(e) => setForm({ ...form, requiredDocuments: e.target.value })} /></label>
          <button type="submit" disabled={busy}>{editingId ? "Update draft" : "Save draft"}</button>
        </form>
      ) : null}

      {loading ? <p>Loading...</p> : null}
      <div className="cardList">
        {calls.map((c) => (
          <article key={c.id} className="card panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>{c.title}</h3>
                <p className="muted">{c.fundingSource} · {c.currency} {Number(c.amountCap || 0).toLocaleString()}</p>
                {c.deadline ? <p className="muted">Deadline: {new Date(c.deadline).toLocaleDateString()}</p> : null}
                <p>{c.description}</p>
                <span className="badge">{c.status}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {user?.role === "researcher" && c.status === "open" ? (
                  <Link className="btnPrimary" to={`/grants?callId=${c.id}`}>Apply for this call</Link>
                ) : null}
                {isDirector && c.status === "draft" ? (
                  <>
                    <button type="button" onClick={() => { setEditingId(c.id); setForm({ title: c.title, description: c.description || "", fundingSource: c.fundingSource, donorRef: c.donorRef || "", amountCap: c.amountCap || "", currency: c.currency || "USD", deadline: c.deadline ? c.deadline.slice(0, 10) : "", eligibilityTier: c.eligibilityTier || "all", requiredDocuments: c.requiredDocuments || "" }); }}>Edit</button>
                    <button type="button" className="btnPrimary" disabled={busy} onClick={() => publish(c.id)}>Publish</button>
                  </>
                ) : null}
                {isDirector && c.status === "open" ? (
                  <button type="button" disabled={busy} onClick={() => closeCall(c.id)}>Close call</button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {!loading && calls.length === 0 ? <p className="muted">No funding calls yet.</p> : null}
      </div>
    </div>
  );
}
