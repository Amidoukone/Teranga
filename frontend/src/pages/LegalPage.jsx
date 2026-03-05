// ============================================================================
// LegalPage.jsx Teranga 2025
// ============================================================================

import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { ShieldCheck, Scale, FileCheck2, LifeBuoy } from "lucide-react";
import SettingsSubpageLayout from "../components/SettingsSubpageLayout";

export default function LegalPage() {
  const { t } = useTranslation();
  const summaryCards = [
    {
      key: "publisher",
      icon: FileCheck2,
      title: t("legalPage.summary.cards.publisher.title"),
      description: t("legalPage.summary.cards.publisher.description"),
    },
    {
      key: "responsibility",
      icon: Scale,
      title: t("legalPage.summary.cards.responsibility.title"),
      description: t("legalPage.summary.cards.responsibility.description"),
    },
    {
      key: "compliance",
      icon: ShieldCheck,
      title: t("legalPage.summary.cards.compliance.title"),
      description: t("legalPage.summary.cards.compliance.description"),
    },
  ];
  const quickLinks = [
    {
      key: "security",
      to: "/account/security",
      label: t("legalPage.quickLinks.security"),
    },
    {
      key: "privacy",
      to: "/privacy",
      label: t("legalPage.quickLinks.privacy"),
    },
    {
      key: "terms",
      to: "/terms",
      label: t("legalPage.quickLinks.terms"),
    },
    {
      key: "support",
      to: "/help-support",
      label: t("legalPage.quickLinks.support"),
    },
  ];

  return (
    <SettingsSubpageLayout
      kicker={t("legalPage.kicker")}
      title={t("legalPage.title")}
      subtitle={t("legalPage.subtitle")}
      contentClassName="mx-auto max-w-4xl"
    >
      <section className="rounded-2xl border border-border/70 bg-surface-main/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text-primary">{t("legalPage.summary.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("legalPage.summary.subtitle")}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className="rounded-xl border border-border/70 bg-surface-card p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-text-primary">
                  <Icon className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">{card.title}</h3>
                </div>
                <p className="text-sm text-text-secondary">{card.description}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-surface-card p-4">
          <div className="mb-2 flex items-center gap-2 text-text-primary">
            <LifeBuoy className="h-4 w-4" />
            <h3 className="text-sm font-semibold">{t("legalPage.quickLinks.title")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className="inline-flex items-center rounded-lg border border-border/70 bg-surface-main/60 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-main hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface-card/70 p-5 sm:p-8 space-y-4 text-text-secondary leading-relaxed">
        <p>{t("legalPage.intro")}</p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("legalPage.sections.publisher.title")}
        </h2>
        <p>
          <Trans
            i18nKey="legalPage.sections.publisher.details"
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("legalPage.sections.editorial.title")}
        </h2>
        <p>{t("legalPage.sections.editorial.details")}</p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("legalPage.sections.hosting.title")}
        </h2>
        <p>
          <Trans
            i18nKey="legalPage.sections.hosting.details"
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("legalPage.sections.ip.title")}
        </h2>
        <p>{t("legalPage.sections.ip.details")}</p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("legalPage.sections.contact.title")}
        </h2>
        <p>
          <Trans
            i18nKey="legalPage.sections.contact.details"
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
      </section>
    </SettingsSubpageLayout>
  );
}
