import api from './api';
import { createTransaction, getAllTransactions, updateTransaction } from './transactions';
import { setGeoSelection } from './geo';

jest.mock('./api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });
afterEach(() => localStorage.clear());

test('linked payments use the operation destination rather than the navigation selection', async () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  api.post.mockResolvedValue({ data: { transaction: { id: 7 } } });
  await createTransaction({ serviceId: 8, type: 'expense', amount: 50 });
  const payload = api.post.mock.calls[0][1];
  expect(payload.serviceId).toBe(8);
  expect(payload.countryId).toBeUndefined();
  expect(payload.regionId).toBeUndefined();
});

test('an explicit payment destination is preserved without an unrelated selected region', async () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  api.post.mockResolvedValue({ data: { transaction: { id: 7 } } });
  await createTransaction({ country_id: 2, type: 'expense', amount: 50 });
  expect(api.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({ countryId: 2 }));
  expect(api.post.mock.calls[0][1].regionId).toBeUndefined();
});

test('receipt replacement uses the update HTTP method and multipart payload', async () => {
  api.put.mockResolvedValue({ data: { transaction: { id: 7 } } });
  const proofFile = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
  await updateTransaction(7, { description: 'Justificatif corrigé', proofFile });
  expect(api.put).toHaveBeenCalledTimes(1);
  expect(api.put).toHaveBeenCalledWith('/transactions/7', expect.any(FormData));
  expect(api.put.mock.calls[0][1].get('proofFile')).toEqual(proofFile);
  expect(api.post).not.toHaveBeenCalled();
});

test('a rejected payment is not resubmitted with every upload field name', async () => {
  const error = { response: { status: 409, data: { error: 'Devise incompatible' } } };
  api.post.mockRejectedValue(error);
  const proofFile = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
  await expect(createTransaction({ type: 'expense', amount: 50, proofFile })).rejects.toBe(error);
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('upload field compatibility retries only an unexpected file field rejection', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Champ de fichier inattendu' } } });
  api.post.mockResolvedValueOnce({ data: { transaction: { id: 7 } } });
  const proofFile = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
  await createTransaction({ type: 'expense', amount: 50, proofFile });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls[0][1].get('proofFile')).toEqual(proofFile);
  expect(api.post.mock.calls[1][1].get('proof')).toEqual(proofFile);
});

test('financial data includes every page and keeps one destination throughout the load', async () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  api.get.mockResolvedValueOnce({ data: { transactions: [{ id: 1 }, { id: 2 }], pagination: { total: 3, limit: 2 } } });
  api.get.mockImplementationOnce(async () => {
    setGeoSelection({ countryId: 3, regionId: 30 });
    return { data: { transactions: [{ id: 3 }], pagination: { total: null, limit: 2 } } };
  });
  expect((await getAllTransactions({ countryId: 2 })).map((item) => item.id)).toEqual([1, 2, 3]);
  expect(api.get).toHaveBeenNthCalledWith(1, '/transactions', expect.objectContaining({ params: expect.objectContaining({ countryId: 2, offset: 0, includeCount: true }) }));
  expect(api.get).toHaveBeenNthCalledWith(2, '/transactions', expect.objectContaining({ params: expect.objectContaining({ countryId: 2, offset: 2, includeCount: false }) }));
  for (const [, options] of api.get.mock.calls) expect(options.params.regionId).toBeUndefined();
});

test('an interrupted financial load fails instead of presenting partial totals', async () => {
  api.get.mockResolvedValueOnce({ data: { transactions: [{ id: 1 }], pagination: { total: 3, limit: 2 } } });
  api.get.mockResolvedValueOnce({ data: { transactions: [], pagination: { total: null, limit: 2 } } });
  await expect(getAllTransactions()).rejects.toThrow('Incomplete transaction list');
});
