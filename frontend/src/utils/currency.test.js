import { summarizeTransactionsByCurrency } from './currency';

test('financial balances keep currencies separate and include signed adjustments and commissions', () => {
  const totals = summarizeTransactionsByCurrency([
    { type: 'revenue', amount: '100', currency: 'GHS' },
    { type: 'expense', amount: 30, currency: 'ghs' },
    { type: 'commission', amount: 5, currency: 'GHS' },
    { type: 'adjustment', amount: 10, currency: 'GHS' },
    { type: 'adjustment', amount: -2, currency: 'GHS' },
    { type: 'revenue', amount: 90000, currency: 'GNF' },
  ]);
  expect(totals).toEqual([
    { currency: 'GHS', revenues: 100, expenses: 30, commissions: 5, adjustments: 8, balance: 73 },
    { currency: 'GNF', revenues: 90000, expenses: 0, commissions: 0, adjustments: 0, balance: 90000 },
  ]);
});
