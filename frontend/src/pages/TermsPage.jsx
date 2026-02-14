// ============================================================================
// TermsPage.jsx — Conditions générales d'utilisation • Teranga 2025
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

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
        <div className="page-shell max-w-4xl mx-auto p-6 sm:p-10">
          <p className="page-kicker mb-3">{t("termsPage.kicker")}</p>
          <h1 className="page-title mb-6">
            {t("termsPage.title")}
          </h1>

          <section className="space-y-4 text-slate-700 leading-relaxed">

            <p>
              {t("termsPage.intro")}
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("termsPage.sections.purpose.title")}
            </h2>
            <p>
              {t("termsPage.sections.purpose.details")}
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("termsPage.sections.usage.title")}
            </h2>
            <ul className="list-disc pl-6">
              {usageItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("termsPage.sections.agents.title")}
            </h2>
            <p>
              {t("termsPage.sections.agents.details")}
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("termsPage.sections.suspension.title")}
            </h2>
            <p>
              {t("termsPage.sections.suspension.details")}
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
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
