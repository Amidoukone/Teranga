import { useTranslation } from "react-i18next";
import CategoryPicker from "../CategoryPicker";

export default function CategoryStep({ tradeCategories, loading, value, onChange }) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">
        {t("missionCreation.category.title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {t("missionCreation.category.subtitle")}
      </p>
      <div className="mt-5">
        <CategoryPicker
          tradeCategories={tradeCategories}
          loading={loading}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
