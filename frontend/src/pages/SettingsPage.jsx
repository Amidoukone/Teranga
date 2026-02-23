import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Monitor, ShieldCheck, LifeBuoy, FileText, Lock } from 'lucide-react';

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

  return (
    <>
      <SetSeo title={t('seo.pages.settings.title')} />

      <div className="app-page-wrap">
        <div className="app-page-shell space-y-8">
          <header className="space-y-2">
            <p className="page-kicker">{t('settingsPage.kicker')}</p>
            <h1 className="app-page-headline">{t('settingsPage.title')}</h1>
            <p className="app-page-subtitle">{t('settingsPage.subtitle')}</p>
          </header>

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
                      'rounded-xl border px-4 py-3 text-left transition',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/80 bg-surface-card text-text-secondary hover:bg-surface-main/70 hover:text-text-primary',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <div className="mb-1 flex items-center gap-2">
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

          <section className="grid gap-4 md:grid-cols-2">
            <Link
              to="/account/security"
              className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70"
            >
              <div className="mb-2 flex items-center gap-2 text-text-primary">
                <ShieldCheck size={18} />
                <h3 className="font-semibold">{t('settingsPage.quick.securityTitle')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t('settingsPage.quick.securityDesc')}</p>
            </Link>

            <Link
              to="/help-support"
              className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70"
            >
              <div className="mb-2 flex items-center gap-2 text-text-primary">
                <LifeBuoy size={18} />
                <h3 className="font-semibold">{t('settingsPage.quick.supportTitle')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t('settingsPage.quick.supportDesc')}</p>
            </Link>

            <Link
              to="/privacy"
              className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70"
            >
              <div className="mb-2 flex items-center gap-2 text-text-primary">
                <Lock size={18} />
                <h3 className="font-semibold">{t('settingsPage.quick.privacyTitle')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t('settingsPage.quick.privacyDesc')}</p>
            </Link>

            <Link
              to="/terms"
              className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70"
            >
              <div className="mb-2 flex items-center gap-2 text-text-primary">
                <FileText size={18} />
                <h3 className="font-semibold">{t('settingsPage.quick.termsTitle')}</h3>
              </div>
              <p className="text-sm text-text-secondary">{t('settingsPage.quick.termsDesc')}</p>
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}


