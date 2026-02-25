import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguage, setLanguage } from "../i18n";
import { getLocalUser, updateMyLanguage } from "../services/auth";

export default function LanguageSwitcher({ className = "", compact = false }) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [useShortLabels, setUseShortLabels] = useState(false);

  const current = normalizeLanguage(i18n.language) || "fr";

  useEffect(() => {
    if (!compact || typeof window === "undefined" || !window.matchMedia) {
      setUseShortLabels(false);
      return undefined;
    }

    const media = window.matchMedia("(max-width: 440px)");
    const sync = () => setUseShortLabels(media.matches);
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, [compact]);

  const frLabel = useShortLabels ? "FR" : t("language.fr");
  const enLabel = useShortLabels ? "EN" : t("language.en");

  async function handleChange(e) {
    const next = normalizeLanguage(e.target.value);
    if (!next || next === current) return;

    setLanguage(next);

    const user = getLocalUser();
    if (user?.id) {
      try {
        setSaving(true);
        await updateMyLanguage(next);
      } catch (err) {
        console.warn("Language update failed:", err?.message || err);
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      {!compact && (
        <div className="text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
          {t("language.label")}
        </div>
      )}
      <select
        value={current}
        onChange={handleChange}
        disabled={saving}
        className={[
          "rounded-lg border border-border bg-surface-main/50 text-text-primary",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          compact ? "max-w-full" : "w-full max-w-full",
          compact
            ? useShortLabels
              ? "w-[4.75rem] min-w-[4.75rem] px-2 py-1.5 pr-6 text-xs"
              : "w-[7.75rem] min-w-[7rem] px-2.5 py-1.5 pr-7 text-xs sm:w-auto"
            : "min-w-[8.5rem] px-3 py-2 pr-8 text-sm",
        ].join(" ")}
        aria-label={t("language.label")}
        title={t("language.label")}
      >
        <option value="fr">{frLabel}</option>
        <option value="en">{enLabel}</option>
      </select>
    </div>
  );
}
