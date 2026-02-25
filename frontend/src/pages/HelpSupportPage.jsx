import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, MessageSquareWarning, ShieldCheck, FileText, Lock } from 'lucide-react';

import SettingsSubpageLayout from '../components/SettingsSubpageLayout';

export default function HelpSupportPage() {
  const { t } = useTranslation();

  return (
    <SettingsSubpageLayout
      seoTitle={t('seo.pages.helpSupport.title')}
      kicker={t('helpSupportPage.kicker')}
      title={t('helpSupportPage.title')}
      subtitle={t('helpSupportPage.subtitle')}
    >
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/15 p-5 text-amber-800 dark:text-amber-300">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <MessageSquareWarning size={18} />
          <span>{t('helpSupportPage.comingSoon.title')}</span>
        </div>
        <p className="text-sm">{t('helpSupportPage.comingSoon.description')}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          to="/account/security"
          className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
        >
          <div className="mb-2 flex items-center gap-2 text-text-primary">
            <ShieldCheck size={18} />
            <h2 className="text-base font-semibold">{t('helpSupportPage.cards.security.title')}</h2>
          </div>
          <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.security.description')}</p>
        </Link>

        <Link
          to="/privacy"
          className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
        >
          <div className="mb-2 flex items-center gap-2 text-text-primary">
            <Lock size={18} />
            <h2 className="text-base font-semibold">{t('helpSupportPage.cards.privacy.title')}</h2>
          </div>
          <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.privacy.description')}</p>
        </Link>

        <Link
          to="/terms"
          className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
        >
          <div className="mb-2 flex items-center gap-2 text-text-primary">
            <FileText size={18} />
            <h2 className="text-base font-semibold">{t('helpSupportPage.cards.terms.title')}</h2>
          </div>
          <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.terms.description')}</p>
        </Link>
      </section>

      <section className="rounded-2xl border border-border/80 bg-surface-main/60 p-5">
        <div className="mb-2 flex items-center gap-2 text-text-primary">
          <LifeBuoy size={18} />
          <h2 className="text-base font-semibold">{t('helpSupportPage.contact.title')}</h2>
        </div>
        <p className="text-sm text-text-secondary">{t('helpSupportPage.contact.description')}</p>
      </section>
    </SettingsSubpageLayout>
  );
}


