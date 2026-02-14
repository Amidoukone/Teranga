// ============================================================================
// LegalPage.jsx — Mentions légales • Teranga 2025
// ============================================================================

import { useTranslation, Trans } from "react-i18next";

export default function LegalPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
        <div className="page-shell max-w-4xl mx-auto p-6 sm:p-10">
          <p className="page-kicker mb-3">{t("legalPage.kicker")}</p>
          <h1 className="page-title mb-6">{t("legalPage.title")}</h1>

          <section className="space-y-4 text-slate-700 leading-relaxed">
            <p>{t("legalPage.intro")}</p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("legalPage.sections.publisher.title")}
            </h2>
            <p>
              <Trans
                i18nKey="legalPage.sections.publisher.details"
                components={{ strong: <strong />, br: <br /> }}
              />
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("legalPage.sections.editorial.title")}
            </h2>
            <p>{t("legalPage.sections.editorial.details")}</p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("legalPage.sections.hosting.title")}
            </h2>
            <p>
              <Trans
                i18nKey="legalPage.sections.hosting.details"
                components={{ strong: <strong />, br: <br /> }}
              />
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("legalPage.sections.ip.title")}
            </h2>
            <p>{t("legalPage.sections.ip.details")}</p>

            <h2 className="text-xl font-semibold text-slate-900 mt-6">
              {t("legalPage.sections.contact.title")}
            </h2>
            <p>
              <Trans
                i18nKey="legalPage.sections.contact.details"
                components={{ strong: <strong />, br: <br /> }}
              />
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
