import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as budgetApi from "../services/budgetApi";
import * as paymentApi from "../services/paymentApi";
import * as procurementApi from "../services/procurementApi";
import * as analyticsApi from "../services/analyticsApi";
import { PageHeader } from "../components/PageHeader";

const PAYMENT_CATEGORIES = [
  { value: "research_assistant", label: "Research assistant" },
  { value: "equipment", label: "Equipment" },
  { value: "travel", label: "Travel" },
  { value: "publication_fee", label: "Publication fee" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const STATUS_BADGE = {
  requested: "#38bdf8",
  director_approved: "#0ea5e9",
  paid: "#1d4ed8",
  rejected: "#1e3a8a",
};

function Badge({ status }) {
  return (
    <span
      style={{
        background: STATUS_BADGE[status] || "#64748b",
        color: "#fff",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      {String(status || "").replace(/_/g, " ")}
    </span>
  );
}

function formatMoney(n, currency = "USD") {
  const v = Number(n || 0);
  return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function BudgetsPage() {
  const { accessToken, user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pos, setPOs] = useState([]);
  const [financeReport, setFinanceReport] = useState(null);
  const [newBudget, setNewBudget] = useState({ grantId: "", projectId: "", totalAllocated: 0, currency: "USD" });
  const [showTopPayment, setShowTopPayment] = useState(false);
  const [showTopPO, setShowTopPO] = useState(false);

  const isResearcher = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const isFinance = user?.role === "finance_officer";
  const canSeeFinanceReport = isDirector || isFinance;

  const load = useCallback(async () => {
    const [b, p, po, fr] = await Promise.all([
      budgetApi.listBudgets(accessToken),
      paymentApi.listPayments(accessToken).catch(() => ({ payments: [] })),
      procurementApi.listPurchaseOrders(accessToken).catch(() => ({ purchaseOrders: [] })),
      canSeeFinanceReport
        ? analyticsApi.financeReport(accessToken).catch(() => null)
        : Promise.resolve(null),
    ]);
    setBudgets(b.budgets || []);
    setPayments(p.payments || []);
    setPOs(po.purchaseOrders || []);
    setFinanceReport(fr);
  }, [accessToken, canSeeFinanceReport]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const paymentsByBudget = useMemo(() => {
    const m = {};
    payments.forEach((p) => {
      const k = String(p.budgetId || "");
      m[k] = m[k] || [];
      m[k].push(p);
    });
    return m;
  }, [payments]);

  const posByBudget = useMemo(() => {
    const m = {};
    pos.forEach((p) => {
      const k = String(p.budgetId || "");
      m[k] = m[k] || [];
      m[k].push(p);
    });
    return m;
  }, [pos]);

  const totals = useMemo(() => {
    const allocated = budgets.reduce((acc, b) => acc + Number(b.totalAllocated || 0), 0);
    const disbursedPay = payments.filter((p) => p.status === "paid").reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const disbursedPO = pos.filter((p) => p.status === "paid").reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
    const pendingPay = payments.filter((p) => ["requested", "director_approved"].includes(p.status)).length;
    const pendingPO = pos.filter((p) => ["requested", "director_approved"].includes(p.status)).length;
    const currency = budgets[0]?.currency || "USD";
    const disbursed = disbursedPay + disbursedPO;
    return {
      allocated,
      disbursed,
      disbursedPayments: disbursedPay,
      disbursedPOs: disbursedPO,
      pending: pendingPay + pendingPO,
      pendingPayments: pendingPay,
      pendingPOs: pendingPO,
      utilizationPercent: allocated > 0 ? Math.min(100, Math.round((disbursed / allocated) * 100)) : 0,
      currency,
    };
  }, [budgets, payments, pos]);

  const methodBreakdown = useMemo(() => {
    const m = {};
    [...payments, ...pos]
      .filter((x) => x.status === "paid" && x.paymentMethod)
      .forEach((x) => {
        const k = x.paymentMethod;
        const amt = Number(x.amount ?? x.totalAmount ?? 0);
        m[k] = (m[k] || 0) + amt;
      });
    return m;
  }, [payments, pos]);

  const directorQueuePayments = payments.filter((p) => p.status === "requested");
  const directorQueuePOs = pos.filter((p) => p.status === "requested");
  const financeQueuePayments = payments.filter((p) => p.status === "director_approved");
  const financeQueuePOs = pos.filter((p) => p.status === "director_approved");

  async function decideDirectorPayment(id, decision) {
    let rejectedReason;
    if (decision === "reject") rejectedReason = window.prompt("Reason for rejection?") || "Rejected";
    try {
      await paymentApi.directorDecision(accessToken, id, { decision, rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record decision");
    }
  }

  async function decideDirectorPO(id, decision) {
    let rejectedReason;
    if (decision === "reject") rejectedReason = window.prompt("Reason for rejection?") || "Rejected";
    try {
      await procurementApi.directorDecision(accessToken, id, { decision, rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record decision");
    }
  }

  async function payPayment(p) {
    const method = window.prompt(
      `Payment method? One of: ${PAYMENT_METHODS.map((m) => m.value).join(", ")}`,
      "bank_transfer"
    );
    if (!method) return;
    const details = window.prompt("Reference / account / transaction details (optional):") || "";
    try {
      await paymentApi.financePay(accessToken, p.id, {
        paymentMethod: method,
        paymentMethodDetails: details,
        referenceNumber: details,
      });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to pay");
    }
  }

  async function payPO(p) {
    const method = window.prompt(
      `Payment method? One of: ${PAYMENT_METHODS.map((m) => m.value).join(", ")}`,
      "bank_transfer"
    );
    if (!method) return;
    const details = window.prompt("Reference / account / transaction details (optional):") || "";
    const poNumber = window.prompt("Assign PO number (optional):") || "";
    try {
      await procurementApi.financePay(accessToken, p.id, {
        paymentMethod: method,
        paymentMethodDetails: details,
        poNumber,
      });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to pay PO");
    }
  }

  async function rejectFinancePayment(id) {
    const reason = window.prompt("Reason for finance rejection?") || "Rejected";
    try {
      await paymentApi.financeReject(accessToken, id, { rejectedReason: reason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject");
    }
  }

  async function rejectFinancePO(id) {
    const reason = window.prompt("Reason for finance rejection?") || "Rejected";
    try {
      await procurementApi.financeReject(accessToken, id, { rejectedReason: reason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject");
    }
  }

  const headerStats = [
    {
      label: isResearcher ? "My total budget" : "Institutional total budget",
      value: formatMoney(totals.allocated, totals.currency),
      sub: isResearcher
        ? `${budgets.length} of your budget${budgets.length === 1 ? "" : "s"}`
        : "Across the whole university",
      accent: "#0ea5e9",
    },
    {
      label: "Disbursed (paid)",
      value: formatMoney(totals.disbursed, totals.currency),
      sub: `Payments ${formatMoney(totals.disbursedPayments, totals.currency)} • POs ${formatMoney(totals.disbursedPOs, totals.currency)}`,
      accent: "#1d4ed8",
    },
    {
      label: "Utilization",
      value: `${totals.utilizationPercent}%`,
      sub: "Disbursed ÷ allocated",
      accent: "#7dd3fc",
    },
    {
      label: "Pending approval",
      value: totals.pending,
      sub: `${totals.pendingPayments} payments • ${totals.pendingPOs} POs`,
      accent: "#7dd3fc",
    },
    {
      label: "Total budgets",
      value: `${budgets.length} • ${formatMoney(totals.disbursed, totals.currency)} spent`,
      sub: isResearcher ? "Your budgets & disbursed total" : "All budgets & disbursed total",
      accent: "#38bdf8",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Finance & Budget"
        subtitle="Researcher requests → Director approves → Finance pays (with payment method)."
        stats={headerStats}
        actions={
          isResearcher ? (
            <>
              <button className="btn primary" onClick={() => { setShowTopPayment((v) => !v); setShowTopPO(false); }}>
                💳 {showTopPayment ? "Cancel" : "Request payment"}
              </button>
              <button className="btn primary" onClick={() => { setShowTopPO((v) => !v); setShowTopPayment(false); }}>
                🛒 {showTopPO ? "Cancel" : "Request purchase order"}
              </button>
            </>
          ) : null
        }
      />

      {loading ? <p className="muted">Loading budgets…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 8 }}>{error}</div> : null}

      {isResearcher && showTopPayment ? (
        <TopPaymentForm
          budgets={budgets}
          accessToken={accessToken}
          onClose={() => setShowTopPayment(false)}
          onChange={reload}
          setError={setError}
        />
      ) : null}
      {isResearcher && showTopPO ? (
        <TopPOForm
          budgets={budgets}
          accessToken={accessToken}
          onClose={() => setShowTopPO(false)}
          onChange={reload}
          setError={setError}
        />
      ) : null}

      {isDirector && (directorQueuePayments.length || directorQueuePOs.length) ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Director approval queue</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {directorQueuePayments.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>💳 Payment: {p.payee}</div>
                  <div className="muted">
                    {p.category.replace(/_/g, " ")} • {p.currency} {p.amount} • {p.purpose}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => decideDirectorPayment(p.id, "approve")}>Approve</button>
                  <button className="btn" onClick={() => decideDirectorPayment(p.id, "reject")}>Reject</button>
                </div>
              </div>
            ))}
            {directorQueuePOs.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>🛒 PO: {p.vendorName}</div>
                  <div className="muted">{p.currency} {p.totalAmount} • {p.items?.length || 0} item(s)</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => decideDirectorPO(p.id, "approve")}>Approve</button>
                  <button className="btn" onClick={() => decideDirectorPO(p.id, "reject")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isFinance && (financeQueuePayments.length || financeQueuePOs.length) ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Finance disbursement queue (director-approved)</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {financeQueuePayments.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>💳 Payment: {p.payee}</div>
                  <div className="muted">
                    {p.category.replace(/_/g, " ")} • {p.currency} {p.amount} • {p.purpose}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => payPayment(p)}>Pay (record method)</button>
                  <button className="btn" onClick={() => rejectFinancePayment(p.id)}>Reject</button>
                </div>
              </div>
            ))}
            {financeQueuePOs.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>🛒 PO: {p.vendorName}</div>
                  <div className="muted">{p.currency} {p.totalAmount} • {p.items?.length || 0} item(s)</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn primary" onClick={() => payPO(p)}>Pay (record method)</button>
                  <button className="btn" onClick={() => rejectFinancePO(p.id)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isResearcher ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Create budget (link to Grant or Project)</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="row">
              <div className="field">
                <label>Grant ID (optional)</label>
                <input value={newBudget.grantId} onChange={(e) => setNewBudget((s) => ({ ...s, grantId: e.target.value }))} />
              </div>
              <div className="field">
                <label>Project ID (optional)</label>
                <input value={newBudget.projectId} onChange={(e) => setNewBudget((s) => ({ ...s, projectId: e.target.value }))} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Total allocated</label>
                <input
                  type="number"
                  value={newBudget.totalAllocated}
                  onChange={(e) => setNewBudget((s) => ({ ...s, totalAllocated: Number(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label>Currency</label>
                <input value={newBudget.currency} onChange={(e) => setNewBudget((s) => ({ ...s, currency: e.target.value }))} />
              </div>
            </div>
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  await budgetApi.createBudget(accessToken, {
                    ...newBudget,
                    grantId: newBudget.grantId || null,
                    projectId: newBudget.projectId || null,
                  });
                  setNewBudget({ grantId: "", projectId: "", totalAllocated: 0, currency: "USD" });
                  await reload();
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to create budget");
                }
              }}
            >
              Create budget
            </button>
          </div>
        </div>
      ) : null}

      {canSeeFinanceReport && financeReport ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>📊 Financial reporting (institutional)</div>
          <div className="overviewGrid" style={{ marginTop: 10 }}>
            <div className="overviewTile">
              <div className="label">Budgets</div>
              <div className="value">{financeReport.summary.budgets}</div>
            </div>
            <div className="overviewTile">
              <div className="label">Allocated</div>
              <div className="value">${Number(financeReport.summary.totalAllocated || 0).toLocaleString()}</div>
            </div>
            <div className="overviewTile">
              <div className="label">Paid</div>
              <div className="value">${Number(financeReport.summary.totalPaid || 0).toLocaleString()}</div>
            </div>
            <div className="overviewTile">
              <div className="label">Utilization</div>
              <div className="value">{financeReport.summary.utilizationPercent}%</div>
            </div>
          </div>

          {Object.keys(methodBreakdown).length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Payments by method</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(methodBreakdown).map(([method, amount]) => (
                  <div
                    key={method}
                    className="card"
                    style={{
                      padding: "8px 14px",
                      background: "rgba(14,165,233,0.08)",
                      borderColor: "rgba(56,189,248,0.25)",
                    }}
                  >
                    <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                      {method.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontWeight: 800, color: "#38bdf8" }}>{formatMoney(amount, totals.currency)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {Array.isArray(financeReport.grantSummary) && financeReport.grantSummary.length ? (
            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Grant financial summary</div>
              <table className="dashTable">
                <thead>
                  <tr>
                    <th>Grant</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Awarded</th>
                  </tr>
                </thead>
                <tbody>
                  {financeReport.grantSummary.map((g) => (
                    <tr key={g.title + g.status}>
                      <td>{g.title}</td>
                      <td>{g.fundingSource || "—"}</td>
                      <td>{g.status}</td>
                      <td style={{ textAlign: "right" }}>${Number(g.amountAwarded || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Budgets & their requests</div>
        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              payments={paymentsByBudget[String(b.id)] || []}
              pos={posByBudget[String(b.id)] || []}
            />
          ))}
          {budgets.length === 0 ? <div className="muted">No budgets yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

function TopPaymentForm({ budgets, accessToken, onClose, onChange, setError }) {
  const [budgetId, setBudgetId] = useState(budgets[0]?.id || "");
  const [form, setForm] = useState({ category: "equipment", payee: "", purpose: "", amount: 0, notes: "" });
  const budget = budgets.find((b) => b.id === budgetId);

  async function submit() {
    if (!budgetId) {
      setError("Please choose a budget");
      return;
    }
    try {
      await paymentApi.createPayment(accessToken, {
        budgetId,
        category: form.category,
        payee: form.payee,
        purpose: form.purpose,
        amount: Number(form.amount || 0),
        currency: budget?.currency || "USD",
        notes: form.notes,
      });
      onClose();
      await onChange();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create payment request");
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>💳 New payment request</div>
      <div className="row">
        <div className="field">
          <label>Budget</label>
          <select value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
            <option value="">— select —</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id.slice(-6)} • {b.currency} {Number(b.totalAllocated || 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>
            {PAYMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Amount ({budget?.currency || "USD"})</label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Payee</label>
          <input value={form.payee} onChange={(e) => setForm((s) => ({ ...s, payee: e.target.value }))} />
        </div>
        <div className="field">
          <label>Purpose</label>
          <input value={form.purpose} onChange={(e) => setForm((s) => ({ ...s, purpose: e.target.value }))} />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={submit}>Submit for director approval</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function TopPOForm({ budgets, accessToken, onClose, onChange, setError }) {
  const [budgetId, setBudgetId] = useState(budgets[0]?.id || "");
  const [form, setForm] = useState({ vendorName: "", vendorContact: "", notes: "", items: [{ description: "", quantity: 1, unitPrice: 0 }] });
  const budget = budgets.find((b) => b.id === budgetId);

  function updateItem(idx, field, value) {
    setForm((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  }

  async function submit() {
    if (!budgetId) {
      setError("Please choose a budget");
      return;
    }
    const items = form.items
      .filter((it) => it.description)
      .map((it) => ({ description: it.description, quantity: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || 0) }));
    if (items.length === 0) {
      setError("At least one PO item is required");
      return;
    }
    try {
      await procurementApi.createPurchaseOrder(accessToken, {
        budgetId,
        vendorName: form.vendorName,
        vendorContact: form.vendorContact,
        currency: budget?.currency || "USD",
        notes: form.notes,
        items,
      });
      onClose();
      await onChange();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create PO");
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>🛒 New purchase order</div>
      <div className="row">
        <div className="field">
          <label>Budget</label>
          <select value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
            <option value="">— select —</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id.slice(-6)} • {b.currency} {Number(b.totalAllocated || 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Vendor name</label>
          <input value={form.vendorName} onChange={(e) => setForm((s) => ({ ...s, vendorName: e.target.value }))} />
        </div>
        <div className="field">
          <label>Vendor contact</label>
          <input value={form.vendorContact} onChange={(e) => setForm((s) => ({ ...s, vendorContact: e.target.value }))} />
        </div>
      </div>
      <div style={{ fontWeight: 700, marginTop: 8 }}>Items</div>
      {form.items.map((it, idx) => (
        <div key={idx} className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Description</label>
            <input value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
          </div>
          <div className="field">
            <label>Qty</label>
            <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
          </div>
          <div className="field">
            <label>Unit price</label>
            <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="btn" onClick={() => setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))}>Remove</button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn" onClick={() => setForm((s) => ({ ...s, items: [...s.items, { description: "", quantity: 1, unitPrice: 0 }] }))}>
          + Add item
        </button>
      </div>
      <div className="field">
        <label>Notes</label>
        <input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={submit}>Submit PO for director approval</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function BudgetCard({ budget, payments, pos }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>Budget {budget.id?.slice(-6)}</div>
          <div className="muted">
            {budget.currency} {Number(budget.totalAllocated || 0).toLocaleString()} allocated • grant {budget.grantId || "—"} • project {budget.projectId || "—"}
          </div>
        </div>
      </div>

      {payments.length ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700 }}>💳 Payment requests ({payments.length})</div>
          {payments.map((p) => (
            <div key={p.id} className="card" style={{ marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{p.payee}</strong> • {p.purpose}
                  <div className="muted">
                    {p.category.replace(/_/g, " ")} • {p.currency} {p.amount}{" "}
                    {p.paymentMethod ? `• method: ${p.paymentMethod}` : ""}
                    {p.paymentMethodDetails ? ` (${p.paymentMethodDetails})` : ""}
                  </div>
                  {p.rejectedReason ? <div className="muted" style={{ color: "#ef4444" }}>{p.rejectedReason}</div> : null}
                </div>
                <Badge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {pos.length ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700 }}>🛒 Purchase orders ({pos.length})</div>
          {pos.map((p) => (
            <div key={p.id} className="card" style={{ marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{p.vendorName}</strong> {p.poNumber ? `• PO#${p.poNumber}` : ""}
                  <div className="muted">
                    {p.currency} {p.totalAmount} • {p.items?.length || 0} items{" "}
                    {p.paymentMethod ? `• method: ${p.paymentMethod}` : ""}
                    {p.paymentMethodDetails ? ` (${p.paymentMethodDetails})` : ""}
                  </div>
                  {p.rejectedReason ? <div className="muted" style={{ color: "#ef4444" }}>{p.rejectedReason}</div> : null}
                </div>
                <Badge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
