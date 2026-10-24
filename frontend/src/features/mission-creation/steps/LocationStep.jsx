import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Star, LocateFixed, Loader2 } from "lucide-react";

import LocationAutocompleteInput from "../LocationAutocompleteInput";
import { reverseGeocodeLocation } from "../../../services/missions";
import { notify } from "../../../utils/notify";

const MissionLocationMap = lazy(() => import("../MissionLocationMap"));

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-text-primary";

export default function LocationStep({
  address,
  coordinates,
  onAddressChange,
  onPlaceSelected,
  onMapPositionChange,
  onCurrentLocationResolved,
  savedLocations,
  loadingSavedLocations,
  onSelectSavedLocation,
  saveThisLocation,
  onToggleSaveThisLocation,
  newLocationLabel,
  onLocationLabelChange,
  requiresPickup,
  isMobilite,
  pickupAddress,
  pickupCoordinates,
  countryIso,
  countryName,
  regionName,
  onPickupAddressChange,
  onPickupPlaceSelected,
  onPickupMapPositionChange,
}) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showPickupMap, setShowPickupMap] = useState(false);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      notify(t("missionCreation.location.geolocationUnsupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        // Conserver le repère GPS même si le réseau ne permet pas de nommer le lieu.
        let resolvedAddress = null;
        try { resolvedAddress = await reverseGeocodeLocation({ latitude, longitude }); }
        catch (_error) { /* Les coordonnées restent utilisables. */ }
        finally { setLocating(false); }
        onCurrentLocationResolved({ latitude, longitude, address: resolvedAddress });
      },
      () => {
        setLocating(false);
        notify(t("missionCreation.location.geolocationError"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">
        {t("missionCreation.location.title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {t("missionCreation.location.subtitle")}
      </p>

      {savedLocations?.length > 0 ? (
        <div className="mt-5">
          <p className={labelClass}>{t("missionCreation.location.savedLocationsTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {savedLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => onSelectSavedLocation(loc)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-main px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-blue-400 hover:text-text-primary"
              >
                <Star size={12} />
                {loc.label || loc.address}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {requiresPickup ? (
        <div className="mt-5 rounded-xl border border-border bg-surface-main/60 p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {isMobilite
              ? t("missionCreation.location.departureTitle")
              : t("missionCreation.location.pickupTitle")}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            {isMobilite
              ? t("missionCreation.location.departureSubtitle")
              : t("missionCreation.location.pickupSubtitle")}
          </p>
          <div className="mt-3">
            <label htmlFor="mission-pickup-address" className={labelClass}>
              {isMobilite
                ? t("missionCreation.location.departureAddressLabel")
                : t("missionCreation.location.pickupAddressLabel")}
            </label>
            <LocationAutocompleteInput
              id="mission-pickup-address"
              className={inputClass}
              placeholder={t("missionCreation.location.pickupAddressPlaceholder")}
              value={pickupAddress}
              onChange={onPickupAddressChange}
              onPlaceSelected={onPickupPlaceSelected}
              countryIso={countryIso}
            />
          </div>
          <div className="mt-3">
            <button type="button" aria-expanded={showPickupMap} onClick={() => setShowPickupMap((value) => !value)} className="btn-secondary min-h-11 rounded-xl px-4 py-2 text-sm">
              {t(showPickupMap ? "missionCreation.location.hideMap" : "missionCreation.location.showMap")}
              {pickupCoordinates ? ` · ${t("missionCreation.location.positionSelected")}` : ""}
            </button>
            {showPickupMap ? <Suspense fallback={<p role="status">{t("missionCreation.location.loadingMap")}</p>}>
            <MissionLocationMap
              latitude={pickupCoordinates?.latitude}
              longitude={pickupCoordinates?.longitude}
              onPositionChange={onPickupMapPositionChange}
              countryName={countryName}
              regionName={regionName}
            />
            </Suspense> : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <label htmlFor="mission-address" className={labelClass}>
          {requiresPickup
            ? isMobilite
              ? t("missionCreation.location.destinationTitle")
              : t("missionCreation.location.dropoffTitle")
            : t("missionCreation.location.addressLabel")}
        </label>
        <LocationAutocompleteInput
          id="mission-address"
          className={inputClass}
          placeholder={t("missionCreation.location.addressPlaceholder")}
          value={address}
          onChange={onAddressChange}
          onPlaceSelected={onPlaceSelected}
          countryIso={countryIso}
        />
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium disabled:opacity-60"
        >
          {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
          {locating
            ? t("missionCreation.location.locating")
            : t("missionCreation.location.useCurrentLocation")}
        </button>
      </div>

      <div className="mt-4">
        <button type="button" aria-expanded={showMap} onClick={() => setShowMap((value) => !value)} className="btn-secondary min-h-11 rounded-xl px-4 py-2 text-sm">
          {t(showMap ? "missionCreation.location.hideMap" : "missionCreation.location.showMap")}
          {coordinates ? ` · ${t("missionCreation.location.positionSelected")}` : ""}
        </button>
        {showMap ? <Suspense fallback={<p role="status">{t("missionCreation.location.loadingMap")}</p>}>
        <MissionLocationMap
          latitude={coordinates?.latitude}
          longitude={coordinates?.longitude}
          onPositionChange={onMapPositionChange}
          countryName={countryName}
          regionName={regionName}
        />
        </Suspense> : null}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <MapPin size={13} />
          {t(showMap ? "missionCreation.location.mapHint" : "missionCreation.location.simpleHint")}
        </p>
      </div>

      {address ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-main/60 p-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={saveThisLocation}
              onChange={(e) => onToggleSaveThisLocation(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {t("missionCreation.location.saveThisLocation")}
          </label>
          {saveThisLocation ? (
            <input
              type="text"
              className={`${inputClass} mt-2`}
              placeholder={t("missionCreation.location.saveLocationLabelPlaceholder")}
              value={newLocationLabel}
              onChange={(e) => onLocationLabelChange(e.target.value)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
