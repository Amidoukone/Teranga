import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr";
import en from "./locales/en";

const LANGUAGE_KEY = "teranga_lang";
const USER_KEY = "teranga_user";
const SUPPORTED_LANGS = ["fr", "en"];

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function normalizeLanguage(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("en")) return "en";
  return null;
}

function readUserLanguage() {
  try {
    const raw = safeGet(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeLanguage(parsed?.language);
  } catch {
    return null;
  }
}

function detectInitialLanguage() {
  const stored = normalizeLanguage(safeGet(LANGUAGE_KEY));
  if (stored) return stored;

  const userLang = readUserLanguage();
  if (userLang) return userLang;

  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav && nav.toLowerCase().startsWith("en")) return "en";
  return "fr";
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  try {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lng;
    }
  } catch {
    // noop
  }
});

export function setLanguage(lang) {
  const normalized = normalizeLanguage(lang);
  if (!normalized || !SUPPORTED_LANGS.includes(normalized)) return null;
  const current = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  if (current === normalized) {
    try {
      localStorage.setItem(LANGUAGE_KEY, normalized);
    } catch {
      // noop
    }
    return normalized;
  }
  i18n.changeLanguage(normalized);
  try {
    localStorage.setItem(LANGUAGE_KEY, normalized);
  } catch {
    // noop
  }
  return normalized;
}

export function getStoredLanguage() {
  return normalizeLanguage(safeGet(LANGUAGE_KEY));
}

export function getLocaleFromLang(lang) {
  const normalized = normalizeLanguage(lang);
  return normalized === "en" ? "en-US" : "fr-FR";
}

export default i18n;
