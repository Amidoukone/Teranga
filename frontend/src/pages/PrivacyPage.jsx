// ============================================================================
// PrivacyPage.jsx - Politique de confidentialite RGPD - Teranga 2025
// ============================================================================
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { Database, ShieldCheck, Scale, LifeBuoy } from "lucide-react";
import SettingsSubpageLayout from "../components/SettingsSubpageLayout";

export default function PrivacyPage() {
  const { t } = useTranslation();
  const collectedItems = [
    t("privacyPage.sections.collected.items.identification"),
    t("privacyPage.sections.collected.items.connection"),
    t("privacyPage.sections.collected.items.services"),
    t("privacyPage.sections.collected.items.evidence"),
  ];
  const purposes = [
    t("privacyPage.sections.purposes.items.account"),
    t("privacyPage.sections.purposes.items.execute"),
    t("privacyPage.sections.purposes.items.security"),
    t("privacyPage.sections.purposes.items.tracking"),
  ];
  const rights = [
    t("privacyPage.sections.rights.items.access"),
    t("privacyPage.sections.rights.items.rectification"),
    t("privacyPage.sections.rights.items.deletion"),
    t("privacyPage.sections.rights.items.objection"),
    t("privacyPage.sections.rights.items.portability"),
  ];
  const summaryCards = [
    {
      key: "collection",
      icon: Database,
      title: t("privacyPage.summary.cards.collection.title"),
      description: t("privacyPage.summary.cards.collection.description"),
    },
    {
      key: "security",
      icon: ShieldCheck,
      title: t("privacyPage.summary.cards.security.title"),
      description: t("privacyPage.summary.cards.security.description"),
    },
    {
      key: "rights",
      icon: Scale,
      title: t("privacyPage.summary.cards.rights.title"),
      description: t("privacyPage.summary.cards.rights.description"),
    },
  ];
  const quickLinks = [
    {
      key: "security",
      to: "/account/security",
      label: t("privacyPage.quickLinks.security"),
    },
    {
      key: "terms",
      to: "/terms",
      label: t("privacyPage.quickLinks.terms"),
    },
    {
      key: "support",
      to: "/help-support",
      label: t("privacyPage.quickLinks.support"),
    },
  ];

  return (
    <SettingsSubpageLayout
      seoTitle={t("privacyPage.seo.title")}
      seoDescription={t("privacyPage.seo.description")}
      kicker={t("privacyPage.kicker")}
      title={t("privacyPage.title")}
      subtitle={t("privacyPage.subtitle")}
      contentClassName="mx-auto max-w-4xl"
    >
      <section className="rounded-2xl border border-border/70 bg-surface-main/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text-primary">{t("privacyPage.summary.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("privacyPage.summary.subtitle")}</p>

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
            <h3 className="text-sm font-semibold">{t("privacyPage.quickLinks.title")}</h3>
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
          {t("privacyPage.intro")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("privacyPage.sections.collected.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-1 marker:text-text-muted">
          {collectedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("privacyPage.sections.purposes.title")}
        </h2>
        <p>{t("privacyPage.sections.purposes.lead")}</p>
        <ul className="list-disc pl-6 space-y-1 marker:text-text-muted">
          {purposes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("privacyPage.sections.retention.title")}
        </h2>
        <p>
          {t("privacyPage.sections.retention.details")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("privacyPage.sections.sharing.title")}
        </h2>
        <p>
          {t("privacyPage.sections.sharing.details")}
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-6">
          {t("privacyPage.sections.rights.title")}
        </h2>
        <ul className="list-disc pl-6 space-y-1 marker:text-text-muted">
          {rights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p>
          <Trans
            i18nKey="privacyPage.sections.rights.contact"
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
      </section>
    </SettingsSubpageLayout>
  );
}


