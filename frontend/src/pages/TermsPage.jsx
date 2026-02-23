// ============================================================================
// TermsPage.jsx - Conditions generales d'utilisation - Teranga 2025
// ============================================================================
import SetSeo from "../components/SetSeo";
import { useTranslation, Trans } from "react-i18next";

export default function TermsPage() {
  const { t } = useTranslation();
  const usageItems = [
    t("termsPage.sections.usage.items.accurateInfo"),
    t("termsPage.sections.usage.items.accountSecurity"),
    t("termsPage.sections.usage.items.fraud"),
  ];

  return (
    <>
      <SetSeo
        title={t("termsPage.seo.title")}
        description={t("termsPage.seo.description")}
      />

      <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
        <div className="page-shell max-w-4xl mx-auto p-6 sm:p-10">
          <p className="page-kicker mb-3">{t("termsPage.kicker")}</p>
          <h1 className="page-title mb-6">
            {t("termsPage.title")}
          </h1>

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
        </div>
      </div>
    </>
  );
}


