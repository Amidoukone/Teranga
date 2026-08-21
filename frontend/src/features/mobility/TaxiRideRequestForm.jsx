import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bike,
  CarFront,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  LocateFixed,
  Map,
  MapPinned,
  MessageCircle,
  Phone,
  Route,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import { Button, FormField } from "../../components/ui";
import AuthFeedbackBanner from "../../components/AuthFeedbackBanner";
import LocationAutocompleteInput from "../mission-creation/LocationAutocompleteInput";
import TaxiRouteMap from "./TaxiRouteMap";
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

const VEHICLES = [
  { value: "motorcycle", icon: Bike },
  { value: "car", icon: CarFront },
];

const TAXI_DRAFT_KEY = "teranga_taxi_booking_draft_v1";

function readTaxiDraft() {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(TAXI_DRAFT_KEY) || "{}");
    const updatedAt = Date.parse(value?.updatedAt || "");
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(TAXI_DRAFT_KEY);
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

function clearTaxiDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TAXI_DRAFT_KEY);
  } catch (_error) {
    // Le stockage local peut être désactivé : la commande reste utilisable sans lui.
  }
}

function isClient(user) {
  return user?.role === "client";
}

function hasCoordinates(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

export default function TaxiRideRequestForm() {
  const { t } = useTranslation();
  const [initialDraft] = useState(readTaxiDraft);
  const [tradeCategory, setTradeCategory] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState(() => String(initialDraft.countryId || ""));
  const [loading, setLoading] = useState(true);

  const initialLocalUser = getLocalUser();
  const [sessionUser, setSessionUser] = useState(isClient(initialLocalUser) ? initialLocalUser : null);
  const [incompatibleUser, setIncompatibleUser] = useState(
    initialLocalUser && !isClient(initialLocalUser) ? initialLocalUser : null
  );

  const [vehicleType, setVehicleType] = useState(
    initialDraft.vehicleType === "car" ? "car" : "motorcycle"
  );
  const [pickupAddress, setPickupAddress] = useState(initialDraft.pickupAddress || "");
  const [pickup, setPickup] = useState(() => draftCoordinates(initialDraft.pickup));
  const [destinationAddress, setDestinationAddress] = useState(
    initialDraft.destinationAddress || ""
  );
  const [destination, setDestination] = useState(() =>
    draftCoordinates(initialDraft.destination)
  );
  const [activePoint, setActivePoint] = useState("pickup");
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
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
        const [categoryList, countryList, session] = await Promise.all([
          getTradeCategories(),
          getMasterCountries(),
          me().catch(() => ({ user: null })),
        ]);
        if (cancelled) return;

        const mobility = categoryList.find((item) => item.slug === "mobilite") || null;
        setTradeCategory(mobility);
        setCountries(countryList);

        const verifiedUser = session?.user || null;
        setSessionUser(isClient(verifiedUser) ? verifiedUser : null);
        setIncompatibleUser(verifiedUser && !isClient(verifiedUser) ? verifiedUser : null);

        const draftCountry = countryList.find(
          (country) => String(country.id) === String(initialDraft.countryId)
        );
        const initialCountryId =
          verifiedUser?.countryId || draftCountry?.id || mobility?.countryId || countryList[0]?.id || null;
        setCountryId(initialCountryId ? String(initialCountryId) : "");

        if (!mobility) {
          setFeedback({ type: "error", message: t("mobilityBooking.errors.unavailable") });
        }
      } catch (_error) {
        if (!cancelled) {
          setFeedback({ type: "error", message: t("mobilityBooking.errors.load") });
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
          TAXI_DRAFT_KEY,
          JSON.stringify({
            vehicleType,
            pickupAddress,
            pickup,
            destinationAddress,
            destination,
            phone,
            firstName,
            countryId,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (_error) {
        // Le formulaire continue normalement si le navigateur bloque localStorage.
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    countryId,
    destination,
    destinationAddress,
    firstName,
    loading,
    phone,
    pickup,
    pickupAddress,
    result,
    vehicleType,
  ]);

  const selectedCountry = useMemo(
    () => countries.find((country) => String(country.id) === String(countryId)) || null,
    [countries, countryId]
  );
  const assistanceTelHref = buildTelHref(selectedCountry?.contactPhone);
  const assistanceWhatsappHref = buildWhatsappHref(
    selectedCountry?.contactPhone,
    t("mobilityBooking.whatsapp.message", {
      vehicle: t(`mobilityBooking.vehicle.${vehicleType}.label`),
      pickup: pickupAddress.trim() || t("mobilityBooking.whatsapp.toSpecify"),
      destination: destinationAddress.trim() || t("mobilityBooking.whatsapp.toSpecify"),
      phone: phone.trim() || t("mobilityBooking.whatsapp.toSpecify"),
    })
  );

  const invalidateEstimate = useCallback(() => {
    setEstimate(null);
    setFeedback(null);
  }, []);

  const handleVehicleChange = (nextVehicleType) => {
    setVehicleType(nextVehicleType);
    invalidateEstimate();
  };

  const resolveDroppedPin = useCallback(async (kind, coordinates) => {
    if (kind === "pickup") setPickup(coordinates);
    else setDestination(coordinates);
    setEstimate(null);
    setFeedback(null);

    try {
      const address = await reverseGeocodeMissionRequestLocation(coordinates);
      if (!address) return;
      if (kind === "pickup") setPickupAddress(address);
      else setDestinationAddress(address);
    } catch (_error) {
      // Les coordonnées restent valides même si le libellé Google est momentanément indisponible.
    }
  }, []);

  const handlePickupMapChange = useCallback(
    (coordinates) => resolveDroppedPin("pickup", coordinates),
    [resolveDroppedPin]
  );
  const handleDestinationMapChange = useCallback(
    (coordinates) => resolveDroppedPin("destination", coordinates),
    [resolveDroppedPin]
  );

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.geolocationUnsupported") });
      return;
    }
    setActivePoint("pickup");
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
          setPickupAddress(address || t("mobilityBooking.currentPosition"));
        } catch (_error) {
          setPickupAddress(t("mobilityBooking.currentPosition"));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setFeedback({ type: "error", message: t("mobilityBooking.errors.geolocation") });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const calculateEstimate = async () => {
    if (!tradeCategory || !countryId) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.unavailable") });
      return false;
    }
    if (!(pickupAddress.trim() || hasCoordinates(pickup)) || !(destinationAddress.trim() || hasCoordinates(destination))) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.locations") });
      return false;
    }

    setEstimating(true);
    setFeedback(null);
    try {
      const data = await estimateMissionRequest({
        countryId: Number(countryId),
        tradeCategoryId: Number(tradeCategory.id),
        requestedVehicleType: vehicleType,
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
            ? t("mobilityBooking.errors.draftSaved")
            : error?.response?.data?.error || t("mobilityBooking.errors.estimate"),
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
      setFeedback({ type: "error", message: t("mobilityBooking.errors.clientAccountRequired") });
      return;
    }
    if (!sessionUser && !phone.trim()) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.identity") });
      return;
    }
    if (!sessionUser && pinRequired && !pin.trim()) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.pinRequired") });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const commonPayload = {
      tradeCategoryId: Number(tradeCategory.id),
      title: t(`mobilityBooking.vehicle.${vehicleType}.missionTitle`),
      requestedVehicleType: vehicleType,
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
        isNewAccount: Boolean(data?.isNewAccount),
        generatedPin: data?.generatedPin || null,
        startCode: data?.startCode || null,
      });
      clearTaxiDraft();
    } catch (error) {
      const status = error?.response?.status;
      const requiresPin = status === 401 && error?.response?.data?.code === "PIN_REQUIRED";
      if (requiresPin) setPinRequired(true);
      setFeedback({
        type: "error",
        message:
          requiresPin
            ? t("mobilityBooking.errors.pinRequired")
            : status === 401
            ? t("mobilityBooking.errors.wrongPin")
            : !error?.response || !isOnline
            ? t("mobilityBooking.errors.draftSaved")
            : error?.response?.data?.error || t("mobilityBooking.errors.submit"),
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
        <AuthFeedbackBanner type="success" message={t("mobilityBooking.success.message")} />
        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              {t("mobilityBooking.success.title")}
            </h2>
            <p className="text-sm text-text-secondary">
              {t("mobilityBooking.success.reference", { id: result.mission?.id })}
            </p>
          </div>
        </div>
        {result.startCode ? (
          <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
              <KeyRound size={18} /> {t("mobilityBooking.success.startCodeTitle")}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-text-primary">
              {result.startCode}
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              {t("mobilityBooking.success.startCodeHint")}
            </p>
          </div>
        ) : null}
        {result.generatedPin ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
            <p className="text-sm font-semibold">{t("mobilityBooking.success.generatedPinTitle")}</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em]">
              {result.generatedPin}
            </p>
            <p className="mt-2 text-xs">{t("mobilityBooking.success.generatedPinHint")}</p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/missions/${result.mission?.id}/track`}
            className="btn-primary rounded-full px-6 py-2.5 text-sm"
          >
            {t("mobilityBooking.success.track")}
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="btn-secondary rounded-full px-6 py-2.5 text-sm">
            {t("mobilityBooking.success.newRide")}
          </button>
        </div>
      </div>
    );
  }

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
            <span>{t("mobilityBooking.offline")}</span>
          </div>
        ) : null}

        {initialDraft.pickupAddress || initialDraft.destinationAddress || initialDraft.phone ? (
          <p className="mb-5 flex items-center gap-2 rounded-2xl bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            <CheckCircle2 size={16} /> {t("mobilityBooking.draftRestored")}
          </p>
        ) : null}

        {assistanceTelHref || assistanceWhatsappHref ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {assistanceWhatsappHref ? (
              <a
                href={assistanceWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-700 bg-emerald-600 px-4 py-3 text-white shadow-sm hover:bg-emerald-700"
              >
                <MessageCircle size={21} />
                <span>
                  <strong className="block text-sm">{t("mobilityBooking.whatsapp.title")}</strong>
                  <span className="block text-xs text-emerald-50">
                    {t("mobilityBooking.whatsapp.hint")}
                  </span>
                </span>
              </a>
            ) : null}
            {assistanceTelHref ? (
              <a
                href={assistanceTelHref}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface-main px-4 py-3 text-text-primary hover:border-blue-400"
              >
                <Phone size={20} className="text-blue-700 dark:text-blue-300" />
                <span>
                  <strong className="block text-sm">{t("mobilityBooking.callTitle")}</strong>
                  <span className="block text-xs text-text-muted">
                    {t("mobilityBooking.callUs", { phone: selectedCountry.contactPhone })}
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        ) : null}

        <ol className="mb-7 grid grid-cols-3 gap-2" aria-label={t("mobilityBooking.steps.label")}>
          {["vehicle", "route", "confirm"].map((key, index) => {
            const number = index + 1;
            const active = step === number;
            const complete = step > number;
            return (
              <li
                key={key}
                aria-current={active ? "step" : undefined}
                className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : complete
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-border bg-surface-main text-text-muted"
                }`}
              >
                <span className="block text-[0.65rem] uppercase tracking-wide">
                  {t("mobilityBooking.steps.number", { number })}
                </span>
                {t(`mobilityBooking.steps.${key}`)}
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("mobilityBooking.vehicle.title")}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {VEHICLES.map(({ value, icon: Icon }) => {
                const selected = vehicleType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleVehicleChange(value)}
                    aria-pressed={selected}
                    className={`min-h-28 rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-border bg-surface-main text-text-primary hover:border-blue-400"
                    }`}
                  >
                    <Icon size={26} />
                    <span className="mt-3 block text-base font-semibold">
                      {t(`mobilityBooking.vehicle.${value}.label`)}
                    </span>
                    <span className={`mt-1 block text-xs ${selected ? "text-blue-100" : "text-text-muted"}`}>
                      {t(`mobilityBooking.vehicle.${value}.hint`)}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button type="button" onClick={() => setStep(2)} className="mt-6 w-full rounded-full">
              {t("mobilityBooking.steps.next")}
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("mobilityBooking.steps.routeTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("mobilityBooking.steps.routeHint")}</p>
            <div className="mt-5 space-y-4">
              <FormField label={t("mobilityBooking.pickupLabel")} required>
                <LocationAutocompleteInput
                  className={inputClass}
                  value={pickupAddress}
                  placeholder={t("mobilityBooking.pickupPlaceholder")}
                  onFocus={() => setActivePoint("pickup")}
                  onChange={(value) => {
                    setPickupAddress(value);
                    setPickup(null);
                    invalidateEstimate();
                  }}
                  onPlaceSelected={({ address, latitude, longitude }) => {
                    setPickupAddress(address);
                    setPickup({ latitude, longitude });
                    setActivePoint("destination");
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
                {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                {locating ? t("mobilityBooking.locating") : t("mobilityBooking.useCurrentLocation")}
              </button>

              <FormField label={t("mobilityBooking.destinationLabel")} required>
                <LocationAutocompleteInput
                  className={inputClass}
                  value={destinationAddress}
                  placeholder={t("mobilityBooking.destinationPlaceholder")}
                  onFocus={() => setActivePoint("destination")}
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
            </div>

            <button
              type="button"
              onClick={() => setShowMap((current) => !current)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:border-blue-400"
            >
              <Map size={17} />
              {t(showMap ? "mobilityBooking.hideMap" : "mobilityBooking.showMap")}
            </button>

            {showMap ? (
              <div className="mt-4">
                <TaxiRouteMap
                  pickup={pickup}
                  destination={destination}
                  activePoint={activePoint}
                  onPickupChange={handlePickupMapChange}
                  onDestinationChange={handleDestinationMapChange}
                />
                <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                  <MapPinned size={13} />
                  {t("mobilityBooking.mapHint", {
                    point: t(`mobilityBooking.point.${activePoint}`),
                  })}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                <ArrowLeft size={16} /> {t("mobilityBooking.steps.back")}
              </button>
              <Button
                type="button"
                onClick={calculateEstimate}
                loading={estimating}
                disabled={!tradeCategory || !countryId}
                className="min-h-11 flex-1 rounded-full"
              >
                <Route size={16} />
                {t("mobilityBooking.estimateCta")}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 && estimate ? (
          <section>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("mobilityBooking.steps.confirmTitle")}
            </h2>
            <div className="mt-4 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {t("mobilityBooking.estimateTitle")}
              </p>
              {estimate.basePrice != null ? (
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {t("mobilityBooking.price", {
                    amount: Math.round(Number(estimate.basePrice)),
                    currency: estimate.currency,
                  })}
                </p>
              ) : (
                <p className="mt-1 text-base font-semibold text-text-primary">
                  {t("mobilityBooking.quoteOnly")}
                </p>
              )}
              <p className="mt-2 text-sm text-text-secondary">
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
                    <Clock3 size={13} /> {t("mobilityBooking.duration", { minutes: estimate.durationMinutes })}
                  </span>
                ) : null}
              </div>
            </div>

            {!sessionUser && !incompatibleUser ? (
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {t("mobilityBooking.identity.title")}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">{t("mobilityBooking.identity.hint")}</p>
                </div>
                <FormField label={t("mobilityBooking.identity.phone")} required>
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
                <FormField label={t("mobilityBooking.identity.firstName")}>
                  <input
                    type="text"
                    autoComplete="given-name"
                    className={inputClass}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder={t("mobilityBooking.identity.firstNamePlaceholder")}
                  />
                </FormField>
                {pinRequired ? (
                  <FormField label={t("mobilityBooking.identity.pin")} required>
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
                {countries.length > 1 ? (
                  <FormField label={t("mobilityBooking.identity.country")} required>
                    <select
                      className={inputClass}
                      value={countryId}
                      onChange={(event) => {
                        setCountryId(event.target.value);
                        invalidateEstimate();
                        setStep(2);
                      }}
                    >
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>{country.name}</option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
              </div>
            ) : null}

            {sessionUser ? (
              <p className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                {t("mobilityBooking.connectedAs", { name: sessionUser.firstName || sessionUser.phone || "" })}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                <ArrowLeft size={16} /> {t("mobilityBooking.steps.back")}
              </button>
              <Button
                type="submit"
                loading={submitting}
                disabled={Boolean(incompatibleUser) || !isOnline}
                className="min-h-11 flex-1 rounded-full"
              >
                {t(`mobilityBooking.book.${vehicleType}`)}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </form>
  );
}
