'use strict';
jest.mock('../../models', () => ({ Transaction: { findAll: jest.fn() } }));
const { Transaction } = require('../../models');
const { getServicePaymentState } = require('../../src/services/servicePaymentState.service');

test('only completed revenue with proof in the service currency counts as recorded payment', async () => {
  Transaction.findAll.mockResolvedValue([
    { amount: '80', currency: 'GHS', proofFile: '/receipts/1.pdf' },
    { amount: '20', currency: 'GHS', proofFile: null },
    { amount: '900', currency: 'XOF', proofFile: '/receipts/2.pdf' },
  ]);
  const result = await getServicePaymentState({ id: 7, currency: 'GHS', budget: 100 });
  expect(Transaction.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { serviceId: 7, type: 'revenue', status: 'completed' } }));
  expect(result).toEqual({ currency: 'GHS', recordedPayments: 80, agreedAmount: null, remainingAmount: null });
});
