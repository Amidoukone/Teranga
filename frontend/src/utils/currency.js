export function getTransactionCurrency(transaction) {
  const value = String(transaction?.currency || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : 'XOF';
}

export function summarizeTransactionsByCurrency(transactions = []) {
  const groups = new Map();
  for (const transaction of transactions) {
    const currency = getTransactionCurrency(transaction);
    const totals = groups.get(currency) || { currency, revenues: 0, expenses: 0, commissions: 0, adjustments: 0, balance: 0 };
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'revenue') totals.revenues += amount;
    if (transaction.type === 'expense') totals.expenses += amount;
    if (transaction.type === 'commission') totals.commissions += amount;
    if (transaction.type === 'adjustment') totals.adjustments += amount;
    totals.balance = totals.revenues - totals.expenses - totals.commissions + totals.adjustments;
    groups.set(currency, totals);
  }
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
