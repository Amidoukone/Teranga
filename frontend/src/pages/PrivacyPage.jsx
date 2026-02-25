// ============================================================================
// PrivacyPage.jsx - Politique de confidentialite RGPD - Teranga 2025
// ============================================================================
import { useTranslation, Trans } from "react-i18next";
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

  return (
    <SettingsSubpageLayout
      seoTitle={t("privacyPage.seo.title")}
      seoDescription={t("privacyPage.seo.description")}
      kicker={t("privacyPage.kicker")}
      title={t("privacyPage.title")}
      contentClassName="mx-auto max-w-4xl"
    >
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


