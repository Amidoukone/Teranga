import { useTranslation } from "react-i18next";
import { getLocaleFromLang } from "./index";

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function useLocale() {
  const { i18n } = useTranslation();
  const locale = getLocaleFromLang(i18n.language);

  const formatNumber = (value, options) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(locale, options);
  };

  const formatDate = (value, options) => {
    const d = safeDate(value);
    if (!d) return "";
    return d.toLocaleDateString(locale, options);
  };

  const formatDateTime = (value, options) => {
    const d = safeDate(value);
    if (!d) return "";
    return d.toLocaleString(locale, options);
  };

  const formatTime = (value, options) => {
    const d = safeDate(value);
    if (!d) return "";
    return d.toLocaleTimeString(locale, options);
  };

  return {
    locale,
    formatNumber,
    formatDate,
    formatDateTime,
    formatTime,
  };
}
