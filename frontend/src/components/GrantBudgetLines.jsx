const emptyBudgetRow = () => ({ category: "", description: "", amount: "", currency: "USD" });

export function defaultBudgetRows() {
  return [emptyBudgetRow(), emptyBudgetRow(), emptyBudgetRow()];
}

export function GrantBudgetLines({ readOnly, budgetRows, setBudgetRows, currency = "USD" }) {
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Grant budget (funding call)</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Line-item budget for this call application. Not used on research proposals.
      </p>
      {budgetRows.map((row, idx) => (
        <div key={idx} className="card" style={{ marginBottom: 8, background: "rgba(14,165,233,0.04)" }}>
          <div className="row">
            <div className="field">
              <label>Category</label>
              <input
                disabled={readOnly}
                value={row.category}
                onChange={(e) => {
                  const next = [...budgetRows];
                  next[idx] = { ...next[idx], category: e.target.value };
                  setBudgetRows(next);
                }}
                placeholder="e.g. Equipment"
              />
            </div>
            <div className="field">
              <label>Amount</label>
              <input
                disabled={readOnly}
                type="number"
                min="0"
                value={row.amount}
                onChange={(e) => {
                  const next = [...budgetRows];
                  next[idx] = { ...next[idx], amount: e.target.value, currency };
                  setBudgetRows(next);
                }}
              />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input
              disabled={readOnly}
              value={row.description}
              onChange={(e) => {
                const next = [...budgetRows];
                next[idx] = { ...next[idx], description: e.target.value };
                setBudgetRows(next);
              }}
            />
          </div>
        </div>
      ))}
      {!readOnly ? (
        <button type="button" className="btn" onClick={() => setBudgetRows([...budgetRows, { ...emptyBudgetRow(), currency }])}>
          + Budget line
        </button>
      ) : null}
    </div>
  );
}

export function budgetRowsTotal(budgetRows) {
  return budgetRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}
