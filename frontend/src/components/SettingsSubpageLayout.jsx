import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import SetSeo from "./SetSeo";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsSubpageLayout({
  seoTitle,
  seoDescription,
  kicker,
  title,
  subtitle,
  children,
  contentClassName = "",
  showBackToSettings = true,
  settingsPath = "/settings",
  settingsLabel,
  headerActions = null,
}) {
  const { t } = useTranslation();

  return (
    <>
      {seoTitle ? <SetSeo title={seoTitle} description={seoDescription} /> : null}

      <div className="app-page-wrap">
        <div className="app-page-shell">
          <div className={joinClasses("w-full space-y-8", contentClassName)}>
            <header
              className={
                headerActions
                  ? "flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                  : "space-y-2"
              }
            >
              <div className="space-y-2">
                {showBackToSettings ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={settingsPath}
                      className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface-card px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-main/70 hover:text-text-primary"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>{settingsLabel || t("nav.settings")}</span>
                    </Link>
                  </div>
                ) : null}

                {kicker ? <p className="page-kicker">{kicker}</p> : null}
                {title ? <h1 className="app-page-headline">{title}</h1> : null}
                {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
              </div>

              {headerActions ? (
                <div className="flex flex-wrap gap-2">{headerActions}</div>
              ) : null}
            </header>

            {children}
          </div>
        </div>
      </div>
    </>
  );
}
