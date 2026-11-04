import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProductOrderForm, { productUnavailable } from '../orders/ProductOrderForm';

export default function ProductPurchase({ product, access, expanded = false }) {
  const { t } = useTranslation();
  if (access.loading) return <p role="status" className="text-sm">{t('shopFlow.checkingAccess')}</p>;
  if (access.error) return <p role="alert" className="text-sm">{t('shopFlow.accessError')} <button type="button" onClick={access.retry} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>;
  if (productUnavailable(product)) return <p className="text-sm text-text-secondary">{t('shopFlow.unavailable')}</p>;
  if (!access.user) return <Link to="/login" state={{ from: `/products/${product.id}#product-order` }} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm">{t('shopFlow.loginToOrder')}</Link>;
  if (access.user.role !== 'client') return null;
  const form = <ProductOrderForm product={product} user={access.user} />;
  return expanded ? form : <details className="rounded-xl border border-border p-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('productCatalogPage.card.order')}</summary>
    {form}
  </details>;
}
