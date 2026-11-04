import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../i18n/useLocale';
import { createOrder } from '../../services/orders';
import { catalogueReturn } from '../shop/productDisplay';

export function productUnavailable(product) {
  return product.isActive === false || product.isActive === 0 ||
    (product.stock != null && Number.isFinite(Number(product.stock)) && Number(product.stock) < 1);
}

// The catalogue and the article page submit the same request. The server sets the price.
export default function ProductOrderForm({ product, user }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const count = Number(quantity);
  const validQuantity = Number.isSafeInteger(count) && count >= 1;
  const stock = product.stock == null ? null : Number(product.stock);
  const total = Number(product.price) * count;
  const unavailable = productUnavailable(product);

  async function submit(event) {
    event.preventDefault();
    if (sending.current || user?.role !== 'client' || unavailable) return;
    if (!validQuantity) { setError(t('ordersSimple.invalidQuantity')); return; }
    if (stock != null && Number.isFinite(stock) && count > stock) {
      setError(t('shopFlow.overStock', { count: stock })); return;
    }
    sending.current = true; setBusy(true); setError('');
    const countryId = product.countryId ?? user.countryId ?? null;
    const regionId = product.regionId ?? (String(countryId) === String(user.countryId ?? null) ? user.regionId ?? null : null);
    try {
      const result = await createOrder({
        customerNote: note.trim(), countryId, regionId,
        ...(product.currency ? { currency: product.currency } : {}),
        items: [{ productId: product.id, quantity: count }],
      });
      if (!alive.current) return;
      const id = result?.id || result?.order?.id;
      navigate(id ? `/orders/${id}` : '/orders', { state: { from: location.pathname + location.search, catalogueFrom: catalogueReturn(location.state?.from) } });
    } catch (failure) {
      if (alive.current) setError(failure?.response?.data?.error || t('productCatalogPage.alerts.orderError'));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  if (user?.role !== 'client') return null;
  return <form aria-label={t('productCatalogPage.order.title', { name: product.name })} onSubmit={submit} className="space-y-3">
    <fieldset disabled={busy || unavailable} className="space-y-3">
      <label className="block text-sm font-medium">{t('orders.form.quantityLabel')}
        <input aria-label={t('orders.form.quantityLabel')} type="number" min="1" step="1" max={Number.isFinite(stock) ? stock : undefined} required value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-3" />
      </label>
      {validQuantity && Number.isFinite(total) && <p className="text-sm font-semibold" aria-live="polite">{t('shopFlow.total')}: {formatNumber(total)} {product.currency || 'XOF'}</p>}
      <label className="block text-sm">{t('shopFlow.note')}
        <textarea aria-label={t('shopFlow.note')} rows={2} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface-main p-3" />
      </label>
      <p className="text-sm text-text-secondary">{t('shopFlow.followHint')}</p>
      <button type="submit" className="btn-primary min-h-11 w-full rounded-xl px-4 text-sm font-semibold">{t(busy ? 'orders.form.submitting' : 'orders.form.submit')}</button>
    </fieldset>
    {unavailable && <p className="text-sm text-text-secondary">{t('shopFlow.unavailable')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
  </form>;
}
