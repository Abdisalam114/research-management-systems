import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as budgetApi from "../services/budgetApi";
import * as paymentApi from "../services/paymentApi";
import * as procurementApi from "../services/procurementApi";
import * as analyticsApi from "../services/analyticsApi";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { statFilterLabel } from "../utils/pageHeaderFilters";

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
  procurement_approved: "#0284c7",
  pending: "#38bdf8",
  approved: "#0ea5e9",
  paid: "#1d4ed8",
  rejected: "#1e3a8a",
};

const BUDGET_ITEM_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "procurement", label: "Procurement" },
];

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
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const projectLocked = Boolean(projectIdFromUrl);
  const [budgets, setBudgets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pos, setPOs] = useState([]);
  const [financeReport, setFinanceReport] = useState(null);
  const [projects, setProjects] = useState([]);
  const [linkedProject, setLinkedProject] = useState(null);
  const [newBudget, setNewBudget] = useState({
    grantId: "",
    projectId: projectIdFromUrl || "",
    totalAllocated: 0,
    currency: "USD",
  });
  const [showTopPayment, setShowTopPayment] = useState(false);
  const [showTopPO, setShowTopPO] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const [actionBusy, setActionBusy] = useState("");
  const [payPoTarget, setPayPoTarget] = useState(null);

  const isResearcher = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const isFinance = user?.role === "finance_officer";
  const isProcurement = user?.role === "procurement_officer";
  const canSeeFinanceReport = isDirector || isFinance;

  useEffect(() => {
    if (!projectIdFromUrl) return;
    setNewBudget((s) => ({ ...s, projectId: projectIdFromUrl }));
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!accessToken || !isResearcher) return;
    projectApi
      .listProjects(accessToken)
      .then((res) => setProjects(res.projects || []))
      .catch(() => setProjects([]));
  }, [accessToken, isResearcher]);

  useEffect(() => {
    if (!projectIdFromUrl || !accessToken) {
      setLinkedProject(null);
      return;
    }
    let cancelled = false;
    projectApi
      .getProject(accessToken, projectIdFromUrl)
      .then((res) => {
        if (cancelled) return;
        setLinkedProject(res.project || null);
        // #region agent log
        fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
          body: JSON.stringify({
            sessionId: "f558f7",
            runId: "auto-project-context",
            hypothesisId: "P3",
            location: "Budgets.jsx:autofill",
            message: "budget page locked to project",
            data: { projectId: projectIdFromUrl, title: res.project?.title || null },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      })
      .catch(() => {
        if (!cancelled) setLinkedProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdFromUrl, accessToken]);

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
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "H3",
        location: "Budgets.jsx:load",
        message: "finance budgets page loaded",
        data: {
          role: user?.role,
          budgets: (b.budgets || []).length,
          payments: (p.payments || []).length,
          pos: (po.purchaseOrders || []).length,
          reportPaid: fr?.summary?.totalPaid ?? null,
          itemCount: (b.budgets || []).reduce((n, x) => n + (x.items?.length || 0), 0),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [accessToken, canSeeFinanceReport, user?.role]);

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
    const remaining = budgets.reduce(
      (acc, b) => acc + Number(b.remainingBalance != null ? b.remainingBalance : Math.max(0, Number(b.totalAllocated || 0) - Number(b.totalDisbursed || 0))),
      0
    );
    const disbursedFromBudgets = budgets.reduce((acc, b) => acc + Number(b.totalDisbursed || 0), 0);
    const disbursedPay = payments.filter((p) => p.status === "paid").reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const disbursedPO = pos.filter((p) => p.status === "paid").reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
    const itemPaid = budgets.reduce(
      (acc, b) => acc + (b.items || []).filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.amount || 0), 0),
      0
    );
    const pendingPay = payments.filter((p) => ["requested", "director_approved"].includes(p.status)).length;
    const pendingPO = pos.filter((p) => ["requested", "procurement_approved", "director_approved"].includes(p.status)).length;
    const currency = budgets[0]?.currency || "USD";
    const disbursed = Math.max(disbursedFromBudgets, disbursedPay + disbursedPO + itemPaid);
    return {
      allocated,
      remaining,
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
  const procurementQueuePOs = pos.filter((p) => p.status === "requested");
  const directorQueuePOs = pos.filter((p) => p.status === "procurement_approved" || p.status === "requested");
  const financeQueuePayments = payments.filter((p) => p.status === "director_approved");
  const financeQueuePOs = pos.filter((p) => p.status === "director_approved");

  async function decideProcurementPO(id, decision) {
    if (actionBusy) return;
    let rejectedReason;
    if (decision === "reject") {
      rejectedReason = window.prompt("Reason for rejection?")?.trim();
      if (!rejectedReason) return;
    } else if (!window.confirm("Approve this purchase order for director review?")) {
      return;
    }
    setActionBusy(`po-proc-${id}`);
    setError("");
    try {
      await procurementApi.procurementDecision(accessToken, id, { decision, rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record procurement decision");
    } finally {
      setActionBusy("");
    }
  }

  async function decideDirectorPO(id, decision) {
    if (actionBusy) return;
    let rejectedReason;
    if (decision === "reject") {
      rejectedReason = window.prompt("Reason for rejection?")?.trim();
      if (!rejectedReason) return;
    } else if (!window.confirm("Approve this purchase order for finance payment?")) {
      return;
    }
    setActionBusy(`po-dir-${id}`);
    setError("");
    try {
      await procurementApi.directorDecision(accessToken, id, { decision, rejectedReason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record decision");
    } finally {
      setActionBusy("");
    }
  }

  async function submitPayPO({ paymentMethod, paymentMethodDetails, poNumber }) {
    if (!payPoTarget || actionBusy) return;
    setActionBusy(`po-pay-${payPoTarget.id}`);
    setError("");
    try {
      await procurementApi.financePay(accessToken, payPoTarget.id, {
        paymentMethod,
        paymentMethodDetails,
        poNumber,
      });
      setPayPoTarget(null);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to pay PO");
    } finally {
      setActionBusy("");
    }
  }

  async function rejectFinancePO(id) {
    if (actionBusy) return;
    const reason = window.prompt("Reason for finance rejection?")?.trim();
    if (!reason) return;
    if (!window.confirm("Reject this purchase order?")) return;
    setActionBusy(`po-rej-${id}`);
    setError("");
    try {
      await procurementApi.financeReject(accessToken, id, { rejectedReason: reason });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject");
    } finally {
      setActionBusy("");
    }
  }

  const filteredBudgets = useMemo(() => {
    let list = budgets;
    if (projectIdFromUrl) {
      list = list.filter((b) => String(b.projectId || b.project?.id || "") === String(projectIdFromUrl));
    }
    if (statusFilter === "all") return list;
    if (statusFilter === "pending") {
      return list.filter((b) => {
        const pays = paymentsByBudget[String(b.id)] || [];
        const poList = posByBudget[String(b.id)] || [];
        return (
          pays.some((p) => ["requested", "director_approved"].includes(p.status)) ||
          poList.some((p) => ["requested", "director_approved"].includes(p.status))
        );
      });
    }
    if (statusFilter === "disbursed") {
      return list.filter((b) => {
        const pays = paymentsByBudget[String(b.id)] || [];
        const poList = posByBudget[String(b.id)] || [];
        return pays.some((p) => p.status === "paid") || poList.some((p) => p.status === "paid");
      });
    }
    return list;
  }, [budgets, statusFilter, paymentsByBudget, posByBudget, projectIdFromUrl]);

  const headerStats = [
    {
      label: isResearcher ? "My total budget" : "Institutional total budget",
      value: formatMoney(totals.allocated, totals.currency),
      sub: isResearcher
        ? `${budgets.length} of your budget${budgets.length === 1 ? "" : "s"}`
        : "Across the whole university",
      accent: "#0ea5e9",
      filterKey: "all",
    },
    {
      label: "Disbursed (paid)",
      value: formatMoney(totals.disbursed, totals.currency),
      sub: `Payments ${formatMoney(totals.disbursedPayments, totals.currency)} • POs ${formatMoney(totals.disbursedPOs, totals.currency)}`,
      accent: "#1d4ed8",
      filterKey: "disbursed",
    },
    {
      label: "Remaining budget",
      value: formatMoney(totals.remaining, totals.currency),
      sub: "Allocated − paid (auto-deducted)",
      accent: "#38bdf8",
      filterKey: "all",
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
      filterKey: "pending",
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
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          isResearcher ? (
            <>
              <button type="button" className="btn primary" onClick={() => { setShowTopPayment((v) => !v); setShowTopPO(false); }}>
                💳 {showTopPayment ? "Cancel" : "Request payment"}
              </button>
              <button type="button" className="btn primary" onClick={() => { setShowTopPO((v) => !v); setShowTopPayment(false); }}>
                🛒 {showTopPO ? "Cancel" : "Request purchase order"}
              </button>
            </>
          ) : null
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(headerStats, statusFilter)}</strong> ({filteredBudgets.length} budget)
        </p>
      ) : null}

      {loading ? <p className="muted">Loading budgets…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 8 }}>{error}</div> : null}

      {payPoTarget ? (
        <PayPOModal
          po={payPoTarget}
          busy={Boolean(actionBusy)}
          onClose={() => !actionBusy && setPayPoTarget(null)}
          onConfirm={submitPayPO}
        />
      ) : null}

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

      {isProcurement && procurementQueuePOs.length ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Procurement review queue</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {procurementQueuePOs.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>🛒 PO: {p.vendorName}</div>
                  <div className="muted">{p.currency} {p.totalAmount} • {p.items?.length || 0} item(s)</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn primary" disabled={Boolean(actionBusy)} onClick={() => decideProcurementPO(p.id, "approve")}>
                    {actionBusy === `po-proc-${p.id}` ? "…" : "Approve"}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(actionBusy)} onClick={() => decideProcurementPO(p.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  <Link className="btn primary" to={`/payments/${p.id}`} title="View full payment details before deciding">
                    View details
                  </Link>
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
                  <button type="button" className="btn primary" disabled={Boolean(actionBusy)} onClick={() => decideDirectorPO(p.id, "approve")}>
                    {actionBusy === `po-dir-${p.id}` ? "…" : "Approve"}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(actionBusy)} onClick={() => decideDirectorPO(p.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isFinance && (financeQueuePayments.length || financeQueuePOs.length) ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Finance disbursement queue (director-approved)</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Marking paid automatically deducts the amount from the linked budget remaining balance.
          </p>
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
                  <Link className="btn primary" to={`/payments/${p.id}`} title="View payment details before disbursement">
                    Review & pay
                  </Link>
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
                  <button type="button" className="btn primary" disabled={Boolean(actionBusy)} onClick={() => setPayPoTarget(p)}>
                    Pay
                  </button>
                  <button type="button" className="btn" disabled={Boolean(actionBusy)} onClick={() => rejectFinancePO(p.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Project locked: <strong>{linkedProject?.title || "selected project"}</strong> —{" "}
          <Link to="/budgets">show all budgets</Link>
        </p>
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
                <label>Research project</label>
                <select
                  value={newBudget.projectId}
                  disabled={projectLocked}
                  onChange={(e) => setNewBudget((s) => ({ ...s, projectId: e.target.value }))}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {projectLocked ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Taken from the project you opened — no manual ID entry.
                  </div>
                ) : null}
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
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  await budgetApi.createBudget(accessToken, {
                    ...newBudget,
                    grantId: newBudget.grantId || null,
                    projectId: newBudget.projectId || null,
                  });
                  setNewBudget({
                    grantId: "",
                    projectId: projectIdFromUrl || "",
                    totalAllocated: 0,
                    currency: "USD",
                  });
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
          {filteredBudgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              payments={paymentsByBudget[String(b.id)] || []}
              pos={posByBudget[String(b.id)] || []}
              isDirector={isDirector}
              isFinance={isFinance}
              isResearcher={isResearcher}
              accessToken={accessToken}
              onReload={reload}
              setError={setError}
            />
          ))}
          {filteredBudgets.length === 0 ? (
            <div className="muted">{budgets.length === 0 ? "No budgets yet." : "No budgets match this filter."}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function budgetOptionLabel(b) {
  const title = b.grant?.title || b.project?.title || String(b.id).slice(-6);
  const remaining =
    b.remainingBalance != null
      ? Number(b.remainingBalance)
      : Math.max(0, Number(b.totalAllocated || 0) - Number(b.totalDisbursed || 0));
  return `${title} • remaining ${b.currency} ${remaining.toLocaleString()}`;
}

function PayPOModal({ po, busy, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentMethodDetails, setPaymentMethodDetails] = useState("");
  const [poNumber, setPoNumber] = useState(po?.poNumber || "");

  if (!po) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "min(480px, 100%)", margin: 0 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Pay purchase order</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {po.vendorName} — {po.currency} {Number(po.totalAmount || 0).toLocaleString()}. This amount will be deducted from the budget remaining balance.
        </p>
        <div className="field">
          <label>Payment method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={busy}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Reference / transaction details</label>
          <input value={paymentMethodDetails} onChange={(e) => setPaymentMethodDetails(e.target.value)} disabled={busy} />
        </div>
        <div className="field">
          <label>PO number (optional)</label>
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} disabled={busy} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Confirm payment of ${po.currency} ${Number(po.totalAmount || 0).toLocaleString()}?`)) return;
              onConfirm({ paymentMethod, paymentMethodDetails, poNumber });
            }}
          >
            {busy ? "Paying…" : "Confirm pay"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TopPaymentForm({ budgets, accessToken, onClose, onChange, setError }) {
  const [budgetId, setBudgetId] = useState(budgets[0]?.id || "");
  const [form, setForm] = useState({ category: "equipment", payee: "", purpose: "", amount: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  const budget = budgets.find((b) => b.id === budgetId);
  const remaining =
    budget?.remainingBalance != null
      ? Number(budget.remainingBalance)
      : Math.max(0, Number(budget?.totalAllocated || 0) - Number(budget?.totalDisbursed || 0));

  async function submit() {
    if (busy) return;
    if (!budgetId) {
      setError("Please choose a budget");
      return;
    }
    if (!form.payee.trim() || !form.purpose.trim()) {
      setError("Payee and purpose are required");
      return;
    }
    const amount = Number(form.amount || 0);
    if (!(amount > 0)) {
      setError("Amount must be greater than zero");
      return;
    }
    if (amount > remaining + 1e-9) {
      setError(`Amount exceeds remaining budget (${budget.currency} ${remaining.toLocaleString()})`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await paymentApi.createPayment(accessToken, {
        budgetId,
        category: form.category,
        payee: form.payee.trim(),
        purpose: form.purpose.trim(),
        amount,
        currency: budget?.currency || "USD",
        notes: form.notes,
      });
      onClose();
      await onChange();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create payment request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>💳 New payment request</div>
      {budget ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Remaining on selected budget: <strong>{budget.currency} {remaining.toLocaleString()}</strong>
        </p>
      ) : null}
      <div className="row">
        <div className="field">
          <label>Budget</label>
          <select value={budgetId} onChange={(e) => setBudgetId(e.target.value)} disabled={busy}>
            <option value="">— select —</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>{budgetOptionLabel(b)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} disabled={busy}>
            {PAYMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Amount ({budget?.currency || "USD"})</label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} disabled={busy} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Payee</label>
          <input value={form.payee} onChange={(e) => setForm((s) => ({ ...s, payee: e.target.value }))} disabled={busy} />
        </div>
        <div className="field">
          <label>Purpose</label>
          <input value={form.purpose} onChange={(e) => setForm((s) => ({ ...s, purpose: e.target.value }))} disabled={busy} />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} disabled={busy} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit for director approval"}</button>
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function TopPOForm({ budgets, accessToken, onClose, onChange, setError }) {
  const [budgetId, setBudgetId] = useState(budgets[0]?.id || "");
  const [form, setForm] = useState({ vendorName: "", vendorContact: "", notes: "", items: [{ description: "", quantity: 1, unitPrice: 0 }] });
  const [busy, setBusy] = useState(false);
  const budget = budgets.find((b) => b.id === budgetId);
  const remaining =
    budget?.remainingBalance != null
      ? Number(budget.remainingBalance)
      : Math.max(0, Number(budget?.totalAllocated || 0) - Number(budget?.totalDisbursed || 0));

  function updateItem(idx, field, value) {
    setForm((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  }

  async function submit() {
    if (busy) return;
    if (!budgetId) {
      setError("Please choose a budget");
      return;
    }
    if (!form.vendorName.trim()) {
      setError("Vendor name is required");
      return;
    }
    const items = form.items
      .filter((it) => it.description)
      .map((it) => ({ description: it.description, quantity: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || 0) }));
    if (items.length === 0) {
      setError("At least one PO item is required");
      return;
    }
    const total = items.reduce((a, it) => a + it.quantity * it.unitPrice, 0);
    if (!(total > 0)) {
      setError("PO total must be greater than zero");
      return;
    }
    if (total > remaining + 1e-9) {
      setError(`PO total exceeds remaining budget (${budget.currency} ${remaining.toLocaleString()})`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await procurementApi.createPurchaseOrder(accessToken, {
        budgetId,
        vendorName: form.vendorName.trim(),
        vendorContact: form.vendorContact,
        currency: budget?.currency || "USD",
        notes: form.notes,
        items,
      });
      onClose();
      await onChange();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create PO");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>🛒 New purchase order</div>
      {budget ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Remaining on selected budget: <strong>{budget.currency} {remaining.toLocaleString()}</strong>
        </p>
      ) : null}
      <div className="row">
        <div className="field">
          <label>Budget</label>
          <select value={budgetId} onChange={(e) => setBudgetId(e.target.value)} disabled={busy}>
            <option value="">— select —</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>{budgetOptionLabel(b)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Vendor name</label>
          <input value={form.vendorName} onChange={(e) => setForm((s) => ({ ...s, vendorName: e.target.value }))} disabled={busy} />
        </div>
        <div className="field">
          <label>Vendor contact</label>
          <input value={form.vendorContact} onChange={(e) => setForm((s) => ({ ...s, vendorContact: e.target.value }))} disabled={busy} />
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
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit PO for approval"}</button>
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function BudgetCard({
  budget,
  payments,
  pos,
  isDirector,
  isFinance,
  isResearcher,
  accessToken,
  onReload,
  setError,
}) {
  const label = budget.grant?.title || budget.project?.title || `Budget ${budget.id?.slice(-6)}`;
  const [itemForm, setItemForm] = useState({ type: "expense", description: "", amount: 0 });
  const [itemBusy, setItemBusy] = useState(false);
  const items = budget.items || [];
  const allocated = Number(budget.totalAllocated || 0);
  const disbursed = Number(
    budget.totalDisbursed != null
      ? budget.totalDisbursed
      : [...payments, ...pos].filter((x) => x.status === "paid").reduce((a, x) => a + Number(x.amount ?? x.totalAmount ?? 0), 0)
  );
  const remaining =
    budget.remainingBalance != null ? Number(budget.remainingBalance) : Math.max(0, allocated - disbursed);

  async function addItem(e) {
    e.preventDefault();
    setItemBusy(true);
    try {
      await budgetApi.addBudgetItem(accessToken, budget.id, {
        type: itemForm.type,
        description: itemForm.description.trim(),
        amount: Number(itemForm.amount) || 0,
      });
      setItemForm({ type: "expense", description: "", amount: 0 });
      await onReload();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add budget item");
    } finally {
      setItemBusy(false);
    }
  }

  async function updateItem(itemId, status) {
    if (itemBusy) return;
    let rejectedReason;
    if (status === "rejected") {
      rejectedReason = window.prompt("Reason for rejection?")?.trim();
      if (!rejectedReason) return;
    } else if (status === "approved") {
      if (!window.confirm("Approve this budget line item?")) return;
    } else if (status === "paid") {
      if (!window.confirm("Mark as paid? Amount will be deducted from budget remaining.")) return;
    }
    setItemBusy(true);
    setError("");
    try {
      await budgetApi.financeUpdateItem(accessToken, budget.id, itemId, { status, rejectedReason });
      await onReload();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update budget item");
    } finally {
      setItemBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>{label}</div>
          <div className="muted">
            Allocated: {budget.currency} {allocated.toLocaleString()}
            {" · "}
            Paid: {budget.currency} {disbursed.toLocaleString()}
            {" · "}
            <span style={{ color: remaining > 0 ? "#38bdf8" : "#f87171", fontWeight: 700 }}>
              Remaining: {budget.currency} {remaining.toLocaleString()}
            </span>
            {Number(disbursed) === 0 && Number(allocated) > 0 ? (
              <span style={{ color: "#fcd34d", fontWeight: 700 }}> · Authorized only — nothing paid yet</span>
            ) : null}
            {budget.grant?.fundingSource ? ` • ${budget.grant.fundingSource}` : ""}
            {!isFinance && budget.project?.title ? ` • Project: ${budget.project.title}` : ""}
            {!isFinance && budget.projectId ? (
              <>
                {" "}
                • <Link to={`/projects/${budget.projectId}`}>Open project</Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700 }}>📋 Budget line items ({items.length})</div>
        {items.length === 0 ? <div className="muted" style={{ marginTop: 6 }}>No line items yet.</div> : null}
        {items.map((it) => {
          const itemId = it._id || it.id;
          return (
            <div key={String(itemId)} className="card" style={{ marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{it.description}</strong>
                  <div className="muted">
                    {String(it.type || "").replace(/_/g, " ")} • {budget.currency} {Number(it.amount || 0).toLocaleString()}
                  </div>
                  {it.rejectedReason ? <div className="muted" style={{ color: "#ef4444" }}>{it.rejectedReason}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={it.status} />
                  {isFinance && it.status === "pending" ? (
                    <>
                      <button type="button" className="btn primary" disabled={itemBusy} onClick={() => updateItem(itemId, "approved")}>
                        Approve
                      </button>
                      <button type="button" className="btn" disabled={itemBusy} onClick={() => updateItem(itemId, "rejected")}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  {isFinance && it.status === "approved" ? (
                    <button type="button" className="btn primary" disabled={itemBusy} onClick={() => updateItem(itemId, "paid")}>
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {isResearcher ? (
          <form onSubmit={addItem} style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Add line item</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={itemForm.type} onChange={(e) => setItemForm((s) => ({ ...s, type: e.target.value }))}>
                {BUDGET_ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={itemForm.description}
                onChange={(e) => setItemForm((s) => ({ ...s, description: e.target.value }))}
                required
                style={{ flex: 1, minWidth: 160 }}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={itemForm.amount}
                onChange={(e) => setItemForm((s) => ({ ...s, amount: e.target.value }))}
                required
                style={{ width: 120 }}
              />
              <button type="submit" className="btn primary" disabled={itemBusy}>Add item</button>
            </div>
          </form>
        ) : null}
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={p.status} />
                  <Link
                    className={isDirector && p.status === "requested" ? "btn primary" : "btn"}
                    to={`/payments/${p.id}`}
                    style={{ fontSize: 12 }}
                  >
                    View details
                  </Link>
                </div>
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
