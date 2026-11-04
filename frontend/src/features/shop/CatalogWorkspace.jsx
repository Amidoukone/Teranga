import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../../contexts/GeoContext';
import { useLocale } from '../../i18n/useLocale';
import { getProducts } from '../../services/products';
import { getCategories } from '../../services/categories';
import PaginationBar from '../../components/PaginationBar';
import ProductPurchase from './ProductPurchase';
import useShopAccess from './useShopAccess';
import { getProductImages } from './productDisplay';
import ShopSignIn from './ShopSignIn';

const fieldClass = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface-main p-3 text-sm';
const sorts = ['price_asc', 'price_desc', 'name_asc', 'name_desc', 'stock_desc'];
const sortLabels = ['sortPriceAsc', 'sortPriceDesc', 'sortNameAsc', 'sortNameDesc', 'sortStockDesc'];
const positiveInt = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export default function CatalogWorkspace() {
  const { user, countryId, regionId, isAuthenticated } = useGeo();
  if (!isAuthenticated) return <ShopSignIn />;
  return <Catalogue key={JSON.stringify([user?.id, user?.role, countryId, regionId, isAuthenticated])} isAuthenticated={isAuthenticated} />;
}

function Catalogue({ isAuthenticated }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const page = positiveInt(params.get('page'), 1);
  const limit = [12, 24, 48].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 12;
  const [search, setSearch] = useState(params.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const access = useShopAccess(isAuthenticated);
  const [moreFilters, setMoreFilters] = useState(Boolean(params.get('priceMin') || params.get('priceMax') || params.get('sort')));
  useEffect(() => { setSearch(new URLSearchParams(query).get('q') || ''); }, [query]);
  useEffect(() => {
    let current = true;
    getCategories({ limit: 200 }).then((result) => { if (current) setCategories(Array.isArray(result) ? result : []); }).catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    const filters = new URLSearchParams(query);
    const request = { page, limit };
    for (const field of ['q', 'categoryId', 'priceMin', 'priceMax']) {
      if (filters.get(field)?.trim()) request[field] = filters.get(field).trim();
    }
    if (sorts.includes(filters.get('sort'))) request.sort = filters.get('sort');
    setLoading(true);
    getProducts(request, { withPagination: true }).then((result) => {
      if (!current) return;
      const items = result?.items || [];
      setProducts(items); setTotal(result?.pagination?.total ?? result?.pagination?.count ?? items.length); setError('');
    }).catch((failure) => {
      if (!current) return;
      setError(failure?.response?.data?.error || t('productCatalogPage.errors.load'));
      if ([401, 403, 404].includes(failure?.response?.status)) { setProducts([]); setTotal(0); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query, page, limit, attempt, t]);

  function update(changes) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('page');
      Object.entries(changes).forEach(([name, value]) => { if (value !== '' && value != null) next.set(name, String(value)); else next.delete(name); });
      return next;
    }, { preventScrollReset: true });
  }
  const from = location.pathname + location.search;
  return <div className="app-page-wrap"><div className="app-page-shell max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="app-page-headline">{t('productCatalogPage.header.title')}</h1><p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('shopFlow.catalogueHint')}</p></div>
      {['client', 'admin', 'agent'].includes(access.user?.role) && <Link to="/orders" className="min-h-11 rounded-xl border border-border px-4 py-3 text-sm underline">{t(access.user.role === 'client' ? 'ordersSimple.clientTitle' : 'ordersSimple.title')}</Link>}
    </header>
    <section aria-label={t('productCatalogPage.header.filtersHint')} className="space-y-3 rounded-2xl border border-border bg-surface-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={(event) => { event.preventDefault(); update({ q: search.trim() }); }} className="flex flex-1 items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">{t('productCatalogPage.filters.searchLabel')}<input value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} /></label>
          <button type="submit" className="btn-primary min-h-11 rounded-xl px-4 text-sm">{t('financialWorkspace.find')}</button>
        </form>
        <label className="text-sm sm:w-56">{t('productCatalogPage.filters.categoryLabel')}<select value={params.get('categoryId') || ''} onChange={(event) => update({ categoryId: event.target.value })} className={fieldClass}>
          <option value="">{t('productCatalogPage.filters.categoryAll')}</option>
          {params.get('categoryId') && !categories.some((category) => String(category.id) === params.get('categoryId')) && <option value={params.get('categoryId')}>{t('productCatalogPage.categoryFallback', { id: params.get('categoryId') })}</option>}
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
      </div>
      <details open={moreFilters} onToggle={(event) => setMoreFilters(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm">{t('shopFlow.moreFilters')}</summary>
        <div className="grid gap-3 sm:grid-cols-3">
          {['priceMin', 'priceMax'].map((name) => <label key={name} className="text-sm">{t(`productCatalogPage.filters.${name}Label`)}<input type="number" min="0" step="any" value={params.get(name) || ''} onChange={(event) => update({ [name]: event.target.value })} className={fieldClass} /></label>)}
          <label className="text-sm">{t('productCatalogPage.filters.sortLabel')}<select value={params.get('sort') || ''} onChange={(event) => update({ sort: event.target.value })} className={fieldClass}>
            <option value="">{t('productCatalogPage.filters.sortDefault')}</option>
            {sorts.map((value, index) => <option key={value} value={value}>{t(`productCatalogPage.filters.${sortLabels[index]}`)}</option>)}
          </select></label>
        </div>
      </details>
      {['q', 'categoryId', 'priceMin', 'priceMax', 'sort'].some((name) => params.get(name)) && <button type="button" className="min-h-11 text-sm underline" onClick={() => update({ q: '', categoryId: '', priceMin: '', priceMax: '', sort: '' })}>{t('productCatalogPage.filters.reset')}</button>}
    </section>
    {error && <p role="alert" className="app-alert app-alert-error">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    <div aria-busy={loading} className="space-y-4">
      {loading && <p role="status" className="text-sm">{t('productCatalogPage.loading')}</p>}
      {!loading && !error && products.length === 0 && <p className="rounded-xl border border-border p-5">{t(query ? 'productCatalogPage.empty.noResults' : 'productCatalogPage.empty.noProducts')}</p>}
      <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const image = getProductImages(product)[0];
          return <article key={product.id} aria-label={product.name} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-card">
            {image && <Link to={`/products/${product.id}`} state={{ from }} tabIndex={-1} aria-hidden="true"><img src={image} alt="" loading="lazy" className="h-44 w-full object-cover" /></Link>}
            <div className="space-y-3 p-4">
              <h2 className="text-lg font-bold"><Link to={`/products/${product.id}`} state={{ from }} className="inline-flex min-h-11 items-center underline decoration-transparent hover:decoration-current">{product.name}</Link></h2>
              {product.category?.name && <p className="text-xs text-text-secondary">{product.category.name}</p>}
              <p className="line-clamp-3 break-words text-sm text-text-secondary">{product.description || t('productCatalogPage.card.noDescription')}</p>
              <div className="flex flex-wrap justify-between gap-2 text-sm"><p className="font-bold">{formatNumber(product.price || 0)} {product.currency || 'XOF'}</p>
                {product.stock != null && <p className="text-text-secondary">{Number(product.stock) > 0 ? t('productCatalogPage.card.stockAvailable', { count: Number(product.stock) }) : t('productCatalogPage.card.stockOut')}</p>}
              </div>
              <ProductPurchase product={product} access={access} />
            </div>
          </article>;
        })}
      </div>
      <PaginationBar page={page} pageSize={limit} totalItems={total} pageSizeOptions={[12, 24, 48]} onPageChange={(value) => update({ page: value })} onPageSizeChange={(value) => update({ limit: value })} />
    </div>
  </div></div>;
}
