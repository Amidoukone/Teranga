import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function revealSection(hash) {
  const section = document.getElementById(hash.replace(/^#/, ''));
  if (section?.tagName === 'DETAILS') section.open = true;
  section?.scrollIntoView?.({ block: 'start' });
}

export default function DossierHeader({ kind, id, title, description, status, assignee, children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const from = location.state?.from;
  const back = typeof from === 'string' && /^\/(?:operations|projects|orders|transactions|(?:services|projects|orders)\/[1-9][0-9]*\/transactions)(?:\?[^#\\\r\n]*)?$/.test(from) ? from : `/${kind === 'project' ? 'projects' : 'orders'}`;
  useEffect(() => {
    const revealHash = () => revealSection(window.location.hash);
    const frame = window.requestAnimationFrame(revealHash);
    window.addEventListener('hashchange', revealHash);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('hashchange', revealHash); };
  }, []);
  return <header className="space-y-4 border-b border-border pb-5">
    <Link to={back} className="inline-flex min-h-11 items-center text-sm underline">{t(back.split('?')[0].endsWith('/transactions') ? 'financialWorkspace.backJournal' : 'dossier.back')}</Link>
    <div>
      <p className="page-kicker">{t(`dossier.${kind}`)} #{id}</p>
      <h1 className="app-page-headline break-words">{title}</h1>
      {description && <p className="mt-2 max-w-2xl whitespace-pre-line break-words text-sm text-text-secondary">{description}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-3">{status}{children}</div>
    <p className="text-sm text-text-secondary">{t('dossier.executor')}: {assignee || t('dossier.assignmentPending')}</p>
    <nav aria-label={t('dossier.sections')} className="grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:flex sm:flex-wrap sm:text-sm">
      <a href="#dossier-realisation" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border p-2">{t('dossier.realisation')}</a>
      <a href={`#${kind === 'project' ? 'project-documents' : 'order-evidences'}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border p-2">{t('dossier.documents')}</a>
      <a href="#dossier-finance" onClick={() => revealSection('#dossier-finance')} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border p-2">{t('dossier.finance')}</a>
    </nav>
  </header>;
}

export function DossierNextAction({ kind, status, role, assigned, coordinated = true }) {
  const { t } = useTranslation();
  const closed = kind === 'project' ? ['validated', 'cancelled'].includes(status) : ['delivered', 'fulfilled', 'cancelled', 'refunded'].includes(status);
  const review = coordinated && kind === 'project' && status === 'completed';
  const actionable = !closed && !review && (role === 'admin' || (role === 'agent' && assigned));
  const legacy = !closed && !coordinated && role === 'admin';
  const message = closed ? 'closed' : review ? (role === 'client' ? 'review' : 'waitingReview') : legacy ? 'legacy' : actionable ? 'continue' : 'following';
  const target = review || closed ? `#${kind === 'project' ? 'project-documents' : 'order-evidences'}` : legacy ? '#dossier-details' : '#dossier-realisation';
  return <section className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4 sm:p-5" aria-label={t('dossier.next')}>
    <h2 className="font-bold">{t('dossier.next')}</h2>
    <p className="mt-2 text-sm text-text-secondary">{t(`dossier.nextHints.${message}`)}</p>
    <a href={target} onClick={() => revealSection(target)} className="btn-primary mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">{t(review || closed ? 'dossier.examine' : legacy ? 'dossier.tools' : 'dossier.openRealisation')}</a>
  </section>;
}
