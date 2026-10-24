import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildTelHref, buildWhatsappHref } from '../utils/phone';

export default function RequestHelp({ id, title = '', phone }) {
  const { t } = useTranslation();
  const tel = buildTelHref(phone);
  const whatsapp = buildWhatsappHref(phone, t('requestHelp.message', { id, title }));
  const email = t('homePage.contact.info.email');
  return <section className="rounded-2xl border border-border bg-surface-card p-4" aria-label={t('requestHelp.title')}>
    <h2 className="font-semibold">{t('requestHelp.title')}</h2>
    <p className="mt-1 text-sm text-text-secondary">{t('requestHelp.reference', { id })}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {tel && <a href={tel} className="btn-secondary min-h-11 rounded-xl px-4 py-3 text-sm">{t('requestHelp.call')}</a>}
      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-primary min-h-11 rounded-xl px-4 py-3 text-sm">{t('requestHelp.whatsapp')}</a>}
      <Link to={`/help-support?demande=${encodeURIComponent(id)}`} className="btn-secondary min-h-11 rounded-xl px-4 py-3 text-sm">{t('requestHelp.options')}</Link>
      {!tel && email.includes('@') && <a href={`mailto:${email}?subject=${encodeURIComponent(`Teranga #${id}`)}&body=${encodeURIComponent(t('requestHelp.message', { id, title }))}`} className="btn-secondary min-h-11 rounded-xl px-4 py-3 text-sm">{t('requestHelp.email')}</a>}
    </div>
    {!tel && <p className="mt-2 text-sm text-text-secondary">{t('requestHelp.missing')}</p>}
  </section>;
}
