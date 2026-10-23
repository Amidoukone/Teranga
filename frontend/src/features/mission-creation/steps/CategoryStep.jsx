import { useTranslation } from "react-i18next";
import CategoryPicker from "../CategoryPicker";

export default function CategoryStep({
  countries, regions, countryId, regionId, onCountryChange, onRegionChange,
  tradeCategories, classicTypes, loading, value, onChange,
}) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">
        {t("missionCreation.category.title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {t("missionCreation.category.subtitle")}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text-primary">
          {t("missionCreation.category.countryLabel")}
          <select
            className="mt-2 w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary"
            value={countryId}
            onChange={(event) => onCountryChange(event.target.value)}
            required
          >
            <option value="">{t("missionCreation.category.countryPlaceholder")}</option>
            {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
          </select>
        </label>
        {countryId && regions.length ? (
          <div>
            <label className="block text-sm font-medium text-text-primary">
              {t("missionCreation.category.regionLabel")}
              <select
                className="mt-2 w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary"
                value={regionId}
                onChange={(event) => onRegionChange(event.target.value)}
                aria-describedby="mission-region-hint"
              >
                <option value="">{t("missionCreation.category.regionPlaceholder")}</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </label>
            <p id="mission-region-hint" className="mt-1 text-xs font-normal text-text-muted">
              {t("missionCreation.category.regionHint")}
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-5">
        {countryId ? (
          <CategoryPicker
            tradeCategories={tradeCategories}
            classicTypes={classicTypes}
            loading={loading}
            value={value}
            onChange={onChange}
          />
        ) : (
          <p className="text-sm text-text-secondary" role="status">
            {t("missionCreation.category.chooseCountryFirst")}
          </p>
        )}
      </div>
    </div>
  );
}
