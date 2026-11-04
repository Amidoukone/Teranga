import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ShopSignIn() {
  const { t } = useTranslation();
  const location = useLocation();
  return <div className="app-page-wrap"><div className="app-page-shell max-w-2xl space-y-4">
    <h1 className="app-page-headline">{t('productCatalogPage.header.title')}</h1>
    <p className="text-text-secondary">{t('shopFlow.loginToBrowse')}</p>
    <Link to="/login" state={{ from: location.pathname + location.search + location.hash }} className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4">{t('shopFlow.loginToOrder')}</Link>
  </div></div>;
}
