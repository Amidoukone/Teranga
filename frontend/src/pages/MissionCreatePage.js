import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import MissionCreationWizard from "../features/mission-creation/MissionCreationWizard";
import { getBookingPath } from "../utils/requestLifecycle";
import { getPropertyById } from '../services/properties';
import { useGeo } from '../contexts/GeoContext';

export default function MissionCreatePage({ serviceOnly = false, unified = false }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, countryId, regionId } = useGeo();
  const preferredCategorySlug = unified ? searchParams.get("categorie") : null;
  if (unified && searchParams.has('bien')) return <PropertyRequest key={JSON.stringify([searchParams.get('bien'), user?.id, countryId, regionId])} id={searchParams.get('bien')} />;
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

function PropertyRequest({ id }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [property, setProperty] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    if (!/^[1-9][0-9]*$/.test(id || '')) { setError(t('propertySimple.inaccessible')); return undefined; }
    getPropertyById(id, { strict: true }).then((result) => { if (current) { setProperty(result); setError(result ? '' : t('propertySimple.inaccessible')); } }).catch(() => { if (current) { setProperty(null); setError(t('propertySimple.inaccessible')); } });
    return () => { current = false; };
  }, [id, attempt, t]);
  return <div className="app-page-wrap"><div className="mx-auto max-w-xl space-y-5">
    <Link to={/^[1-9][0-9]*$/.test(id || '') ? `/properties/${id}` : '/properties'} state={{ from: location.state?.propertyListFrom }} className="inline-flex min-h-11 items-center text-sm underline">{t('propertySimple.backProperty')}</Link>
    <header><h1 className="app-page-headline">{t('propertySimple.request')}</h1>{property && <p className="mt-2 text-sm text-text-secondary">{property.title} · {[property.address, property.city].filter(Boolean).join(', ')}</p>}</header>
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline">{t('financialWorkspace.retry')}</button></p>}
    {!property && !error && <p role="status">{t('common.loading')}</p>}
    {property && <MissionCreationWizard key={property.id} property={property} serviceOnly />}
  </div></div>;
}
