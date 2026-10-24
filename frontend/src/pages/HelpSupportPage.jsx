import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGeo } from '../contexts/GeoContext';
import useTerritorySupport from '../hooks/useTerritorySupport';
import { getServiceById } from '../services/services';
import { getMissionTrack } from '../services/missions';
import { buildTelHref, buildWhatsappHref } from '../utils/phone';
import SetSeo from '../components/SetSeo';

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const geo = useGeo();
  const local = useTerritorySupport();
  const id = /^\d+$/.test(params.get('demande') || '') ? params.get('demande') : null;
  const [request, setRequest] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRequest(null); setFailed(false);
    if (!id || !geo.user) { setLoading(false); return undefined; }
    setLoading(true);
    const load = geo.user.role === 'provider' ? getMissionTrack(id, { skipEta: 1 }) : getServiceById(id);
    load.then((value) => { if (active) setRequest(value); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, geo.user, attempt]);
  // Une référence précise utilise son propre territoire, jamais celui du compte par défaut.
  const phone = id ? request?.assistancePhone : local.phone;
  const message = id ? t('requestHelp.message', { id, title: request?.title || '' }) : t('serviceOrders.quickAccess.whatsappMessage');
  const tel = buildTelHref(phone);
  const whatsapp = buildWhatsappHref(phone, message);
  const email = t('homePage.contact.info.email');
  const requestsPath = { client: '/demandes', agent: '/agent/services', provider: '/dashboard', admin: '/admin/operations' }[geo.user?.role] || '/login';
  return <div className="app-page-wrap"><div className="app-page-shell max-w-3xl space-y-5">
    <SetSeo title={t('seo.pages.helpSupport.title')} />
    <header><h1 className="app-page-headline">{t('requestHelp.title')}</h1><p className="mt-2 text-text-secondary">{t('requestHelp.hint')}</p></header>
    {id && <p className="rounded-xl border border-border p-3 text-sm">{t('requestHelp.reference', { id })}</p>}
    {loading && <p role="status">{t('serviceOrders.loading')}</p>}
    {failed && <p role="alert">{t('requestHelp.loadError')} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="underline">{t('serviceOrders.retry')}</button></p>}
    <section className="rounded-2xl border border-border bg-surface-card p-5">
      <h2 className="font-semibold">{t('requestHelp.contact')}</h2>
      <div className="mt-4 flex flex-wrap gap-3">{tel && <a href={tel} className="btn-secondary min-h-12 rounded-xl px-5 py-3">{t('requestHelp.call')}</a>}{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-primary min-h-12 rounded-xl px-5 py-3">{t('requestHelp.whatsapp')}</a>}</div>
      {!loading && !tel && <p className="mt-3 text-sm text-text-secondary">{t('requestHelp.missing')}</p>}
      {!loading && !tel && email.includes('@') && <a href={`mailto:${email}?subject=${encodeURIComponent(id ? `Teranga #${id}` : 'Teranga')}&body=${encodeURIComponent(message)}`} className="btn-secondary mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm">{t('requestHelp.email')}</a>}
    </section>
    <nav aria-label={t('requestHelp.options')} className="grid gap-3 sm:grid-cols-2">
      <Link to={requestsPath} className="btn-secondary min-h-12 rounded-xl px-4 py-3 text-center">{t('requestHelp.findRequest')}</Link>
      <Link to={geo.user ? '/settings' : '/login'} className="btn-secondary min-h-12 rounded-xl px-4 py-3 text-center">{t('nav.security')}</Link>
    </nav>
    <details className="rounded-2xl border border-border p-4"><summary className="cursor-pointer font-semibold">{t('requestHelp.resources')}</summary><div className="mt-3 flex flex-wrap gap-4 text-sm"><Link to="/terms">{t('footer.links.terms')}</Link><Link to="/privacy">{t('footer.links.privacy')}</Link></div></details>
  </div></div>;
}
