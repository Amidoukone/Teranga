import { useTranslation } from "react-i18next";
import { MapPin, Star } from "lucide-react";

import LocationAutocompleteInput from "../LocationAutocompleteInput";
import MissionLocationMap from "../MissionLocationMap";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-text-primary";

export default function LocationStep({
  address,
  coordinates,
  onAddressChange,
  onPlaceSelected,
  onMapPositionChange,
  savedLocations,
  loadingSavedLocations,
  onSelectSavedLocation,
  saveThisLocation,
  onToggleSaveThisLocation,
  newLocationLabel,
  onLocationLabelChange,
}) {
  const { t } = useTranslation();

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
