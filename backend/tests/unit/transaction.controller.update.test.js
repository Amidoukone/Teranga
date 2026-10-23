'use strict';

const fs = require('fs');
jest.mock('../../models', () => ({ Transaction: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() } }));
jest.mock('../../src/services/transaction.service', () => ({
  canAccessTransaction: jest.fn(async () => true), COMMON_INCLUDE: [],
  toSafeInt: (value) => Number(value), toTrimOrNull: (value) => String(value || '').trim() || null,
}));
jest.mock('../../src/services/transactionContext.service', () => ({ resolveTransactionContext: jest.fn() }));
jest.mock('../../src/utils/mediaStorageDiagnostics', () => ({ isImageKitConfigured: () => false, buildMediaStorageDiagnostics: () => ({}) }));
jest.mock('../../src/utils/mediaStoragePolicy', () => ({ evaluateLocalMediaFallback: () => ({ allowLocalFallback: true }) }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('../../src/helpers/teranga-imagekit', () => ({}));
const { Transaction } = require('../../models');
const { resolveTransactionContext } = require('../../src/services/transactionContext.service');
const controller = require('../../src/controllers/transaction.controller');
const proof = { url: '/uploads/transactions/previous.pdf', fileId: null };
const file = { originalname: 'new.pdf', mimetype: 'application/pdf', buffer: Buffer.from('new'), size: 3 };
let record;
const req = (body) => ({ params: { id: '1' }, user: { id: 1, role: 'admin' }, body, file });
const response = () => { const res = { status: jest.fn(), json: jest.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(fs.promises, 'mkdir').mockResolvedValue();
  jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();
  jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
  record = { id: 1, countryId: 2, status: 'pending', currency: 'GHS', proofFile: proof, save: jest.fn(async () => {}) };
  Transaction.findByPk.mockImplementation(async () => record);
  Transaction.findOne.mockResolvedValue(null);
  resolveTransactionContext.mockResolvedValue({ countryId: 2, regionId: null, currency: 'GHS' });
});
afterEach(() => jest.restoreAllMocks());

test('an invalid financial update preserves the old receipt without uploading a replacement', async () => {
  const res = response();
  await controller.update(req({ type: 'invalid' }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
  expect(fs.promises.unlink).not.toHaveBeenCalled();
  expect(record.save).not.toHaveBeenCalled();
});

test('a failed geographic relink preserves the old receipt', async () => {
  resolveTransactionContext.mockRejectedValueOnce(Object.assign(new Error('Invalid link'), { status: 400 }));
  const res = response();
  await controller.update(req({ serviceId: 999 }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
  expect(fs.promises.unlink).not.toHaveBeenCalled();
});

test('a successful replacement saves the new receipt before removing the old local file', async () => {
  const res = response();
  await controller.update(req({ description: 'Correction' }), res);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(record.proofFile.url).not.toBe(proof.url);
  expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringMatching(/previous\.pdf$/));
  expect(record.save.mock.invocationCallOrder[0]).toBeLessThan(fs.promises.unlink.mock.invocationCallOrder[0]);
});

test('a failed database update cleans only the newly uploaded receipt', async () => {
  record.save.mockRejectedValueOnce(new Error('Database unavailable'));
  const res = response();
  await controller.update(req({ description: 'Correction' }), res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
  expect(fs.promises.unlink).toHaveBeenCalledWith(expect.not.stringMatching(/previous\.pdf$/));
});

test('relinking from a paid order to a pending order does not complete the transaction', async () => {
  record.order = { id: 2, status: 'paid' };
  resolveTransactionContext.mockResolvedValueOnce({ order: { id: 3, userId: 1, status: 'pending' }, countryId: 2, regionId: null });
  await controller.update({ ...req({ orderId: 3 }), file: undefined }, response());
  expect(record.orderId).toBe(3);
  expect(record.status).toBe('pending');
});

test('a failed transaction creation removes its newly uploaded receipt', async () => {
  Transaction.create.mockRejectedValueOnce(new Error('Database unavailable'));
  const res = response();
  await controller.create(req({ type: 'expense', amount: 50 }), res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
  expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
});

test('an order payment cannot be overwritten through creation with a different currency', async () => {
  Transaction.findOne.mockResolvedValue(record);
  resolveTransactionContext.mockResolvedValue({ order: { id: 3, userId: 1 }, countryId: 2, currency: 'GHS' });
  const res = response();
  await controller.create(req({ type: 'expense', amount: 50, currency: 'USD' }), res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(record.save).not.toHaveBeenCalled();
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
});

test('an existing order receipt is retained on repeated creation without an unused upload', async () => {
  Transaction.findOne.mockResolvedValue(record);
  resolveTransactionContext.mockResolvedValue({ order: { id: 3, userId: 1 }, countryId: 2, currency: 'GHS' });
  const res = response();
  await controller.create(req({ type: 'expense', amount: 50, status: 'completed' }), res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(record.proofFile).toBe(proof);
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
});
