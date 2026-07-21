import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import { PageHeader } from "../components/PageHeader";

function formatMoney(amount, currency = "USD") {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || "USD"} ${n.toLocaleString()}`;
  }
}

export function FinanceGrantApprovalsPage() {
  const { accessToken, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await grantApi.listGrants(accessToken);
    const pending = (res.grants || []).filter((g) => g.status === "pending_finance");
    setGrants(pending);
  }, [accessToken, user?.role]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  async function approve(id) {
    if (
      !window.confirm(
        "Authorize this award budget?\n\nThis only ALLOCATES the amount (creates a budget).\nIt does NOT pay out money. Payments are done later under Finance & Budgets."
      )
    ) {
      return;
    }
    const comment = window.prompt("Finance comment (optional):") || "";
    try {
      setBusyId(id);
      setError("");
      setMessage("");
      const res = await grantApi.financeDecision(accessToken, id, { decision: "approve", comment });
      const allocated = res?.budget?.totalAllocated;
      const paid = res?.budget?.totalDisbursed ?? 0;
      setMessage(
        res?.message ||
          `Budget authorized — allocated${allocated != null ? ` (${allocated})` : ""}. Paid so far: ${paid}. Not a disbursement.`
      );
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Finance approval failed");
    } finally {
      setBusyId("");
    }
  }

  async function reject(id) {
    const comment = window.prompt("Rejection reason:")?.trim();
    if (!comment) return;
    if (!window.confirm("Reject this funding award?")) return;
    try {
      setBusyId(id);
      setError("");
      await grantApi.financeDecision(accessToken, id, { decision: "reject", comment });
      setMessage("Funding award rejected.");
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Reject failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Grant funding approval"
        subtitle="Authorize the award budget (allocation only). This is not a payment — money is paid later from Budgets."
        stats={[
          { label: "Awaiting authorization", value: grants.length, filterKey: "all", accent: "#fcd34d" },
        ]}
        actions={
          <>
            <Link className="btn" to="/grants?filter=pending_finance">
              All grants (pending finance)
            </Link>
            <Link className="btn" to="/budgets">
              Finance &amp; Budgets
            </Link>
          </>
        }
      />

      {message ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(45,212,191,0.4)" }}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12, borderColor: "rgba(251,191,36,0.45)" }}>
        <div style={{ fontWeight: 800 }}>Authorize ≠ pay</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          1) Funding Call apply → 2) Director accepts → 3) <strong>You authorize the budget here</strong> (amount is
          allocated, Paid = 0) → 4) Later, pay line items / payments under <strong>Finance &amp; Budgets</strong>.
        </p>
      </div>

      {loading ? <p className="muted" style={{ marginTop: 12 }}>Loading…</p> : null}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {grants.map((g) => (
          <article key={g.id} className="card">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{g.title}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {g.fundingSource}
                  {g.fundingCall?.title ? ` · Call: ${g.fundingCall.title}` : ""}
                </div>
                <div style={{ marginTop: 10, fontWeight: 800, color: "#fcd34d" }}>
                  Amount to allocate: {formatMoney(g.amountAwarded || g.amountRequested, g.currency)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Not paid yet — authorization only
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <Link className="btn" to={`/grants/${g.id}`}>
                  Review details
                </Link>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busyId === g.id}
                  onClick={() => approve(g.id)}
                >
                  {busyId === g.id ? "Working…" : "Authorize budget"}
                </button>
                <button type="button" className="btn" disabled={busyId === g.id} onClick={() => reject(g.id)}>
                  Reject
                </button>
              </div>
            </div>
          </article>
        ))}

        {!loading && grants.length === 0 ? (
          <div className="card muted">
            No funding awards waiting for finance approval. When the Director accepts a funding-call application, it
            will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}
