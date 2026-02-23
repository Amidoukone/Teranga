import { useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguage, setLanguage } from "../i18n";
import { getLocalUser, updateMyLanguage } from "../services/auth";

export default function LanguageSwitcher({ className = "", compact = false }) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);

  const current = normalizeLanguage(i18n.language) || "fr";

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
    <div className={className}>
      {!compact && (
        <div className="text-[0.65rem] uppercase tracking-widest text-text-muted mb-1">
          {t("language.label")}
        </div>
      )}
      <select
        value={current}
        onChange={handleChange}
        disabled={saving}
        className="rounded-lg border border-border bg-surface-main/50 px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label={t("language.label")}
      >
        <option value="fr">{t("language.fr")}</option>
        <option value="en">{t("language.en")}</option>
      </select>
    </div>
  );
}


