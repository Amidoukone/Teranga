import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, FolderKanban, RefreshCw } from 'lucide-react';

import { getProjects } from '../services/projects';
import { getProperties } from '../services/properties';

function DossierFamily({ icon: Icon, title, description, count, href, action }) {
  return (
    <article className="flex h-full flex-col rounded-[24px] border border-border/70 bg-surface-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="app-toolbar-pill" aria-label={`${title}: ${count}`}>{count}</span>
      </div>
      <h2 className="mt-5 text-lg font-bold text-text-primary">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-text-secondary">{description}</p>
      <Link
        to={href}
        className="btn-primary mt-5 flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
      >
        {action}
      </Link>
    </article>
  );
}

export default function DossiersPage() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState({ projects: 0, properties: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [projects, properties] = await Promise.all([getProjects({}), getProperties()]);
      setCounts({
        projects: Array.isArray(projects) ? projects.length : 0,
        properties: Array.isArray(properties) ? properties.length : 0,
      });
    } catch (_error) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app-page-wrap">
      <div className="app-page-shell space-y-6">
        <header className="rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-7">
          <p className="page-kicker">{t('dossierHub.kicker')}</p>
          <h1 className="app-page-headline">{t('dossierHub.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('dossierHub.subtitle')}</p>
        </header>

        {error ? (
          <div className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3" role="alert">
            <span>{t('dossierHub.loadError')}</span>
            <button type="button" onClick={load} className="app-btn-neutral">
              {t('serviceOrders.retry')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-text-muted" role="status">
            <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
            {t('dossierHub.loading')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <DossierFamily
              icon={Building2}
              title={t('dossierHub.properties.title')}
              description={t('dossierHub.properties.description')}
              count={counts.properties}
              href="/properties"
              action={t('dossierHub.properties.action')}
            />
            <DossierFamily
              icon={FolderKanban}
              title={t('dossierHub.projects.title')}
              description={t('dossierHub.projects.description')}
              count={counts.projects}
              href="/projects"
              action={t('dossierHub.projects.action')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
