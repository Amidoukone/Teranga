import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bike,
  CarFront,
  Clock3,
  Loader2,
  LocateFixed,
  MapPinned,
  Phone,
  Route,
  ShieldCheck,
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

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";

const VEHICLES = [
  { value: "motorcycle", icon: Bike },
  { value: "car", icon: CarFront },
];

function isClient(user) {
  return user?.role === "client";
}

function hasCoordinates(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

export default function TaxiRideRequestForm() {
  const { t } = useTranslation();
  const [tradeCategory, setTradeCategory] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState("");
  const [loading, setLoading] = useState(true);

  const initialLocalUser = getLocalUser();
  const [sessionUser, setSessionUser] = useState(isClient(initialLocalUser) ? initialLocalUser : null);
  const [incompatibleUser, setIncompatibleUser] = useState(
    initialLocalUser && !isClient(initialLocalUser) ? initialLocalUser : null
  );

  const [vehicleType, setVehicleType] = useState("motorcycle");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickup, setPickup] = useState(null);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destination, setDestination] = useState(null);
  const [activePoint, setActivePoint] = useState("pickup");
  const [locating, setLocating] = useState(false);

  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

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

        const initialCountryId =
          verifiedUser?.countryId || mobility?.countryId || countryList[0]?.id || null;
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
  }, [t]);

  const selectedCountry = useMemo(
    () => countries.find((country) => String(country.id) === String(countryId)) || null,
    [countries, countryId]
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
      return;
    }
    if (!(pickupAddress.trim() || hasCoordinates(pickup)) || !(destinationAddress.trim() || hasCoordinates(destination))) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.locations") });
      return;
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
    } catch (error) {
      setEstimate(null);
      setFeedback({
        type: "error",
        message: error?.response?.data?.error || t("mobilityBooking.errors.estimate"),
      });
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
    if (!sessionUser && (!phone.trim() || !pin.trim())) {
      setFeedback({ type: "error", message: t("mobilityBooking.errors.identity") });
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
          pin: pin.trim(),
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
      });
    } catch (error) {
      const status = error?.response?.status;
      setFeedback({
        type: "error",
        message:
          status === 401
            ? t("mobilityBooking.errors.wrongPin")
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
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="lg:sticky lg:top-24 lg:self-start">
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

      <div className="rounded-3xl border border-border/70 bg-surface-card p-5 shadow-sm sm:p-6">
        {feedback ? (
          <div className="mb-5">
            <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
          </div>
        ) : null}

        <section>
          <h2 className="text-base font-semibold text-text-primary">
            {t("mobilityBooking.vehicle.title")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {VEHICLES.map(({ value, icon: Icon }) => {
              const selected = vehicleType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleVehicleChange(value)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-border bg-surface-main text-text-primary hover:border-blue-400"
                  }`}
                >
                  <Icon size={22} />
                  <span className="mt-2 block text-sm font-semibold">
                    {t(`mobilityBooking.vehicle.${value}.label`)}
                  </span>
                  <span className={`mt-0.5 block text-xs ${selected ? "text-blue-100" : "text-text-muted"}`}>
                    {t(`mobilityBooking.vehicle.${value}.hint`)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 space-y-4 border-t border-border/60 pt-5">
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
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-700 disabled:opacity-60 dark:text-blue-300"
          >
            {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
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
        </section>

        {!estimate ? (
          <Button
            type="button"
            onClick={calculateEstimate}
            loading={estimating}
            disabled={!tradeCategory || !countryId}
            className="mt-5 w-full rounded-full"
          >
            <Route size={16} />
            {t("mobilityBooking.estimateCta")}
          </Button>
        ) : (
          <section className="mt-5 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
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
          </section>
        )}

        {estimate && !sessionUser && !incompatibleUser ? (
          <section className="mt-5 space-y-4 border-t border-border/60 pt-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                {t("mobilityBooking.identity.title")}
              </h2>
              <p className="mt-1 text-xs text-text-muted">{t("mobilityBooking.identity.hint")}</p>
            </div>
            <FormField label={t("mobilityBooking.identity.phone")} required>
              <input
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+223 70 00 00 00"
                required
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("mobilityBooking.identity.pin")} required>
                <input
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  className={inputClass}
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="••••"
                  required
                />
              </FormField>
              <FormField label={t("mobilityBooking.identity.firstName")}>
                <input
                  type="text"
                  className={inputClass}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={t("mobilityBooking.identity.firstNamePlaceholder")}
                />
              </FormField>
            </div>
            {countries.length > 1 ? (
              <FormField label={t("mobilityBooking.identity.country")} required>
                <select className={inputClass} value={countryId} onChange={(event) => setCountryId(event.target.value)}>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </section>
        ) : null}

        {estimate && sessionUser ? (
          <p className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            {t("mobilityBooking.connectedAs", { name: sessionUser.firstName || sessionUser.phone || "" })}
          </p>
        ) : null}

        {estimate ? (
          <Button
            type="submit"
            loading={submitting}
            disabled={Boolean(incompatibleUser)}
            className="mt-5 w-full rounded-full"
          >
            {t(`mobilityBooking.book.${vehicleType}`)}
          </Button>
        ) : null}

        {selectedCountry?.contactPhone ? (
          <a
            href={`tel:${selectedCountry.contactPhone}`}
            className="mt-4 flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-main"
          >
            <Phone size={15} />
            {t("mobilityBooking.callUs", { phone: selectedCountry.contactPhone })}
          </a>
        ) : null}
      </div>
    </form>
  );
}
