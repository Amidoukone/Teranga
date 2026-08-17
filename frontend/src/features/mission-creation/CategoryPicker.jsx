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
      <Icon size={20} />
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
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
      {tradeCategories.map((tc) => (
        <CategoryChip
          key={`trade-${tc.id}`}
          label={tc.name}
          Icon={TRADE_CATEGORY_ICONS[tc.slug] || Wrench}
          selected={value?.requestKind === "trade_category" && String(value?.tradeCategoryId) === String(tc.id)}
          onClick={() => selectTradeCategory(tc.id)}
        />
      ))}
      {CLASSIC_SERVICE_TYPES.map((key) => (
        <CategoryChip
          key={`classic-${key}`}
          label={t(`services.type.${key}`)}
          Icon={CLASSIC_TYPE_ICONS[key] || HelpCircle}
          selected={value?.requestKind === "classic" && value?.serviceType === key}
          onClick={() => selectClassicType(key)}
        />
      ))}
    </div>
  );
}
