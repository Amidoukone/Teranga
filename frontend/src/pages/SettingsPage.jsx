import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  LifeBuoy,
  FileText,
  Lock,
  BookOpenCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

import SetSeo from '../components/SetSeo';
import {
  getStoredTheme,
  resolveTheme,
  setThemePreference,
  normalizeTheme,
} from '../utils/theme';

const THEME_OPTIONS = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

export default function SettingsPage() {
  const { t } = useTranslation();
  const [themePreference, setThemePreferenceState] = useState(() => getStoredTheme());

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );

  useEffect(() => {
    function onThemeChanged(event) {
      const nextPreference = normalizeTheme(event?.detail?.preference || getStoredTheme());
      setThemePreferenceState(nextPreference);
    }

    window.addEventListener('teranga_theme_changed', onThemeChanged);
    return () => window.removeEventListener('teranga_theme_changed', onThemeChanged);
  }, []);

  const handleThemeChange = (nextTheme) => {
    const { preference } = setThemePreference(nextTheme);
    setThemePreferenceState(preference);
  };

  const quickLinks = [
    {
      key: 'security',
      to: '/account/security',
      icon: ShieldCheck,
      titleKey: 'settingsPage.quick.securityTitle',
      descKey: 'settingsPage.quick.securityDesc',
    },
    {
      key: 'support',
      to: '/help-support',
      icon: LifeBuoy,
      titleKey: 'settingsPage.quick.supportTitle',
      descKey: 'settingsPage.quick.supportDesc',
    },
    {
      key: 'privacy',
      to: '/privacy',
      icon: Lock,
      titleKey: 'settingsPage.quick.privacyTitle',
      descKey: 'settingsPage.quick.privacyDesc',
    },
    {
      key: 'terms',
      to: '/terms',
      icon: FileText,
      titleKey: 'settingsPage.quick.termsTitle',
      descKey: 'settingsPage.quick.termsDesc',
    },
    {
      key: 'legal',
      to: '/legal',
      icon: BookOpenCheck,
      titleKey: 'settingsPage.quick.legalTitle',
      descKey: 'settingsPage.quick.legalDesc',
    },
  ];

  return (
    <>
      <SetSeo
        title={t('seo.pages.settings.title')}
        description={t('seo.pages.settings.description')}
      />

      <div className="app-page-wrap">
        <div className="app-page-shell space-y-8">
          <header className="space-y-2">
            <p className="page-kicker">{t('settingsPage.kicker')}</p>
            <h1 className="app-page-headline">{t('settingsPage.title')}</h1>
            <p className="app-page-subtitle">{t('settingsPage.subtitle')}</p>
          </header>

          <section className="rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-text-primary">
              <Sparkles size={18} />
              <h2 className="text-lg font-semibold">{t('settingsPage.overview.title')}</h2>
            </div>
            <p className="mb-4 text-sm text-text-secondary">{t('settingsPage.overview.description')}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {['p1', 'p2', 'p3'].map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-border/70 bg-surface-main/60 px-4 py-3 text-sm text-text-secondary"
                >
                  <div className="mb-2 flex items-center gap-2 text-text-primary">
                    <CheckCircle2 size={16} />
                    <span className="font-medium">{t(`settingsPage.overview.points.${point}`)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-surface-main/60 p-5">
            <div className="mb-4 flex items-center gap-2 text-text-primary">
              <Sun size={18} />
              <h2 className="text-lg font-semibold">{t('settingsPage.theme.title')}</h2>
            </div>

            <p className="mb-4 text-sm text-text-secondary">{t('settingsPage.theme.description')}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = themePreference === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleThemeChange(option.key)}
                    className={[
                      'flex flex-col items-start justify-start gap-1 rounded-xl border px-4 py-3 text-left transition',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/80 bg-surface-card text-text-secondary hover:bg-surface-main/70 hover:text-text-primary',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} />
                      <span className="font-semibold">{t(`settingsPage.theme.options.${option.key}`)}</span>
                    </div>
                    <p className="text-xs opacity-80">
                      {t(`settingsPage.theme.help.${option.key}`)}
                    </p>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-text-muted">
              {t('settingsPage.theme.currentResolved', { mode: t(`settingsPage.theme.options.${resolvedTheme}`) })}
            </p>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-text-primary">{t('settingsPage.quickSection.title')}</h2>
              <p className="text-sm text-text-secondary">{t('settingsPage.quickSection.subtitle')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.key}
                    to={link.to}
                    className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-text-primary">
                        <Icon size={18} />
                        <h3 className="font-semibold">{t(link.titleKey)}</h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        {t('settingsPage.quick.open')}
                        <ArrowRight size={14} />
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{t(link.descKey)}</p>
                  </Link>
                );
              })}
            </div>

            <p className="text-xs text-text-muted">{t('settingsPage.quickSection.footer')}</p>
          </section>
        </div>
      </div>
    </>
  );
}


