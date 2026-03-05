// ============================================================================
// TermsPage.jsx - Conditions generales d'utilisation - Teranga 2025
// ============================================================================
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { ShieldCheck, Handshake, Ban, LifeBuoy } from "lucide-react";
import SettingsSubpageLayout from "../components/SettingsSubpageLayout";

export default function TermsPage() {
  const { t } = useTranslation();
  const usageItems = [
    t("termsPage.sections.usage.items.accurateInfo"),
    t("termsPage.sections.usage.items.accountSecurity"),
    t("termsPage.sections.usage.items.fraud"),
  ];
  const summaryCards = [
    {
      key: "commitments",
      icon: Handshake,
      title: t("termsPage.summary.cards.commitments.title"),
      description: t("termsPage.summary.cards.commitments.description"),
    },
    {
      key: "security",
      icon: ShieldCheck,
      title: t("termsPage.summary.cards.security.title"),
      description: t("termsPage.summary.cards.security.description"),
    },
    {
      key: "suspension",
      icon: Ban,
      title: t("termsPage.summary.cards.suspension.title"),
      description: t("termsPage.summary.cards.suspension.description"),
    },
  ];
  const quickLinks = [
    {
      key: "security",
      to: "/account/security",
      label: t("termsPage.quickLinks.security"),
    },
    {
      key: "privacy",
      to: "/privacy",
      label: t("termsPage.quickLinks.privacy"),
    },
    {
      key: "support",
      to: "/help-support",
      label: t("termsPage.quickLinks.support"),
    },
  ];

  return (
    <SettingsSubpageLayout
      seoTitle={t("termsPage.seo.title")}
      seoDescription={t("termsPage.seo.description")}
      kicker={t("termsPage.kicker")}
      title={t("termsPage.title")}
      subtitle={t("termsPage.subtitle")}
      contentClassName="mx-auto max-w-4xl"
    >
      <section className="rounded-2xl border border-border/70 bg-surface-main/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text-primary">{t("termsPage.summary.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("termsPage.summary.subtitle")}</p>

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
            <h3 className="text-sm font-semibold">{t("termsPage.quickLinks.title")}</h3>
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
        <p>
          {t("termsPage.intro")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("termsPage.sections.purpose.title")}
        </h2>
        <p>
          {t("termsPage.sections.purpose.details")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("termsPage.sections.usage.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-1 marker:text-text-muted">
          {usageItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("termsPage.sections.agents.title")}
        </h2>
        <p>
          {t("termsPage.sections.agents.details")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("termsPage.sections.suspension.title")}
        </h2>
        <p>
          {t("termsPage.sections.suspension.details")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("termsPage.sections.contact.title")}
        </h2>
        <p>
          <Trans
            i18nKey="termsPage.sections.contact.details"
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
      </section>
    </SettingsSubpageLayout>
  );
}


