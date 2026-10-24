import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import MissionCreationWizard from "../features/mission-creation/MissionCreationWizard";
import { getBookingPath } from "../utils/requestLifecycle";

export default function MissionCreatePage({ serviceOnly = false, unified = false }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preferredCategorySlug = unified ? searchParams.get("categorie") : null;
  if (['mobilite', 'livraison'].includes(preferredCategorySlug)) return <Navigate to={getBookingPath(preferredCategorySlug)} replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-0 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl text-center">
        {serviceOnly || unified ? (
          <Link
            to={unified ? "/demandes" : "/services"}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {unified ? t("serviceOrders.backToRequests") : t("serviceOrders.back")}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
          {serviceOnly || unified
            ? t("serviceOrders.newPageTitle")
            : t("seo.pages.missionCreate.title")}
        </h1>
        {serviceOnly || unified ? (
          <p className="mt-2 text-sm text-text-secondary">
            {t("serviceOrders.newPageHint")}
          </p>
        ) : null}
      </div>
      <div className="mt-8">
        <MissionCreationWizard
          serviceOnly={serviceOnly}
          preferredCategorySlug={preferredCategorySlug}
          onTransportSelected={(slug, countryId) => navigate(`${getBookingPath(slug)}?pays=${encodeURIComponent(countryId)}`)}
        />
      </div>
    </div>
  );
}
