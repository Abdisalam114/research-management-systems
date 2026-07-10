function normalizeBudgetBreakdown(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const budgetBreakdown = rows
    .map((r) => ({
      category: String(r.category || "").trim(),
      description: String(r.description || "").trim(),
      amount: Number(r.amount) || 0,
      currency: String(r.currency || "USD").trim() || "USD",
    }))
    .filter((r) => r.category || r.description || r.amount > 0);
  const budgetTotal = budgetBreakdown.reduce((sum, r) => sum + (r.amount || 0), 0);
  const budgetCurrency = budgetBreakdown[0]?.currency || "USD";
  return { budgetBreakdown, budgetTotal, budgetCurrency };
}

module.exports = { normalizeBudgetBreakdown };
