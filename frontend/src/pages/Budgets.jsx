import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as budgetApi from "../services/budgetApi";

export function BudgetsPage() {
  const { accessToken, user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [newBudget, setNewBudget] = useState({ grantId: "", projectId: "", totalAllocated: 0, currency: "USD" });

  const isResearcher = user?.role === "researcher";
  const isFinance = user?.role === "finance_officer";

  const load = useCallback(async () => {
    const res = await budgetApi.listBudgets(accessToken);
    setBudgets(res.budgets || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const flatItems = useMemo(() => budgets.flatMap((b) => (b.items || []).map((i) => ({ ...i, budgetId: b.id }))), [budgets]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Finance & Budget</h2>
      {loading ? <p className="muted">Loading budgets…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {isResearcher ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Create Budget (link to Grant or Project)</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="row">
              <div className="field">
                <label>Grant ID (optional)</label>
                <input value={newBudget.grantId} onChange={(e) => setNewBudget((s) => ({ ...s, grantId: e.target.value }))} />
              </div>
              <div className="field">
                <label>Project ID (optional)</label>
                <input
                  value={newBudget.projectId}
                  onChange={(e) => setNewBudget((s) => ({ ...s, projectId: e.target.value }))}
                />
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
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Budgets</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} isResearcher={isResearcher} isFinance={isFinance} accessToken={accessToken} onChange={reload} />
          ))}
          {budgets.length === 0 ? <div className="muted">No budgets yet.</div> : null}
        </div>
      </div>

      {isFinance ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Finance Queue (All Items)</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {flatItems.map((i) => (
              <div key={i._id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{i.description}</div>
                    <div className="muted">
                      {i.type} • {i.status} • {i.amount}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {i.status === "pending" ? (
                      <button
                        className="btn"
                        onClick={async () => {
                          await budgetApi.financeUpdateItem(accessToken, i.budgetId, i._id, { status: "approved" });
                          await reload();
                        }}
                      >
                        Approve
                      </button>
                    ) : null}
                    {i.status === "approved" ? (
                      <button
                        className="btn"
                        onClick={async () => {
                          await budgetApi.financeUpdateItem(accessToken, i.budgetId, i._id, { status: "paid" });
                          await reload();
                        }}
                      >
                        Mark paid
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {flatItems.length === 0 ? <div className="muted">No items yet.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BudgetCard({ budget, isResearcher, isFinance, accessToken, onChange }) {
  const [item, setItem] = useState({ type: "expense", description: "", amount: 0 });
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Budget</div>
          <div className="muted">
            {budget.currency} • allocated {budget.totalAllocated} • items {budget.items?.length || 0}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            grantId: {budget.grantId || "-"} • projectId: {budget.projectId || "-"}
          </div>
        </div>
      </div>

      {isResearcher ? (
        <div style={{ marginTop: 10 }}>
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select value={item.type} onChange={(e) => setItem((s) => ({ ...s, type: e.target.value }))}>
                <option value="expense">Expense</option>
                <option value="procurement">Procurement</option>
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" value={item.amount} onChange={(e) => setItem((s) => ({ ...s, amount: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input value={item.description} onChange={(e) => setItem((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <button
            className="btn"
            onClick={async () => {
              await budgetApi.addBudgetItem(accessToken, budget.id, item);
              setItem({ type: "expense", description: "", amount: 0 });
              await onChange();
            }}
          >
            Add item
          </button>
        </div>
      ) : null}

      {(budget.items || []).length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {budget.items.map((i) => (
            <div key={i._id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{i.description}</div>
                  <div className="muted">
                    {i.type} • {i.status} • {i.amount}
                  </div>
                </div>
                {isFinance && i.status === "pending" ? (
                  <button
                    className="btn"
                    onClick={async () => {
                      await budgetApi.financeUpdateItem(accessToken, budget.id, i._id, { status: "approved" });
                      await onChange();
                    }}
                  >
                    Approve
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

