import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ConnectedHomeIntro({ user, role }) {
  const { t } = useTranslation();
  return <header className="space-y-3">
    <p className="text-sm font-medium text-text-secondary">{t(user?.firstName ? 'connectedHome.greeting' : 'connectedHome.welcome', { name: user?.firstName })}</p>
    <h1 className="app-page-headline">{t('operations.title')}</h1>
    <p className="max-w-2xl text-sm text-text-secondary">{t(`connectedHome.hints.${role}`, { defaultValue: t('workspaceQueue.hint') })}</p>
    {role === 'client' && <div className="flex flex-wrap items-start gap-3">
      <Link to="/demandes/nouvelle" className="btn-primary inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold">{t('nav.newRequest')}</Link>
      <details className="rounded-xl border border-border px-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('connectedHome.transport')}</summary>
        <div className="flex flex-wrap gap-3 pb-3 text-sm"><Link to="/taxi" className="inline-flex min-h-11 items-center underline">{t('serviceOrders.newTaxi')}</Link><Link to="/livraison" className="inline-flex min-h-11 items-center underline">{t('serviceOrders.newDelivery')}</Link></div>
      </details>
    </div>}
  </header>;
}
