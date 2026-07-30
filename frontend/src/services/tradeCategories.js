// frontend/src/services/tradeCategories.js
import api from './api';

// GET /api/v1/trade-categories — public, filières actives (docs/DEV_SPEC_TERANGA_v3.md section 3.3).
// v1-only (section 0.5) : préfixe explicite /v1.
export async function listTradeCategories() {
  const { data } = await api.get('/v1/trade-categories');
  return data?.tradeCategories || [];
}
