'use strict';

jest.mock('../../models', () => ({ Transaction: { findOne: jest.fn(), create: jest.fn() } }));
jest.mock('../../src/services/notification.service', () => ({
  getAdminRecipientIds: jest.fn(async () => []),
  computeProgress: jest.fn(() => 0),
}));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: jest.fn(async () => {}) }));
jest.mock('../../src/utils/geoScope', () => ({
  filterGeoAssignmentsForModel: jest.fn((_model, payload) => payload),
}));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const { Transaction } = require('../../models');
const { syncOrderPaymentTransaction } = require('../../src/services/orderLifecycle.service');

describe('syncOrderPaymentTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  test('does nothing when the order is not paid', async () => {
    await syncOrderPaymentTransaction({ order: { paymentStatus: 'pending' } });
    expect(Transaction.findOne).not.toHaveBeenCalled();
  });

  test('creates the payment transaction when none exists yet', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const order = { id: 3, userId: 1, paymentStatus: 'paid', total: 1000, currency: 'XOF', code: 'CMD-3' };
    await syncOrderPaymentTransaction({ order });
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 3, amount: 1000, status: 'completed' }),
      expect.anything()
    );
  });

  test('updates a stale amount even when the transaction is already completed', async () => {
    const existingTx = { status: 'completed', amount: 1000, countryId: null, regionId: null, save: jest.fn(async () => {}) };
    Transaction.findOne.mockResolvedValue(existingTx);
    const order = { id: 3, userId: 1, paymentStatus: 'paid', total: 1500, currency: 'XOF' };
    await syncOrderPaymentTransaction({ order });
    expect(existingTx.amount).toBe(1500);
    expect(existingTx.save).toHaveBeenCalledTimes(1);
  });

  test('does not re-save an already completed transaction whose amount still matches', async () => {
    const existingTx = { status: 'completed', amount: 1000, countryId: 2, regionId: null, save: jest.fn(async () => {}) };
    Transaction.findOne.mockResolvedValue(existingTx);
    const order = { id: 3, userId: 1, paymentStatus: 'paid', total: 1000, currency: 'XOF', countryId: 2 };
    await syncOrderPaymentTransaction({ order });
    expect(existingTx.save).not.toHaveBeenCalled();
  });

  test('completes a pending transaction and aligns its amount in a single save', async () => {
    const existingTx = { status: 'pending', amount: 900, countryId: null, regionId: null, save: jest.fn(async () => {}) };
    Transaction.findOne.mockResolvedValue(existingTx);
    const order = { id: 3, userId: 1, paymentStatus: 'paid', total: 1200, currency: 'XOF' };
    await syncOrderPaymentTransaction({ order });
    expect(existingTx.status).toBe('completed');
    expect(existingTx.amount).toBe(1200);
    expect(existingTx.save).toHaveBeenCalledTimes(1);
  });
});
