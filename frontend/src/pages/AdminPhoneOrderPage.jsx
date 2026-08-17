import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Phone } from "lucide-react";

import { useGeo } from "../contexts/GeoContext";
import { getTradeCategories } from "../services/missionRequests";
import { createPhoneOrder } from "../services/missions";
import CategoryPicker from "../features/mission-creation/CategoryPicker";
import LocationAutocompleteInput from "../features/mission-creation/LocationAutocompleteInput";
import MissionLocationMap from "../features/mission-creation/MissionLocationMap";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import MobilityDispatchPanel from "../features/mobility/MobilityDispatchPanel";

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const dispatchMissionId =
    result?.mission?.id || Number(searchParams.get("missionId")) || null;

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
        if (!cancelled) setTradeCategories(categories);
      } catch (_err) {
        if (!cancelled) setTradeCategories([]);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const selectedTradeCategorySlug = category.tradeCategoryId
    ? tradeCategories.find((tc) => String(tc.id) === String(category.tradeCategoryId))?.slug || null
    : null;
  const requiresPickup = selectedTradeCategorySlug === "livraison" || selectedTradeCategorySlug === "mobilite";
  const isMobilite = selectedTradeCategorySlug === "mobilite";

  const canSubmit =
    Boolean(countryId) &&
    phone.trim().length > 0 &&
    Boolean(category.requestKind) &&
    title.trim().length >= 3 &&
    (!requiresPickup || (pickupAddress.trim() || pickupCoordinates));

  function resetForm() {
    setPhone("");
    setFirstName("");
    setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
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
        title: title.trim(),
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
      if (isMobilite && data?.mission?.id) {
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
      <p className="page-kicker">{t("adminPhoneOrder.kicker")}</p>
      <h1 className="app-page-headline flex items-center gap-2">
        <Phone size={22} />
        {t("adminPhoneOrder.title")}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">{t("adminPhoneOrder.subtitle")}</p>

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
              <div className="mt-6 flex flex-wrap gap-3">
                {dispatchMissionId ? (
                  <a href="#dispatch" className="btn-primary rounded-full px-6 py-2.5 text-sm">
                    {t("adminPhoneOrder.success.assignCta")}
                  </a>
                ) : (
                  <Link to="/admin/services" className="btn-primary rounded-full px-6 py-2.5 text-sm">
                    {t("adminPhoneOrder.success.assignCta")}
                  </Link>
                )}
                <button type="button" onClick={resetForm} className="btn-secondary rounded-full px-6 py-2.5 text-sm">
                  {t("adminPhoneOrder.success.newOrderCta")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={resetForm} className="btn-secondary rounded-full px-6 py-2.5 text-sm">
              {t("adminPhoneOrder.success.newOrderCta")}
            </button>
          )}
          {dispatchMissionId ? (
            <div id="dispatch">
              <MobilityDispatchPanel missionId={dispatchMissionId} />
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 max-w-xl rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm">
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
              <div className="mt-3">
                <MissionLocationMap
                  latitude={pickupCoordinates?.latitude}
                  longitude={pickupCoordinates?.longitude}
                  onPositionChange={(pos) => setPickupCoordinates(pos)}
                />
              </div>
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
            <div className="mt-3">
              <MissionLocationMap
                latitude={coordinates?.latitude}
                longitude={coordinates?.longitude}
                onPositionChange={(pos) => setCoordinates(pos)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? t("adminPhoneOrder.submitting") : t("adminPhoneOrder.submitCta")}
          </button>
        </form>
      )}
    </div>
  );
}
