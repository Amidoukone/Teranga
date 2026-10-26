import { statementCSV, transactionProofHref } from './transactionPresentation';

test('payment receipts support legacy paths and nested metadata', () => {
  expect(transactionProofHref('{"file":{"url":"/uploads/receipt.pdf"}}')).toMatch(/\/uploads\/receipt\.pdf$/);
  expect(transactionProofHref('/uploads/receipt.pdf')).toMatch(/\/uploads\/receipt\.pdf$/);
  expect(transactionProofHref({ url: 'https://files.example.test/receipt.pdf' })).toBe('https://files.example.test/receipt.pdf');
});
test.each([['java', 'script:alert(1)'].join(''), '//example.test/receipt.pdf', '\\example.test', 'data:text/html,hello'])('payment receipt rejects active or ambiguous URL %s', (url) => {
  expect(transactionProofHref({ url })).toBe('');
});
test('CSV keeps entry status, currency and case identity and neutralizes spreadsheet formulas', () => {
  const csv = statementCSV([{ id: 1, amount: '42.50', type: 'revenue', currency: 'GHS', status: 'pending', description: '=1+1', orderId: 18 }]);
  expect(csv).toContain('"pending";"42.5";"GHS"');
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"18"');
});
