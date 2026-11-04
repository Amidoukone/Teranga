import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const FinancialWorkspace = lazy(() => import('./FinancialWorkspace'));

export default function DossierFinanceSection({ kind, reference, children, title, onSaved, revision, id = 'dossier-finance' }) {
  const { t } = useTranslation();
  const location = useLocation();
  const hasFilters = [...new URLSearchParams(location.search).keys()].some((key) => key.startsWith('paiements_'));
  const initialOpen = (location.hash || window.location.hash) === `#${id}` || hasFilters;
  const [open, setOpen] = useState(initialOpen);
  const [visited, setVisited] = useState(initialOpen);
  const section = useRef(null);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === `#${id}` || hasFilters) { setOpen(true); setVisited(true); }
    };
    reveal(); window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [id, location.hash, hasFilters]);
  return <details ref={section} id={id} open={open} onToggle={(event) => {
    const expanded = event.currentTarget.open;
    setOpen(expanded); if (expanded) setVisited(true);
  }} className="scroll-mt-24 rounded-2xl border border-border bg-surface-card p-4 sm:p-5">
    <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">{title || t('dossier.finance')}</summary>
    <div className="space-y-4 pt-3">
      {children}
      {visited && <Suspense fallback={<p role="status">{t('financialWorkspace.loading')}</p>}>
        <FinancialWorkspace kind={kind} reference={reference} embedded onSaved={onSaved} revision={revision} />
      </Suspense>}
    </div>
  </details>;
}
