import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LifeBuoy,
  MessageSquareWarning,
  ShieldCheck,
  FileText,
  Lock,
  Wrench,
  ClipboardList,
  FolderKanban,
  CheckCircle2,
  Mail,
  Phone,
  ArrowRight,
} from 'lucide-react';

import SettingsSubpageLayout from '../components/SettingsSubpageLayout';

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const requestCards = [
    {
      icon: Wrench,
      title: t('helpSupportPage.requestTypes.cards.service.title'),
      description: t('helpSupportPage.requestTypes.cards.service.description'),
    },
    {
      icon: ClipboardList,
      title: t('helpSupportPage.requestTypes.cards.task.title'),
      description: t('helpSupportPage.requestTypes.cards.task.description'),
    },
    {
      icon: FolderKanban,
      title: t('helpSupportPage.requestTypes.cards.project.title'),
      description: t('helpSupportPage.requestTypes.cards.project.description'),
    },
  ];
  const supportSteps = [
    {
      title: t('helpSupportPage.journey.steps.step1.title'),
      description: t('helpSupportPage.journey.steps.step1.description'),
    },
    {
      title: t('helpSupportPage.journey.steps.step2.title'),
      description: t('helpSupportPage.journey.steps.step2.description'),
    },
    {
      title: t('helpSupportPage.journey.steps.step3.title'),
      description: t('helpSupportPage.journey.steps.step3.description'),
    },
  ];
  const supportChannels = [
    { icon: Mail, value: t('helpSupportPage.contact.channels.email') },
    { icon: Phone, value: t('helpSupportPage.contact.channels.phone') },
  ];

  return (
    <SettingsSubpageLayout
      seoTitle={t('seo.pages.helpSupport.title')}
      seoDescription={t('seo.pages.helpSupport.description')}
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

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-500/30 bg-white/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {t('helpSupportPage.highlights.openToAll')}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-white/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {t('helpSupportPage.highlights.fieldAgents')}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-white/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {t('helpSupportPage.highlights.africaMission')}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('helpSupportPage.requestTypes.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('helpSupportPage.requestTypes.subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {requestCards.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border border-border/80 bg-surface-card p-5"
            >
              <div className="mb-2 flex items-center gap-2 text-text-primary">
                <Icon size={18} />
                <h3 className="text-base font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('helpSupportPage.resources.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('helpSupportPage.resources.subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/account/security"
            className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
          >
            <div className="mb-2 flex items-center gap-2 text-text-primary">
              <ShieldCheck size={18} />
              <h3 className="text-base font-semibold">{t('helpSupportPage.cards.security.title')}</h3>
            </div>
            <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.security.description')}</p>
          </Link>

          <Link
            to="/privacy"
            className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
          >
            <div className="mb-2 flex items-center gap-2 text-text-primary">
              <Lock size={18} />
              <h3 className="text-base font-semibold">{t('helpSupportPage.cards.privacy.title')}</h3>
            </div>
            <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.privacy.description')}</p>
          </Link>

          <Link
            to="/terms"
            className="rounded-2xl border border-border/80 bg-surface-card p-5 transition hover:bg-surface-main/70 hover:border-blue-500/30"
          >
            <div className="mb-2 flex items-center gap-2 text-text-primary">
              <FileText size={18} />
              <h3 className="text-base font-semibold">{t('helpSupportPage.cards.terms.title')}</h3>
            </div>
            <p className="text-sm text-text-secondary">{t('helpSupportPage.cards.terms.description')}</p>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-surface-main/60 p-5">
        <h2 className="text-lg font-semibold text-text-primary">{t('helpSupportPage.journey.title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('helpSupportPage.journey.subtitle')}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {supportSteps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-border/80 bg-surface-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
              </div>
              <p className="text-sm text-text-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-surface-main/60 p-5">
        <div className="mb-2 flex items-center gap-2 text-text-primary">
          <LifeBuoy size={18} />
          <h2 className="text-base font-semibold">{t('helpSupportPage.contact.title')}</h2>
        </div>
        <p className="text-sm text-text-secondary">{t('helpSupportPage.contact.description')}</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {supportChannels.map(({ icon: Icon, value }) => (
              <div key={value} className="flex max-w-full items-start gap-2 text-text-secondary">
                <Icon size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <span className="min-w-0 break-all text-sm leading-snug">{value}</span>
              </div>
            ))}

            <div className="flex items-start gap-2 text-text-secondary">
              <CheckCircle2 size={16} className="mt-0.5 text-blue-600" />
              <span className="text-sm">{t('helpSupportPage.contact.channels.hours')}</span>
            </div>

            <p className="text-xs text-text-muted">{t('helpSupportPage.contact.note')}</p>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface-card p-4">
            <h3 className="text-sm font-semibold text-text-primary">{t('helpSupportPage.contact.actionsTitle')}</h3>
            <p className="mt-2 text-sm text-text-secondary">{t('helpSupportPage.contact.actionsDescription')}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/login" className="btn-primary rounded-full px-4 py-2 text-xs inline-flex items-center gap-2">
                {t('helpSupportPage.contact.actions.login')}
                <ArrowRight size={14} />
              </Link>
              <Link to="/register" className="btn-secondary rounded-full px-4 py-2 text-xs">
                {t('helpSupportPage.contact.actions.register')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SettingsSubpageLayout>
  );
}


