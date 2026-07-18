import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as paymentApi from "../services/paymentApi";
import { PageHeader } from "../components/PageHeader";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS = {
  research_assistant: "Research assistant",
  equipment: "Equipment",
  travel: "Travel",
  publication_fee: "Publication fee",
  other: "Other",
};

function formatMoney(amount, currency = "USD") {
  const v = Number(amount || 0);
  return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusLabel(status) {
  const labels = {
    requested: "Requested — awaiting director approval",
    director_approved: "Director approved — awaiting finance disbursement",
    paid: "Paid",
    rejected: "Rejected",
  };
  return labels[status] || String(status || "").replace(/_/g, " ");
}

export function PaymentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [payment, setPayment] = useState(null);
  const [decideBusy, setDecideBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payForm, setPayForm] = useState({ paymentMethod: "bank_transfer", paymentMethodDetails: "", referenceNumber: "" });

  const isDirector = user?.role === "research_director";
  const isFinance = user?.role === "finance_officer";
  const canDirectorDecide = isDirector && payment?.status === "requested";
  const canFinancePay = isFinance && payment?.status === "director_approved";

  const load = useCallback(async () => {
    const res = await paymentApi.getPayment(accessToken, id);
    setPayment(res.payment || null);
  }, [accessToken, id]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, [id]);

  async function handleDirectorDecision(decision) {
    if (!payment) return;
    let rejectedReason;
    if (decision === "reject") {
      rejectedReason = window.prompt("Reason for rejection?") || "Rejected";
      if (!window.confirm("Reject this payment request?")) return;
    } else if (!window.confirm("Approve this payment request?")) {
      return;
    }
    try {
      setDecideBusy(true);
      setError("");
      await paymentApi.directorDecision(accessToken, payment.id, { decision, rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record decision");
    } finally {
      setDecideBusy(false);
    }
  }

  async function handleFinancePay() {
    if (!payment || payBusy) return;
    if (!payForm.paymentMethod) {
      setError("Choose a payment method");
      return;
    }
    if (
      !window.confirm(
        `Record payment of ${formatMoney(payment.amount, payment.currency)}? This amount will be deducted from the budget remaining balance.`
      )
    ) {
      return;
    }
    try {
      setPayBusy(true);
      setError("");
      const res = await paymentApi.financePay(accessToken, payment.id, {
        paymentMethod: payForm.paymentMethod,
        paymentMethodDetails: payForm.paymentMethodDetails,
        referenceNumber: payForm.referenceNumber || payForm.paymentMethodDetails,
      });
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          hypothesisId: "H5",
          location: "PaymentDetails.jsx:financePay",
          message: "FE payment paid response",
          data: {
            paymentId: payment.id,
            amount: payment.amount,
            budgetRemaining: res?.budget?.remainingBalance ?? null,
            budgetDisbursed: res?.budget?.totalDisbursed ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to pay");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleFinanceReject() {
    if (!payment) return;
    const rejectedReason = window.prompt("Reason for finance rejection?") || "Rejected";
    if (!window.confirm("Reject this payment?")) return;
    try {
      setPayBusy(true);
      setError("");
      await paymentApi.financeReject(accessToken, payment.id, { rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject");
    } finally {
      setPayBusy(false);
    }
  }

  const requester = payment?.requester;
  const budget = payment?.budget;

  return (
    <div>
      <PageHeader
        title="Payment — Review details"
        subtitle={
          canDirectorDecide
            ? "Review all information below before approving or rejecting."
            : canFinancePay
              ? "Director approved this request. Review details before disbursement."
              : "Full details for this payment request."
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" to="/budgets">
              ← Back to finance
            </Link>
            {canDirectorDecide ? (
              <>
                <button type="button" className="btn primary" onClick={() => handleDirectorDecision("approve")} disabled={decideBusy}>
                  Approve
                </button>
                <button type="button" className="btn" onClick={() => handleDirectorDecision("reject")} disabled={decideBusy}>
                  {decideBusy ? "Processing…" : "Reject"}
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading…</div> : null}
      {!loading && !payment ? <div className="muted" style={{ marginTop: 12 }}>Payment not found.</div> : null}

      {payment ? (
        <>
          {canDirectorDecide ? (
            <div
              className="card"
              style={{
                marginTop: 12,
                borderColor: "rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.08)",
              }}
            >
              <div style={{ fontWeight: 800 }}>Director review</div>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
                This payment is waiting for your decision. Review the requester, budget, payee, and purpose below.
              </p>
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{payment.payee}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Status: <strong>{statusLabel(payment.status)}</strong>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.10)", margin: "14px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Purpose</div>
                <div style={{ fontWeight: 700 }}>{payment.purpose}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Category</div>
                <div style={{ fontWeight: 700 }}>{CATEGORY_LABELS[payment.category] || payment.category}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Amount</div>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{formatMoney(payment.amount, payment.currency)}</div>
              </div>
            </div>

            {payment.notes ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Notes</div>
                <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{payment.notes}</div>
              </div>
            ) : null}

            {payment.rejectedReason ? (
              <div style={{ marginTop: 14, color: "#ef4444" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Rejection reason</div>
                <div>{payment.rejectedReason}</div>
              </div>
            ) : null}

            <div
              className="muted"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 14, fontSize: 12 }}
            >
              <div>Created: {formatDate(payment.createdAt)}</div>
              <div>Director approved: {formatDate(payment.directorApprovedAt)}</div>
              <div>Paid: {formatDate(payment.paidAt)}</div>
              <div>Last updated: {formatDate(payment.updatedAt)}</div>
            </div>

            {payment.status === "paid" ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Disbursement</div>
                <div className="muted">
                  Method: {payment.paymentMethod?.replace(/_/g, " ") || "—"}
                  {payment.paymentMethodDetails ? ` • ${payment.paymentMethodDetails}` : ""}
                  {payment.referenceNumber ? ` • Ref: ${payment.referenceNumber}` : ""}
                </div>
              </div>
            ) : null}
          </div>

          {requester ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Requested by</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Full name</div>
                  <div style={{ fontWeight: 700 }}>{requester.fullName}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Email</div>
                  <div style={{ fontWeight: 700 }}>{requester.email}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Department</div>
                  <div style={{ fontWeight: 700 }}>{requester.department || "—"}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Rank</div>
                  <div style={{ fontWeight: 700 }}>{requester.rank || "—"}</div>
                </div>
              </div>
            </div>
          ) : null}

          {budget ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Linked budget</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Total allocated</div>
                  <div style={{ fontWeight: 700 }}>{formatMoney(budget.totalAllocated, budget.currency)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Paid (disbursed)</div>
                  <div style={{ fontWeight: 700 }}>{formatMoney(budget.totalDisbursed || 0, budget.currency)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Remaining</div>
                  <div style={{ fontWeight: 900, color: "#38bdf8" }}>
                    {formatMoney(
                      budget.remainingBalance != null
                        ? budget.remainingBalance
                        : Math.max(0, Number(budget.totalAllocated || 0) - Number(budget.totalDisbursed || 0)),
                      budget.currency
                    )}
                  </div>
                </div>
                {budget.owner ? (
                  <div>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Budget owner</div>
                    <div style={{ fontWeight: 700 }}>{budget.owner.fullName}</div>
                  </div>
                ) : null}
              </div>
              {budget.financeNotes ? (
                <div style={{ marginTop: 10 }} className="muted">
                  Finance notes: {budget.financeNotes}
                </div>
              ) : null}
            </div>
          ) : null}

          {payment.grant ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Linked grant</div>
              <div style={{ fontWeight: 700 }}>{payment.grant.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {payment.grant.fundingSource} • Awarded {formatMoney(payment.grant.amountAwarded, payment.grant.currency)}
              </div>
              <Link className="btn" to={`/grants/${payment.grant.id}`} style={{ marginTop: 10, display: "inline-block" }}>
                Open grant
              </Link>
            </div>
          ) : null}

          {payment.project ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Linked project</div>
              <div style={{ fontWeight: 700 }}>{payment.project.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>Status: {payment.project.status}</div>
              <Link className="btn" to={`/projects/${payment.project.id}`} style={{ marginTop: 10, display: "inline-block" }}>
                Open project
              </Link>
            </div>
          ) : null}

          {canDirectorDecide ? (
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" onClick={() => handleDirectorDecision("approve")} disabled={decideBusy}>
                Approve payment
              </button>
              <button type="button" className="btn" onClick={() => handleDirectorDecision("reject")} disabled={decideBusy}>
                Reject payment
              </button>
              <button type="button" className="btn" onClick={() => navigate("/budgets")}>
                Back to list
              </button>
            </div>
          ) : null}

          {canFinancePay ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Finance disbursement</div>
              <div className="row">
                <div className="field">
                  <label>Payment method</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm((s) => ({ ...s, paymentMethod: e.target.value }))}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Reference / transaction details</label>
                  <input
                    value={payForm.paymentMethodDetails}
                    onChange={(e) => setPayForm((s) => ({ ...s, paymentMethodDetails: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn primary" onClick={handleFinancePay} disabled={payBusy}>
                  Record payment
                </button>
                <button type="button" className="btn" onClick={handleFinanceReject} disabled={payBusy}>
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
