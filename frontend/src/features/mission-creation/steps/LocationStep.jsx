import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Star, LocateFixed, Loader2 } from "lucide-react";

import LocationAutocompleteInput from "../LocationAutocompleteInput";
import MissionLocationMap from "../MissionLocationMap";
import { reverseGeocodeLocation } from "../../../services/missions";
import { notify } from "../../../utils/notify";

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
}) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);

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
        const resolvedAddress = await reverseGeocodeLocation({ latitude, longitude });
        setLocating(false);
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

      <div className="mt-5">
        <label className={labelClass}>{t("missionCreation.location.addressLabel")}</label>
        <LocationAutocompleteInput
          className={inputClass}
          placeholder={t("missionCreation.location.addressPlaceholder")}
          value={address}
          onChange={onAddressChange}
          onPlaceSelected={onPlaceSelected}
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
        <MissionLocationMap
          latitude={coordinates?.latitude}
          longitude={coordinates?.longitude}
          onPositionChange={onMapPositionChange}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <MapPin size={13} />
          {t("missionCreation.location.mapHint")}
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
