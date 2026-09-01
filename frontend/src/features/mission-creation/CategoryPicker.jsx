import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Wrench,
  Zap,
  ShieldCheck,
  Sparkles,
  Paintbrush,
  Snowflake,
  Truck,
  ShoppingBag,
  FileText,
  CreditCard,
  Banknote,
  HelpCircle,
  CarFront,
} from "lucide-react";

// Grille de sélection de catégorie partagée entre le formulaire invité de la homepage
// (components/MissionRequestForm.jsx) et l'assistant de création guidée authentifié
// (features/mission-creation/MissionCreationWizard.jsx) — une seule UI de sélection de
// catégorie dans toute l'app (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 1).

export const CLASSIC_SERVICE_TYPES = ["errand", "administrative", "payment", "money_transfer", "other"];

const TRADE_CATEGORY_ICONS = {
  plomberie: Wrench,
  electricite: Zap,
  "securite-gardiennage": ShieldCheck,
  menage: Sparkles,
  peinture: Paintbrush,
  climatisation: Snowflake,
  livraison: Truck,
  mobilite: CarFront,
};

const CLASSIC_TYPE_ICONS = {
  errand: ShoppingBag,
  administrative: FileText,
  payment: CreditCard,
  money_transfer: Banknote,
  other: HelpCircle,
};

function normalizeSearch(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function CategoryChip({ label, Icon, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2.5 py-3.5 text-center text-[0.72rem] font-medium leading-tight transition sm:text-xs ${
        selected
          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
          : "border-border bg-surface-main text-text-secondary hover:border-blue-400 hover:text-text-primary"
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/**
 * @param {object} props
 * @param {Array<{id:number,name:string,slug:string}>} props.tradeCategories
 * @param {boolean} props.loading
 * @param {{requestKind: 'trade_category'|'classic'|null, tradeCategoryId?: string, serviceType?: string}} props.value
 * @param {(selection: {requestKind:string, tradeCategoryId?: string, serviceType?: string}) => void} props.onChange
 */
export default function CategoryPicker({ tradeCategories = [], loading = false, value, onChange }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const normalizedSearch = normalizeSearch(search);
  const visibleTradeCategories = useMemo(
    () => tradeCategories.filter((item) =>
      !normalizedSearch || normalizeSearch(`${item.name} ${item.slug}`).includes(normalizedSearch)
    ),
    [normalizedSearch, tradeCategories]
  );
  const visibleClassicTypes = useMemo(
    () => CLASSIC_SERVICE_TYPES.filter((key) =>
      !normalizedSearch || normalizeSearch(`${t(`services.type.${key}`)} ${key}`).includes(normalizedSearch)
    ),
    [normalizedSearch, t]
  );

  const selectTradeCategory = (id) =>
    onChange({ requestKind: "trade_category", tradeCategoryId: String(id), serviceType: "" });

  const selectClassicType = (key) =>
    onChange({ requestKind: "classic", serviceType: key, tradeCategoryId: "" });

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin" />
        {t("homePage.missionRequest.loadingOptions")}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="service-category-search" className="text-sm font-semibold text-text-primary">
        {t("missionCreation.categorySearch.label")}
      </label>
      <p id="service-category-search-hint" className="mt-1 text-xs text-text-muted">
        {t("missionCreation.categorySearch.hint")}
      </p>
      <input
        id="service-category-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("missionCreation.categorySearch.placeholder")}
        aria-describedby="service-category-search-hint"
        className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface-main px-4 text-base text-text-primary outline-none transition placeholder:text-text-muted focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
      {search && (visibleTradeCategories.length || visibleClassicTypes.length) ? (
        <p className="sr-only" role="status" aria-live="polite">
          {t("missionCreation.categorySearch.results", { count: visibleTradeCategories.length + visibleClassicTypes.length })}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
      {visibleTradeCategories.map((tc) => (
        <CategoryChip
          key={`trade-${tc.id}`}
          label={tc.name}
          Icon={TRADE_CATEGORY_ICONS[tc.slug] || Wrench}
          selected={value?.requestKind === "trade_category" && String(value?.tradeCategoryId) === String(tc.id)}
          onClick={() => selectTradeCategory(tc.id)}
        />
      ))}
      {visibleClassicTypes.map((key) => (
        <CategoryChip
          key={`classic-${key}`}
          label={t(`services.type.${key}`)}
          Icon={CLASSIC_TYPE_ICONS[key] || HelpCircle}
          selected={value?.requestKind === "classic" && value?.serviceType === key}
          onClick={() => selectClassicType(key)}
        />
      ))}
      </div>
      {!visibleTradeCategories.length && !visibleClassicTypes.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-secondary" role="status">
          {t("missionCreation.categorySearch.empty")}
        </p>
      ) : null}
    </div>
  );
}
