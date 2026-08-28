import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Loader2,
  LocateFixed,
  MessageCircle,
  Package,
  Phone,
  Route,
  ShieldCheck,
  ShoppingBag,
  WifiOff,
} from "lucide-react";

import { Button, FormField } from "../../components/ui";
import AuthFeedbackBanner from "../../components/AuthFeedbackBanner";
import LocationAutocompleteInput from "../mission-creation/LocationAutocompleteInput";
import {
  estimateMissionRequest,
  getTradeCategories,
  reverseGeocodeMissionRequestLocation,
  submitMissionRequest,
} from "../../services/missionRequests";
import { getMasterCountries } from "../../services/franchises";
import { createMission } from "../../services/missions";
import { getLocalUser, me, persistSession } from "../../services/auth";
import { buildTelHref, buildWhatsappHref } from "../../utils/phone";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";

const PACKAGE_TYPES = [
  { value: "document", icon: FileText },
  { value: "small", icon: ShoppingBag },
  { value: "standard", icon: Package },
  { value: "bulky", icon: Boxes },
];

const DELIVERY_DRAFT_KEY = "teranga_delivery_booking_draft_v1";

function readDeliveryDraft() {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(DELIVERY_DRAFT_KEY) || "{}");
    const updatedAt = Date.parse(value?.updatedAt || "");
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(DELIVERY_DRAFT_KEY);
      return {};
    }
    return value && typeof value === "object" ? value : {};
  } catch (_error) {
    return {};
  }
}

function draftCoordinates(value) {
  if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
    return null;
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

function clearDeliveryDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DELIVERY_DRAFT_KEY);
  } catch (_error) {
    // La livraison reste utilisable quand le stockage local est désactivé.
  }
}

function isClient(user) {
  return user?.role === "client";
}

function hasCoordinates(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

export default function DeliveryRequestForm() {
  const { t } = useTranslation();
  const [initialDraft] = useState(readDeliveryDraft);
  const [tradeCategory, setTradeCategory] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState(() => String(initialDraft.countryId || ""));
  const [loading, setLoading] = useState(true);

  const initialLocalUser = getLocalUser();
  const [sessionUser, setSessionUser] = useState(isClient(initialLocalUser) ? initialLocalUser : null);
  const [incompatibleUser, setIncompatibleUser] = useState(
    initialLocalUser && !isClient(initialLocalUser) ? initialLocalUser : null
  );

  const initialPackageType = PACKAGE_TYPES.some(
    (item) => item.value === initialDraft.packageType
  )
    ? initialDraft.packageType
    : "small";
  const [packageType, setPackageType] = useState(initialPackageType);
  const [pickupAddress, setPickupAddress] = useState(initialDraft.pickupAddress || "");
  const [pickup, setPickup] = useState(() => draftCoordinates(initialDraft.pickup));
  const [destinationAddress, setDestinationAddress] = useState(
    initialDraft.destinationAddress || ""
  );
  const [destination, setDestination] = useState(() =>
    draftCoordinates(initialDraft.destination)
  );
  const [description, setDescription] = useState(initialDraft.description || "");
  const [locating, setLocating] = useState(false);
  const [step, setStep] = useState(1);

  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [phone, setPhone] = useState(initialDraft.phone || "");
  const [pin, setPin] = useState("");
  const [pinRequired, setPinRequired] = useState(false);
  const [firstName, setFirstName] = useState(initialDraft.firstName || "");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countryList, session] = await Promise.all([
          getMasterCountries(),
          me().catch(() => ({ user: null })),
        ]);
        if (cancelled) return;

        setCountries(countryList);
        const verifiedUser = session?.user || null;
        setSessionUser(isClient(verifiedUser) ? verifiedUser : null);
        setIncompatibleUser(verifiedUser && !isClient(verifiedUser) ? verifiedUser : null);

        const draftCountry = countryList.find(
          (country) => String(country.id) === String(initialDraft.countryId)
        );
        const initialCountryId =
          verifiedUser?.countryId || draftCountry?.id || countryList[0]?.id || null;
        setCountryId(initialCountryId ? String(initialCountryId) : "");

        const categoryList = initialCountryId
          ? await getTradeCategories({
              countryId: Number(initialCountryId),
              ...(verifiedUser?.regionId ? { regionId: Number(verifiedUser.regionId) } : {}),
            })
          : [];
        if (cancelled) return;
        const delivery = categoryList.find((item) => item.slug === "livraison") || null;
        setTradeCategory(delivery);
        if (!delivery) {
          setFeedback({ type: "error", message: t("deliveryBooking.errors.unavailable") });
        }
      } catch (_error) {
        if (!cancelled) {
          setFeedback({ type: "error", message: t("deliveryBooking.errors.load") });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDraft.countryId, t]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine !== false);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (loading || result || typeof window === "undefined") return undefined;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          DELIVERY_DRAFT_KEY,
          JSON.stringify({
            packageType,
            pickupAddress,
            pickup,
            destinationAddress,
            destination,
            description,
            phone,
            firstName,
            countryId,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (_error) {
        // La saisie reste disponible si localStorage est bloqué.
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    countryId,
    description,
    destination,
    destinationAddress,
    firstName,
    loading,
    packageType,
    phone,
    pickup,
    pickupAddress,
    result,
  ]);

  const selectedCountry = useMemo(
    () => countries.find((country) => String(country.id) === String(countryId)) || null,
    [countries, countryId]
  );
  const assistanceTelHref = buildTelHref(selectedCountry?.contactPhone);
  const assistanceWhatsappHref = buildWhatsappHref(
    selectedCountry?.contactPhone,
    t("deliveryBooking.whatsapp.message", {
      package: t(`deliveryBooking.package.${packageType}.label`),
      pickup: pickupAddress.trim() || t("deliveryBooking.whatsapp.toSpecify"),
      destination: destinationAddress.trim() || t("deliveryBooking.whatsapp.toSpecify"),
      phone: phone.trim() || t("deliveryBooking.whatsapp.toSpecify"),
    })
  );

  const invalidateEstimate = useCallback(() => {
    setEstimate(null);
    setFeedback(null);
  }, []);

  const handleCountryChange = async (nextCountryId) => {
    setCountryId(nextCountryId);
    setTradeCategory(null);
    invalidateEstimate();
    try {
      const categoryList = await getTradeCategories({ countryId: Number(nextCountryId) });
      const delivery = categoryList.find((item) => item.slug === "livraison") || null;
      setTradeCategory(delivery);
      if (!delivery) {
        setFeedback({ type: "error", message: t("deliveryBooking.errors.unavailable") });
      }
    } catch (_error) {
      setFeedback({ type: "error", message: t("deliveryBooking.errors.load") });
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: "error",
        message: t("deliveryBooking.errors.geolocationUnsupported"),
      });
      return;
    }
    setLocating(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setPickup(coordinates);
        setEstimate(null);
        try {
          const address = await reverseGeocodeMissionRequestLocation(coordinates);
          setPickupAddress(address || t("deliveryBooking.currentPosition"));
        } catch (_error) {
          setPickupAddress(t("deliveryBooking.currentPosition"));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setFeedback({ type: "error", message: t("deliveryBooking.errors.geolocation") });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const calculateEstimate = async () => {
    if (!tradeCategory || !countryId) {
      setFeedback({ type: "error", message: t("deliveryBooking.errors.unavailable") });
      return false;
    }
    if (
      !(pickupAddress.trim() || hasCoordinates(pickup)) ||
      !(destinationAddress.trim() || hasCoordinates(destination))
    ) {
      setFeedback({ type: "error", message: t("deliveryBooking.errors.locations") });
      return false;
    }

    setEstimating(true);
    setFeedback(null);
    try {
      const data = await estimateMissionRequest({
        countryId: Number(countryId),
        tradeCategoryId: Number(tradeCategory.id),
        packageType,
        pickupAddress: pickupAddress.trim() || undefined,
        pickupLatitude: pickup?.latitude,
        pickupLongitude: pickup?.longitude,
        address: destinationAddress.trim() || undefined,
        latitude: destination?.latitude,
        longitude: destination?.longitude,
      });
      setEstimate(data?.estimate || null);
      if (data?.pickup && hasCoordinates(data.pickup)) {
        setPickup({ latitude: Number(data.pickup.latitude), longitude: Number(data.pickup.longitude) });
        if (data.pickup.address) setPickupAddress(data.pickup.address);
      }
      if (data?.destination && hasCoordinates(data.destination)) {
        setDestination({
          latitude: Number(data.destination.latitude),
          longitude: Number(data.destination.longitude),
        });
        if (data.destination.address) setDestinationAddress(data.destination.address);
      }
      setStep(3);
      return true;
    } catch (error) {
      setEstimate(null);
      setFeedback({
        type: "error",
        message:
          !error?.response || !isOnline
            ? t("deliveryBooking.errors.draftSaved")
            : error?.response?.data?.error || t("deliveryBooking.errors.estimate"),
      });
      return false;
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!estimate) {
      await calculateEstimate();
      return;
    }
    if (incompatibleUser) {
      setFeedback({
        type: "error",
        message: t("deliveryBooking.errors.clientAccountRequired"),
      });
      return;
    }
    if (!sessionUser && !phone.trim()) {
      setFeedback({ type: "error", message: t("deliveryBooking.errors.identity") });
      return;
    }
    if (!sessionUser && pinRequired && !pin.trim()) {
      setFeedback({ type: "error", message: t("deliveryBooking.errors.pinRequired") });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const commonPayload = {
      tradeCategoryId: Number(tradeCategory.id),
      title: t("deliveryBooking.package.missionTitle", {
        package: t(`deliveryBooking.package.${packageType}.label`),
      }),
      description: description.trim() || undefined,
      packageType,
      pickupAddress: pickupAddress.trim() || undefined,
      pickupLatitude: pickup?.latitude,
      pickupLongitude: pickup?.longitude,
      address: destinationAddress.trim() || undefined,
      latitude: destination?.latitude,
      longitude: destination?.longitude,
    };

    try {
      let data;
      if (sessionUser) {
        data = await createMission({ executionType: "provider", ...commonPayload });
      } else {
        data = await submitMissionRequest({
          ...commonPayload,
          phone: phone.trim(),
          ...(pin.trim() ? { pin: pin.trim() } : {}),
          firstName: firstName.trim() || undefined,
          countryId: Number(countryId),
          requestKind: "trade_category",
        });
        await persistSession(data);
      }

      setResult({
        mission: data?.mission || data?.service,
        estimate: data?.estimate || estimate,
        generatedPin: data?.generatedPin || null,
      });
      clearDeliveryDraft();
    } catch (error) {
      const status = error?.response?.status;
      const requiresPin = status === 401 && error?.response?.data?.code === "PIN_REQUIRED";
      if (requiresPin) setPinRequired(true);
      setFeedback({
        type: "error",
        message:
          requiresPin
            ? t("deliveryBooking.errors.pinRequired")
            : status === 401
            ? t("deliveryBooking.errors.wrongPin")
            : !error?.response || !isOnline
            ? t("deliveryBooking.errors.draftSaved")
            : error?.response?.data?.error || t("deliveryBooking.errors.submit"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-border bg-surface-card">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-surface-card p-6 shadow-sm sm:p-8">
        <AuthFeedbackBanner type="success" message={t("deliveryBooking.success.message")} />
        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              {t("deliveryBooking.success.title")}
            </h2>
            <p className="text-sm text-text-secondary">
              {t("deliveryBooking.success.reference", { id: result.mission?.id })}
            </p>
          </div>
        </div>
        {result.generatedPin ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={17} /> {t("deliveryBooking.success.generatedPinTitle")}
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em]">
              {result.generatedPin}
            </p>
            <p className="mt-2 text-xs">{t("deliveryBooking.success.generatedPinHint")}</p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/livraisons/${result.mission?.id}`}
            className="btn-primary rounded-full px-6 py-2.5 text-sm"
          >
            {t("deliveryBooking.success.track")}
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-secondary rounded-full px-6 py-2.5 text-sm"
          >
            {t("deliveryBooking.success.newDelivery")}
          </button>
        </div>
      </div>
    );
  }

  const restoredDraft =
    initialDraft.pickupAddress || initialDraft.destinationAddress || initialDraft.phone;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-border/70 bg-surface-card p-5 shadow-sm sm:p-7">
        {feedback ? (
          <div className="mb-5">
            <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
          </div>
        ) : null}

        {!isOnline ? (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            <WifiOff className="mt-0.5 shrink-0" size={18} />
            <span>{t("deliveryBooking.offline")}</span>
          </div>
        ) : null}

        {restoredDraft ? (
          <p className="mb-5 flex items-center gap-2 rounded-2xl bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            <CheckCircle2 size={16} /> {t("deliveryBooking.draftRestored")}
          </p>
        ) : null}

        {assistanceTelHref || assistanceWhatsappHref ? (
          <div className="mb-6 grid gap-2 sm:grid-cols-2">
            {assistanceTelHref ? (
              <a
                href={assistanceTelHref}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-main/60 p-3 text-text-secondary"
              >
                <Phone size={18} />
                <span>
                  <strong className="block text-sm">{t("deliveryBooking.callTitle")}</strong>
                  <span className="text-xs">
                    {t("deliveryBooking.callUs", { phone: selectedCountry.contactPhone })}
                  </span>
                </span>
              </a>
            ) : null}
            {assistanceWhatsappHref ? (
              <a
                href={assistanceWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-800 dark:text-emerald-200"
              >
                <MessageCircle size={18} />
                <span>
                  <strong className="block text-sm">
                    {t("deliveryBooking.whatsapp.title")}
                  </strong>
                  <span className="text-xs">{t("deliveryBooking.whatsapp.hint")}</span>
                </span>
              </a>
            ) : null}
          </div>
        ) : null}

        <ol className="mb-7 grid grid-cols-3 gap-2" aria-label={t("deliveryBooking.steps.label")}>
          {["package", "route", "confirm"].map((key, index) => {
            const number = index + 1;
            const active = step === number;
            const complete = step > number;
            return (
              <li
                key={key}
                className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : complete
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-text-muted"
                }`}
              >
                <span className="block text-[10px]">
                  {t("deliveryBooking.steps.number", { number })}
                </span>
                {t(`deliveryBooking.steps.${key}`)}
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("deliveryBooking.package.title")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {t("deliveryBooking.package.hint")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PACKAGE_TYPES.map(({ value, icon: Icon }) => {
                const selected = value === packageType;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPackageType(value);
                      invalidateEstimate();
                    }}
                    className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-500/10 text-blue-800 dark:text-blue-200"
                        : "border-border bg-surface-main/50 text-text-secondary hover:border-blue-400"
                    }`}
                    aria-pressed={selected}
                  >
                    <Icon size={24} />
                    <span>
                      <strong className="block text-sm">
                        {t(`deliveryBooking.package.${value}.label`)}
                      </strong>
                      <span className="text-xs">
                        {t(`deliveryBooking.package.${value}.hint`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 min-h-11 w-full rounded-full"
            >
              {t("deliveryBooking.steps.next")}
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("deliveryBooking.steps.routeTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {t("deliveryBooking.steps.routeHint")}
            </p>

            <div className="mt-5 space-y-4">
              {countries.length > 1 ? (
                <FormField label={t("deliveryBooking.identity.country")} required>
                  <select
                    className={inputClass}
                    value={countryId}
                    onChange={(event) => handleCountryChange(event.target.value)}
                  >
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}

              <FormField label={t("deliveryBooking.pickupLabel")} required>
                <LocationAutocompleteInput
                  className={inputClass}
                  value={pickupAddress}
                  placeholder={t("deliveryBooking.pickupPlaceholder")}
                  onChange={(value) => {
                    setPickupAddress(value);
                    setPickup(null);
                    invalidateEstimate();
                  }}
                  onPlaceSelected={({ address, latitude, longitude }) => {
                    setPickupAddress(address);
                    setPickup({ latitude, longitude });
                    invalidateEstimate();
                  }}
                  required
                />
              </FormField>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60 dark:text-blue-300"
              >
                {locating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LocateFixed size={16} />
                )}
                {locating
                  ? t("deliveryBooking.locating")
                  : t("deliveryBooking.useCurrentLocation")}
              </button>

              <FormField label={t("deliveryBooking.destinationLabel")} required>
                <LocationAutocompleteInput
                  className={inputClass}
                  value={destinationAddress}
                  placeholder={t("deliveryBooking.destinationPlaceholder")}
                  onChange={(value) => {
                    setDestinationAddress(value);
                    setDestination(null);
                    invalidateEstimate();
                  }}
                  onPlaceSelected={({ address, latitude, longitude }) => {
                    setDestinationAddress(address);
                    setDestination({ latitude, longitude });
                    invalidateEstimate();
                  }}
                  required
                />
              </FormField>

              <FormField label={t("deliveryBooking.descriptionLabel")}>
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("deliveryBooking.descriptionPlaceholder")}
                  maxLength={2000}
                />
              </FormField>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                <ArrowLeft size={16} /> {t("deliveryBooking.steps.back")}
              </button>
              <Button
                type="button"
                onClick={calculateEstimate}
                loading={estimating}
                disabled={!tradeCategory || !countryId}
                className="min-h-11 flex-1 rounded-full"
              >
                <Route size={16} /> {t("deliveryBooking.estimateCta")}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 && estimate ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("deliveryBooking.steps.confirmTitle")}
            </h2>
            <div className="mt-4 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {t("deliveryBooking.estimateTitle")}
              </p>
              {estimate.basePrice != null ? (
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {t("deliveryBooking.price", {
                    amount: Math.round(Number(estimate.basePrice)),
                    currency: estimate.currency,
                  })}
                </p>
              ) : (
                <p className="mt-1 text-base font-semibold text-text-primary">
                  {t("deliveryBooking.quoteOnly")}
                </p>
              )}
              <p className="mt-2 text-sm font-medium text-text-primary">
                {t(`deliveryBooking.package.${packageType}.label`)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {pickupAddress} <span aria-hidden="true">→</span> {destinationAddress}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-secondary">
                {estimate.distanceKm != null ? (
                  <span className="inline-flex items-center gap-1">
                    <Route size={13} /> {estimate.distanceKm} km
                  </span>
                ) : null}
                {estimate.durationMinutes != null ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} />
                    {t("deliveryBooking.duration", { minutes: estimate.durationMinutes })}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-text-muted">
                {t("deliveryBooking.priceHint")}
              </p>
            </div>

            {!sessionUser && !incompatibleUser ? (
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("deliveryBooking.identity.title")}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("deliveryBooking.identity.hint")}
                  </p>
                </div>
                <FormField label={t("deliveryBooking.identity.phone")} required>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputClass}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setPinRequired(false);
                      setPin("");
                    }}
                    placeholder="+223 70 00 00 00"
                    required
                  />
                </FormField>
                <FormField label={t("deliveryBooking.identity.firstName")}>
                  <input
                    type="text"
                    autoComplete="given-name"
                    className={inputClass}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder={t("deliveryBooking.identity.firstNamePlaceholder")}
                  />
                </FormField>
                {pinRequired ? (
                  <FormField label={t("deliveryBooking.identity.pin")} required>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      minLength={4}
                      className={inputClass}
                      value={pin}
                      onChange={(event) => setPin(event.target.value)}
                      placeholder="••••"
                      autoFocus
                      required
                    />
                  </FormField>
                ) : null}
              </div>
            ) : null}

            {sessionUser ? (
              <p className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                {t("deliveryBooking.connectedAs", {
                  name: sessionUser.firstName || sessionUser.phone || "",
                })}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                <ArrowLeft size={16} /> {t("deliveryBooking.steps.back")}
              </button>
              <Button
                type="submit"
                loading={submitting}
                disabled={Boolean(incompatibleUser) || !isOnline}
                className="min-h-11 flex-1 rounded-full"
              >
                {t("deliveryBooking.book")}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </form>
  );
}
