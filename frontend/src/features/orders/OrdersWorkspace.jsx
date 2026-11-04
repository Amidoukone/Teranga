import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { me } from '../../services/auth';
import { createOrder, deleteOrder, getOrders } from '../../services/orders';
import { getProducts } from '../../services/products';
import { useLocale } from '../../i18n/useLocale';
import { isGlobalAdminUser } from '../../utils/role';
import { canonicalizeOrderStatus, canonicalizePaymentStatus, getOrderStatusTone, getPaymentStatusTone } from '../../utils/labels';
import { useDeleteConfirm } from '../../hooks/useDeleteConfirm';
import { Badge } from '../../components/ui';
import PaginationBar from '../../components/PaginationBar';

const inputClass = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface-main p-3 text-sm';
const orderStates = ['created', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
const paymentStates = ['unpaid', 'partial', 'paid', 'refunded'];

function NewOrderForm({ user, active, onCancel, onCreated }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const [products, setProducts] = useState([]), [catalogError, setCatalogError] = useState(''), [catalogAttempt, setCatalogAttempt] = useState(0), [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '1', unitPrice: '', customerNote: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), sending = useRef(false), loaded = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!active || loaded.current) return undefined;
    let current = true; setLoading(true);
    getProducts({ limit: 200 }).then((result) => {
      if (!current) return;
      setProducts(Array.isArray(result) ? result : result?.products || []); setCatalogError(''); loaded.current = true;
    }).catch(() => { if (current) setCatalogError(t('ordersSimple.catalogFailed')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, catalogAttempt, t]);
  const change = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); if (sending.current) return;
    if (!form.productId && !form.customerNote.trim()) { setError(t('ordersSimple.needOrder')); return; }
    const quantity = Number(form.quantity);
    if (form.productId && (!Number.isSafeInteger(quantity) || quantity < 1)) { setError(t('ordersSimple.invalidQuantity')); return; }
    const price = form.unitPrice.trim().replace(',', '.');
    if (user.role === 'admin' && price && !Number.isFinite(Number(price))) { setError(t('financialWorkspace.invalidAmount')); return; }
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await createOrder({ customerNote: form.customerNote.trim(), ...(form.productId ? { items: [{ productId: Number(form.productId), quantity, ...(user.role === 'admin' && price ? { unitPrice: Number(price) } : {}) }] } : {}) });
      if (alive.current) onCreated(result?.id || result?.order?.id);
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('orders.alerts.createError')); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return <form aria-label={t('orders.form.title')} onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
    <h2 className="text-lg font-bold">{t('orders.form.title')}</h2>
    <p className="text-sm text-text-secondary">{t('ordersSimple.createHint')}</p>
    <fieldset disabled={busy} className="space-y-4">
      {catalogError && <p role="alert">{catalogError} <button type="button" onClick={() => setCatalogAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className="text-sm">{t('orders.form.productLabel')}<select aria-label={t('orders.form.productLabel')} disabled={loading || Boolean(catalogError)} value={form.productId} onChange={(event) => setForm((previous) => ({ ...previous, productId: event.target.value, unitPrice: '' }))} className={inputClass}>
          <option value="">{t('ordersSimple.customOrder')}</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatNumber(product.price || 0)} {product.currency || 'XOF'}</option>)}
        </select></label>
        {form.productId && <label className="text-sm">{t('orders.form.quantityLabel')}<input aria-label={t('orders.form.quantityLabel')} type="number" min="1" step="1" required value={form.quantity} onChange={change('quantity')} className={inputClass} /></label>}
      </div>
      <label className="block text-sm">{t('orders.form.customerNoteLabel')}<textarea aria-label={t('orders.form.customerNoteLabel')} rows={3} maxLength={5000} value={form.customerNote} onChange={change('customerNote')} placeholder={t('orders.form.customerNotePlaceholder')} className={inputClass} /></label>
      {user.role === 'admin' && form.productId && <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('ordersSimple.priceOptions')}</summary><label className="text-sm">{t('orders.form.unitPriceLabel')}<input aria-label={t('orders.form.unitPriceLabel')} inputMode="decimal" value={form.unitPrice} onChange={change('unitPrice')} className={inputClass} placeholder={t('orders.form.unitPricePlaceholder')} /></label></details>}
      <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary min-h-11 rounded-xl px-4">{t(busy ? 'orders.form.submitting' : 'orders.form.submit')}</button><button type="button" onClick={onCancel} className="btn-secondary min-h-11 rounded-xl px-4">{t('financialWorkspace.cancel')}</button></div>
    </fieldset>
    {error && <p role="alert" className="app-alert app-alert-error">{error}</p>}
  </form>;
}

export default function OrdersWorkspace() {
  const { user, countryId, regionId } = useGeo();
  return <Orders key={JSON.stringify([user?.id, user?.role, countryId, regionId])} countryId={countryId} regionId={regionId} />;
}

function Orders({ countryId, regionId }) {
  const { t } = useTranslation();
  const { formatNumber, formatDateTime } = useLocale();
  const { confirmDelete } = useDeleteConfirm();
  const navigate = useNavigate(), location = useLocation();
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null), [bootError, setBootError] = useState(''), [attempt, setAttempt] = useState(0);
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revoked, setRevoked] = useState(false);
  const [showForm, setShowForm] = useState(params.get('nouveau') === '1'), [visited, setVisited] = useState(params.get('nouveau') === '1'), [deletingIds, setDeletingIds] = useState({});
  const [query, setQuery] = useState(params.get('q') || '');
  const version = useRef(0), alive = useRef(true), deleting = useRef(new Set());
  const q = (params.get('q') || '').slice(0, 100);
  const status = orderStates.includes(params.get('status')) ? params.get('status') : '';
  const payment = paymentStates.includes(params.get('payment')) ? params.get('payment') : '';
  const sort = ['-createdAt', 'createdAt', '-totalAmount', 'totalAmount'].includes(params.get('sort')) ? params.get('sort') : '-createdAt';
  const rawPage = Number(params.get('page')), page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const pageSize = [10,20,50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 20;
  const scope = JSON.stringify([user?.id, user?.role, countryId, regionId, q, status, payment, sort, page, pageSize]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const visible = data?.scope === scope ? data.value : null;
  const update = useCallback((values) => {
    setParams((previous) => { const next = new URLSearchParams(previous); Object.entries(values).forEach(([key,value]) => value ? next.set(key,String(value)) : next.delete(key)); return next; });
  }, [setParams]);
  useEffect(() => { setQuery(q); }, [q]);
  useEffect(() => {
    alive.current = true; setBootError('');
    me().then(({ user: current, offline }) => {
      if (!alive.current) return;
      if (current) { setUser(current); return; }
      // Une panne réseau n'est pas une session absente : ne jamais éjecter vers
      // /login un utilisateur dont la session reste valide côté serveur.
      if (offline) { setBootError(t('orders.alerts.loadError')); return; }
      navigate('/login');
    }).catch(() => { if (alive.current) setBootError(t('orders.alerts.loadError')); });
    return () => { alive.current = false; version.current += 1; };
  }, [navigate, t, attempt]);
  const load = useCallback(async () => {
    if (!user || !alive.current) return;
    const request = ++version.current; setLoading(true);
    try {
      const result = await getOrders({ page, limit: pageSize, q, status, paymentStatus: payment, sort, ...(user.role === 'admin' ? { countryId, regionId } : { countryId: null, regionId: null }) }, { withPagination: true });
      if (!alive.current || request !== version.current || currentScope.current !== scope) return;
      const items = Array.isArray(result) ? result : result.items || result.orders || [];
      const total = result.pagination?.total ?? result.pagination?.count ?? items.length;
      if (page > 1 && (page - 1) * pageSize >= total) { update({ page: Math.max(1,Math.ceil(total / pageSize)) }); return; }
      setData({ scope, value: { items, total } }); setError(''); setRevoked(false);
    } catch (failure) {
      if (!alive.current || request !== version.current || currentScope.current !== scope) return;
      if ([401,403,404].includes(failure?.response?.status)) { setData(null); setShowForm(false); setVisited(false); setRevoked(true); }
      setError(t('orders.alerts.loadError'));
    } finally { if (alive.current && request === version.current) setLoading(false); }
  }, [user, page, pageSize, q, status, payment, sort, countryId, regionId, scope, update, t]);
  useEffect(() => {
    load(); const refresh = () => load(); window.addEventListener('online',refresh);
    return () => { version.current += 1; window.removeEventListener('online',refresh); };
  }, [load]);
  async function remove(id) {
    if (!isGlobalAdminUser(user) || deleting.current.has(id)) return;
    deleting.current.add(id);
    try {
      if (!await confirmDelete('order') || !alive.current) return;
      setDeletingIds((previous) => ({ ...previous, [id]: true }));
      await deleteOrder(id); if (alive.current) await load();
    } catch (failure) { if (alive.current) setError(failure?.response?.data?.error || t('orders.alerts.deleteError')); }
    finally { deleting.current.delete(id); if (alive.current) setDeletingIds((previous) => ({ ...previous, [id]: false })); }
  }
  if (!user) return <div className="app-page-wrap"><div className="app-page-shell">{bootError ? <p role="alert">{bootError} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p> : <p role="status">{t('common.loading')}</p>}</div></div>;
  const from = /^\/(?:demandes|services)(?:\?[^#\\\r\n]*)?$/.test(location.state?.from || '') ? location.state.from : location.pathname + location.search;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-5xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="app-page-headline">{t(user.role === 'client' ? 'ordersSimple.clientTitle' : 'ordersSimple.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('ordersSimple.hint')}</p></div>
      {!revoked && ['client','admin'].includes(user.role) && <button type="button" aria-expanded={showForm} onClick={() => { setShowForm((value) => !value); setVisited(true); }} className="btn-primary min-h-11 rounded-xl px-4 text-sm font-semibold">{t(showForm ? 'orders.buttons.hideForm' : 'orders.buttons.newOrder')}</button>}
    </header>
    <div className="flex flex-wrap gap-4 text-sm"><Link to="/shop" className="inline-flex min-h-11 items-center underline">{t('orders.buttons.viewCatalog')}</Link><button type="button" disabled={loading} onClick={load} className="min-h-11 underline">{t('financialWorkspace.refresh')}</button></div>
    {visited && !revoked && <div hidden={!showForm}><NewOrderForm user={user} active={showForm} onCancel={() => setShowForm(false)} onCreated={(id) => { if (id) navigate(`/orders/${id}`, { state: { from } }); else { setShowForm(false); load(); } }} /></div>}
    <form onSubmit={(event) => { event.preventDefault(); update({ q: query.trim(), page: null }); }} className="rounded-2xl border border-border bg-surface-card p-4"><label className="text-sm">{t('orders.filters.searchLabel')}<div className="mt-1 flex gap-2"><input aria-label={t('orders.filters.searchLabel')} value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={t('orders.filters.searchPlaceholder')} className={inputClass} /><button type="submit" className="btn-secondary min-h-11 rounded-xl px-3 text-sm">{t('financialWorkspace.find')}</button></div></label></form>
    <details className="rounded-2xl border border-border p-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('ordersSimple.filters')}</summary><div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">{t('orders.filters.orderStatusLabel')}<select aria-label={t('orders.filters.orderStatusLabel')} value={status} onChange={(event) => update({ status: event.target.value, page: null })} className={inputClass}><option value="">{t('orders.filters.all')}</option>{orderStates.map((value) => <option key={value} value={value}>{t(`orders.status.${value}`)}</option>)}</select></label>
      <label className="text-sm">{t('orders.filters.paymentStatusLabel')}<select aria-label={t('orders.filters.paymentStatusLabel')} value={payment} onChange={(event) => update({ payment: event.target.value, page: null })} className={inputClass}><option value="">{t('orders.filters.all')}</option>{paymentStates.map((value) => <option key={value} value={value}>{t(`orders.payment.${value}`)}</option>)}</select></label>
      <label className="text-sm">{t('orders.filters.sortLabel')}<select aria-label={t('orders.filters.sortLabel')} value={sort} onChange={(event) => update({ sort: event.target.value, page: null })} className={inputClass}>{[['-createdAt','sortNewest'],['createdAt','sortOldest'],['-totalAmount','sortAmountDesc'],['totalAmount','sortAmountAsc']].map(([value,label]) => <option key={value} value={value}>{t(`orders.filters.${label}`)}</option>)}</select></label>
    </div><button type="button" onClick={() => update({ q:null,status:null,payment:null,sort:null,page:null })} className="mt-3 min-h-11 text-sm underline">{t('orders.filters.reset')}</button></details>
    {loading && <p role="status">{t('orders.list.loading')}</p>}
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" disabled={loading} onClick={load} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!loading && !error && visible?.items.length === 0 && <p className="rounded-2xl border border-dashed border-border p-6 text-sm">{t('orders.list.empty')}</p>}
    <div className="space-y-4">{visible?.items.map((order) => {
      const workState = canonicalizeOrderStatus(order.orderStatus || order.status), paidState = canonicalizePaymentStatus(order.paymentStatus);
      return <article key={order.id} aria-label={order.code || t('orders.list.orderNumber',{ id:order.id })} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words font-bold">{order.code || t('orders.list.orderNumber',{ id:order.id })}</h2><p className="text-lg font-bold">{formatNumber(order.totalAmount ?? order.total ?? 0)} {order.currency || 'XOF'}</p></div>
        <div className="flex flex-wrap gap-2"><Badge tone={getOrderStatusTone(workState)}>{t('orders.list.orderStatusLabel')} {t(`orders.status.${workState}`,{ defaultValue:workState })}</Badge><Badge tone={getPaymentStatusTone(paidState)}>{t('orders.list.paymentStatusLabel')} {t(`orders.payment.${paidState}`,{ defaultValue:paidState })}</Badge></div>
        {order.customerNote && <p className="break-words text-sm text-text-secondary">{order.customerNote}</p>}
        <p className="break-words text-xs text-text-secondary">{[user.role !== 'client' && order.customer?.email, order.createdAt && formatDateTime(order.createdAt), isGlobalAdminUser(user) && [order.country?.name, order.region?.name].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}</p>
        <div className="flex flex-wrap items-start justify-between gap-3"><Link to={`/orders/${order.id}`} state={{ from }} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t('orders.buttons.openOrder')}</Link>
          {isGlobalAdminUser(user) && !revoked && <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('operationsCenter.more')}</summary><button type="button" disabled={Boolean(deletingIds[order.id])} onClick={() => remove(order.id)} className="min-h-11 text-sm text-red-700 underline">{t(deletingIds[order.id] ? 'orders.buttons.deleting' : 'orders.buttons.delete')}</button></details>}
        </div>
      </article>;
    })}</div>
    {visible && <PaginationBar page={page} pageSize={pageSize} totalItems={visible.total} pageSizeOptions={[10,20,50]} onPageChange={(value) => update({ page:value })} onPageSizeChange={(value) => update({ limit:value,page:null })} />}
  </div></div>;
}
