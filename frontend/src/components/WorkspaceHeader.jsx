import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CircleHelp, ListChecks } from 'lucide-react';

export default function WorkspaceHeader({ title, hint, children, operations = true }) {
  const { t } = useTranslation();
  return <header className="space-y-5 border-b border-border pb-5">
    <div><p className="text-sm font-medium text-text-secondary">{t('nav.home')}</p><h1 className="app-page-headline mt-1">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{hint}</p></div>
    {children}
    <nav aria-label={t('workspace.shortcuts')} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {operations && <Link to="/operations" className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-700 dark:text-blue-300"><ListChecks size={17} aria-hidden="true" />{t('operations.title')}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
      <Link to="/help-support" className="inline-flex min-h-11 items-center gap-2 text-text-secondary"><CircleHelp size={17} aria-hidden="true" />{t('nav.helpSupport')}</Link>
    </nav>
  </header>;
}
