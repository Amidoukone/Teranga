import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, CarFront, Loader2, MapPin, Phone, RefreshCw } from "lucide-react";

import { useGeo } from "../contexts/GeoContext";
import { getTradeCategories } from "../services/missionRequests";
import { createPhoneOrder, getTaxiDispatchQueue } from "../services/missions";
import CategoryPicker from "../features/mission-creation/CategoryPicker";
import LocationAutocompleteInput from "../features/mission-creation/LocationAutocompleteInput";
import MissionLocationMap from "../features/mission-creation/MissionLocationMap";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import MobilityDispatchPanel from "../features/mobility/MobilityDispatchPanel";
import { buildTelHref } from "../utils/phone";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-text-primary";

/**
 * Canal opérateur téléphone (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §3.2) — un admin/master saisit
 * une course/mission au nom d'un appelant sans app. Formulaire volontairement plus léger que
 * MissionCreationWizard.jsx (pas d'étapes, pas de lieux enregistrés/pièces jointes) : c'est un
 * outil opérateur, pas le parcours client.
 */
export default function AdminPhoneOrderPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const taxiMode = location.pathname === "/admin/taxi-dispatch";
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategorySlug = searchParams.get("category");
  const deliveryMode = !taxiMode && requestedCategorySlug === "livraison";
  const { countryId, countries, canSelect, setCountry, loading: geoLoading } = useGeo();

  const [tradeCategories, setTradeCategories] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [category, setCategory] = useState({ requestKind: null, tradeCategoryId: "", serviceType: "" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedVehicleType, setRequestedVehicleType] = useState("motorcycle");

  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoordinates, setPickupCoordinates] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [rideQueue, setRideQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const [showPhoneOrder, setShowPhoneOrder] = useState(false);
  const dispatchMissionId = taxiMode
    ? result?.mission?.id || Number(searchParams.get("missionId")) || null
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!countryId) {
        setTradeCategories([]);
        setLoadingOptions(false);
        return;
      }
      setLoadingOptions(true);
      try {
        const categories = await getTradeCategories({ countryId });
        if (!cancelled) {
          setTradeCategories(categories);
          if (taxiMode) {
            const mobility = categories.find((item) => item.slug === "mobilite");
            setCategory(
              mobility
                ? { requestKind: "trade_category", tradeCategoryId: String(mobility.id), serviceType: "" }
                : { requestKind: null, tradeCategoryId: "", serviceType: "" }
            );
          } else if (deliveryMode) {
            const delivery = categories.find((item) => item.slug === "livraison");
            setCategory(
              delivery
                ? { requestKind: "trade_category", tradeCategoryId: String(delivery.id), serviceType: "" }
                : { requestKind: null, tradeCategoryId: "", serviceType: "" }
            );
          }
        }
      } catch (_err) {
        if (!cancelled) setTradeCategories([]);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId, deliveryMode, taxiMode]);

  const loadRideQueue = useCallback(async () => {
    if (!taxiMode) return;
    setQueueLoading(true);
    setQueueError(false);
    try {
      const data = await getTaxiDispatchQueue({
        limit: 100,
        countryId: countryId || undefined,
      });
      const rides = Array.isArray(data?.rides) ? [...data.rides] : [];
      rides.sort((left, right) => Number(Boolean(left.providerId)) - Number(Boolean(right.providerId)));
      setRideQueue(rides);
    } catch (_error) {
      setRideQueue([]);
      setQueueError(true);
    } finally {
      setQueueLoading(false);
    }
  }, [countryId, taxiMode]);

  useEffect(() => {
    loadRideQueue();
  }, [loadRideQueue]);

  const selectedTradeCategorySlug = category.tradeCategoryId
    ? tradeCategories.find((tc) => String(tc.id) === String(category.tradeCategoryId))?.slug || null
    : null;
  const requiresPickup = selectedTradeCategorySlug === "livraison" || selectedTradeCategorySlug === "mobilite";
  const isMobilite = selectedTradeCategorySlug === "mobilite";
  const effectiveTitle = taxiMode
    ? t("adminPhoneOrder.taxiTitle")
    : deliveryMode
    ? t("deliveryOrders.phoneOrderDefaultTitle")
    : title;
  const unassignedRideCount = rideQueue.filter((ride) => !ride.providerId).length;
  const assignedRideCount = rideQueue.length - unassignedRideCount;

  const canSubmit =
    Boolean(countryId) &&
    phone.trim().length > 0 &&
    Boolean(category.requestKind) &&
    effectiveTitle.trim().length >= 3 &&
    (!requiresPickup ||
      ((pickupAddress.trim() || pickupCoordinates) &&
        (address.trim() || coordinates)));

  function resetForm({ keepPhoneOrderOpen = true } = {}) {
    setPhone("");
    setFirstName("");
    const mobility = tradeCategories.find((item) => item.slug === "mobilite");
    const delivery = tradeCategories.find((item) => item.slug === "livraison");
    setCategory(
      taxiMode && mobility
        ? { requestKind: "trade_category", tradeCategoryId: String(mobility.id), serviceType: "" }
        : deliveryMode && delivery
        ? { requestKind: "trade_category", tradeCategoryId: String(delivery.id), serviceType: "" }
        : { requestKind: null, tradeCategoryId: "", serviceType: "" }
    );
    setTitle("");
    setDescription("");
    setRequestedVehicleType("motorcycle");
    setAddress("");
    setCoordinates(null);
    setPickupAddress("");
    setPickupCoordinates(null);
    setResult(null);
    setFeedback(null);
    setSearchParams({});
    setShowPhoneOrder(taxiMode && keepPhoneOrderOpen);
  }

  function backToQueue() {
    setResult(null);
    setFeedback(null);
    setSearchParams({});
    setShowPhoneOrder(false);
    loadRideQueue();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        phone: phone.trim(),
        firstName: firstName.trim() || undefined,
        countryId,
        requestKind: category.requestKind,
        title: effectiveTitle.trim(),
        description: description.trim() || undefined,
      };
      if (category.tradeCategoryId) payload.tradeCategoryId = Number(category.tradeCategoryId);
      else payload.serviceType = category.serviceType;
      if (isMobilite) payload.requestedVehicleType = requestedVehicleType;

      if (address.trim()) payload.address = address.trim();
      if (coordinates?.latitude != null) payload.latitude = coordinates.latitude;
      if (coordinates?.longitude != null) payload.longitude = coordinates.longitude;

      if (requiresPickup) {
        if (pickupAddress.trim()) payload.pickupAddress = pickupAddress.trim();
        if (pickupCoordinates?.latitude != null) payload.pickupLatitude = pickupCoordinates.latitude;
        if (pickupCoordinates?.longitude != null) payload.pickupLongitude = pickupCoordinates.longitude;
      }

      const data = await createPhoneOrder(payload);
      setResult(data);
      await loadRideQueue();
      if (isMobilite && data?.mission?.id) {
        setShowPhoneOrder(false);
        setSearchParams({ missionId: String(data.mission.id) });
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.error;
      setFeedback({
        type: "error",
        message: backendMessage || t("adminPhoneOrder.errors.submitFailed"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="page-kicker">
        {taxiMode
          ? "Teranga Taxi"
          : deliveryMode
          ? t("deliveryOrders.kicker")
          : t("adminPhoneOrder.kicker")}
      </p>
      <h1 className="app-page-headline flex items-center gap-2">
        <Phone size={22} />
        {taxiMode
          ? t("adminPhoneOrder.taxiPageTitle")
          : deliveryMode
          ? t("deliveryOrders.phoneOrderTitle")
          : t("adminPhoneOrder.title")}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {taxiMode
          ? t("adminPhoneOrder.taxiPageSubtitle")
          : deliveryMode
          ? t("deliveryOrders.phoneOrderSubtitle")
          : t("adminPhoneOrder.subtitle")}
      </p>
      {taxiMode && !dispatchMissionId ? (
        <button
          type="button"
          onClick={() => {
            if (showPhoneOrder) backToQueue();
            else setShowPhoneOrder(true);
          }}
          className={`${showPhoneOrder ? "btn-secondary" : "btn-primary"} mt-4 inline-flex min-h-12 items-center rounded-2xl px-5 text-sm font-semibold`}
        >
          {showPhoneOrder ? t("adminPhoneOrder.backToQueue") : t("adminPhoneOrder.phoneOrderCta")}
        </button>
      ) : null}

      {taxiMode && !dispatchMissionId && !showPhoneOrder ? (
        <section className="mt-6 rounded-[28px] border border-border/70 bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t("adminPhoneOrder.queueTitle")}</h2>
              <p className="text-sm text-text-secondary">{t("adminPhoneOrder.queueCount", { count: rideQueue.length })}</p>
            </div>
            <button type="button" onClick={loadRideQueue} disabled={queueLoading} className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs">
              {queueLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {t("adminPhoneOrder.queueRefresh")}
            </button>
          </div>

          {!queueLoading && rideQueue.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3" aria-label={t("adminPhoneOrder.queueSummary")}>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                <p className="text-2xl font-bold text-text-primary">{unassignedRideCount}</p>
                <p className="text-xs font-medium text-text-secondary">{t("adminPhoneOrder.queueUnassigned")}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                <p className="text-2xl font-bold text-text-primary">{assignedRideCount}</p>
                <p className="text-xs font-medium text-text-secondary">{t("adminPhoneOrder.queueAssigned")}</p>
              </div>
            </div>
          ) : null}

          {queueError ? (
            <div className="mt-4">
              <AuthFeedbackBanner type="error" message={t("adminPhoneOrder.queueError")} />
            </div>
          ) : null}

          {queueLoading && !rideQueue.length ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
              <Loader2 size={17} className="animate-spin" /> {t("adminPhoneOrder.queueLoading")}
            </div>
          ) : rideQueue.length ? (
            <ol className="mt-4 grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {rideQueue.map((ride) => {
                const VehicleIcon = ride.requestedVehicleType === "car" ? CarFront : Bike;
                return (
                  <li key={ride.id} className="rounded-2xl border border-border bg-surface-main/60 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><VehicleIcon size={19} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-text-primary">{t("adminPhoneOrder.rideReference", { id: ride.id })}</p>
                          <span className="app-badge app-badge-info text-[10px]">
                            {t(`missionTracking.status.${ride.missionStatus}`, { defaultValue: ride.missionStatus })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{[ride.client?.firstName, ride.client?.phone].filter(Boolean).join(" · ")}</p>
                        <p className={`mt-2 text-xs font-semibold ${ride.providerId ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                          {t(ride.providerId ? "adminPhoneOrder.driverAssigned" : "adminPhoneOrder.driverNeeded")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-text-secondary">{ride.pickupAddress || t("adminPhoneOrder.locationUnknown")}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-text-primary">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                      {ride.address || t("adminPhoneOrder.locationUnknown")}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPhoneOrder(false);
                          setSearchParams({ missionId: String(ride.id) });
                        }}
                        className={`${ride.providerId ? "btn-secondary" : "btn-primary"} min-h-11 rounded-xl px-3 text-sm font-semibold`}
                      >
                        {ride.providerId ? t("adminPhoneOrder.openRide") : t("adminPhoneOrder.assignRide")}
                      </button>
                      {buildTelHref(ride.client?.phone) ? (
                        <a href={buildTelHref(ride.client.phone)} className="btn-secondary flex min-h-11 items-center justify-center rounded-xl px-3 text-sm">
                          <Phone size={15} /> {t("adminPhoneOrder.callClient")}
                        </a>
                      ) : <span />}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : !queueError ? (
            <p className="py-7 text-center text-sm text-text-muted">{t("adminPhoneOrder.queueEmpty")}</p>
          ) : null}
        </section>
      ) : null}

      {result || dispatchMissionId ? (
        <div className="mt-6 space-y-5">
          {result ? (
            <div className="rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm">
              <AuthFeedbackBanner type="success" message={t("adminPhoneOrder.success.message")} />
              <p className="mt-3 text-sm text-text-secondary">
                {t("adminPhoneOrder.success.reference", { id: result.mission?.id })}
              </p>
              {result.isNewAccount ? (
                <p className="mt-2 text-sm text-text-secondary">
                  {t("adminPhoneOrder.success.newAccount")}
                  {result.generatedPin ? (
                    <span className="ml-1 font-mono font-semibold text-text-primary">{result.generatedPin}</span>
                  ) : null}
                </p>
              ) : null}
              {result.startCode ? (
                <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {t("adminPhoneOrder.success.startCodeTitle")}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-text-primary">
                    {result.startCode}
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    {t("adminPhoneOrder.success.startCodeHint")}
                  </p>
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                {dispatchMissionId ? (
                  <a href="#dispatch" className="btn-primary rounded-full px-6 py-2.5 text-sm">
                    {t("adminPhoneOrder.success.assignCta")}
                  </a>
                ) : (
                  <Link
                    to={deliveryMode ? "/admin/livraisons" : "/admin/services"}
                    className="btn-primary rounded-full px-6 py-2.5 text-sm"
                  >
                    {t("adminPhoneOrder.success.assignCta")}
                  </Link>
                )}
                <button type="button" onClick={() => resetForm({ keepPhoneOrderOpen: true })} className="btn-secondary rounded-full px-6 py-2.5 text-sm">
                  {t("adminPhoneOrder.success.newOrderCta")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={backToQueue} className="btn-secondary rounded-full px-6 py-2.5 text-sm">
              {taxiMode ? t("adminPhoneOrder.backToQueue") : t("adminPhoneOrder.success.newOrderCta")}
            </button>
          )}
          {dispatchMissionId ? (
            <div id="dispatch">
              <MobilityDispatchPanel missionId={dispatchMissionId} onAssignmentChange={loadRideQueue} />
            </div>
          ) : null}
        </div>
      ) : !taxiMode || showPhoneOrder ? (
        <form id="phone-order" onSubmit={handleSubmit} className="mt-6 max-w-xl scroll-mt-24 rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm">
          {taxiMode ? (
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-text-primary">{t("adminPhoneOrder.newTaxiOrder")}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t("adminPhoneOrder.newTaxiOrderHint")}</p>
            </div>
          ) : null}
          {feedback ? (
            <div className="mb-5">
              <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
            </div>
          ) : null}

          {canSelect ? (
            <div className="mb-5">
              <label className={labelClass}>{t("adminPhoneOrder.countryLabel")}</label>
              <select
                className={inputClass}
                value={countryId || ""}
                onChange={(e) => setCountry(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t("adminPhoneOrder.selectCountry")}</option>
                {(countries || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!geoLoading && !countryId ? (
            <div className="mb-5">
              <AuthFeedbackBanner type="error" message={t("adminPhoneOrder.errors.noCountry")} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("adminPhoneOrder.phoneLabel")}</label>
              <input
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("adminPhoneOrder.phonePlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>{t("adminPhoneOrder.firstNameLabel")}</label>
              <input
                type="text"
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t("adminPhoneOrder.firstNamePlaceholder")}
              />
            </div>
          </div>

          {!taxiMode && !deliveryMode ? (
            <div className="mt-5">
              <label className={labelClass}>{t("missionCreation.category.title")}</label>
              <CategoryPicker
                tradeCategories={tradeCategories}
                loading={loadingOptions}
                value={category}
                onChange={(value) => {
                  setCategory(value);
                  setRequestedVehicleType("motorcycle");
                }}
              />
            </div>
          ) : null}

          {isMobilite ? (
            <div className="mt-5">
              <label className={labelClass}>{t("adminPhoneOrder.vehicleLabel")}</label>
              <select
                className={inputClass}
                value={requestedVehicleType}
                onChange={(event) => setRequestedVehicleType(event.target.value)}
              >
                <option value="motorcycle">{t("adminPhoneOrder.vehicle.motorcycle")}</option>
                <option value="car">{t("adminPhoneOrder.vehicle.car")}</option>
              </select>
            </div>
          ) : null}

          {!taxiMode && !deliveryMode ? (
            <div className="mt-5">
              <label className={labelClass}>{t("adminPhoneOrder.titleLabel")}</label>
              <input
                type="text"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("missionCreation.description.titlePlaceholder")}
              />
            </div>
          ) : null}

          {!taxiMode ? (
            <div className="mt-5">
              <label className={labelClass}>{t("missionCreation.description.descriptionLabel")}</label>
              <textarea
                className={inputClass}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("missionCreation.description.descriptionPlaceholder")}
              />
            </div>
          ) : null}

          {requiresPickup ? (
            <div className="mt-5 rounded-xl border border-border bg-surface-main/60 p-4">
              <h3 className="text-sm font-semibold text-text-primary">
                {isMobilite ? t("missionCreation.location.departureTitle") : t("missionCreation.location.pickupTitle")}
              </h3>
              <div className="mt-3">
                <LocationAutocompleteInput
                  className={inputClass}
                  placeholder={t("missionCreation.location.pickupAddressPlaceholder")}
                  value={pickupAddress}
                  onChange={(value) => {
                    setPickupAddress(value);
                    setPickupCoordinates(null);
                  }}
                  onPlaceSelected={({ address: resolvedAddress, latitude, longitude }) => {
                    setPickupAddress(resolvedAddress);
                    setPickupCoordinates({ latitude, longitude });
                  }}
                />
              </div>
              {!taxiMode && !deliveryMode ? (
                <div className="mt-3">
                  <MissionLocationMap
                    latitude={pickupCoordinates?.latitude}
                    longitude={pickupCoordinates?.longitude}
                    onPositionChange={(pos) => setPickupCoordinates(pos)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5">
            <label className={labelClass}>
              {requiresPickup
                ? isMobilite
                  ? t("missionCreation.location.destinationTitle")
                  : t("missionCreation.location.dropoffTitle")
                : t("missionCreation.location.addressLabel")}
            </label>
            <LocationAutocompleteInput
              className={inputClass}
              placeholder={t("missionCreation.location.addressPlaceholder")}
              value={address}
              onChange={(value) => {
                setAddress(value);
                setCoordinates(null);
              }}
              onPlaceSelected={({ address: resolvedAddress, latitude, longitude }) => {
                setAddress(resolvedAddress);
                setCoordinates({ latitude, longitude });
              }}
            />
            {!taxiMode && !deliveryMode ? (
              <div className="mt-3">
                <MissionLocationMap
                  latitude={coordinates?.latitude}
                  longitude={coordinates?.longitude}
                  onPositionChange={(pos) => setCoordinates(pos)}
                />
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={`btn-primary mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60 ${taxiMode ? "w-full" : ""}`}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? t("adminPhoneOrder.submitting") : t("adminPhoneOrder.submitCta")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
