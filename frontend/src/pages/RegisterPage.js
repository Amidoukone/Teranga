import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/auth";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Loader2,
  User,
  Mail,
  Phone,
  Globe,
  Lock,
} from "lucide-react";
import { getMasterCountries } from "../services/franchises";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";
import { buildAuthFeedbackState } from "../utils/authFeedback";

/* ==========================================================
   Suggestions de pays ISO2
========================================================== */
const COUNTRY_SUGGESTIONS = [
  { code: "DZ", name: "Alg\u00E9rie" },
  { code: "AO", name: "Angola" },
  { code: "BJ", name: "B\u00E9nin" },
  { code: "BW", name: "Botswana" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "CM", name: "Cameroun" },
  { code: "CF", name: "R\u00E9publique centrafricaine" },
  { code: "TD", name: "Tchad" },
  { code: "KM", name: "Comores" },
  { code: "CG", name: "Congo (Republique)" },
  { code: "CD", name: "RD Congo" },
  { code: "DJ", name: "Djibouti" },
  { code: "EG", name: "\u00C9gypte" },
  { code: "GQ", name: "Guin\u00E9e \u00E9quatoriale" },
  { code: "ER", name: "\u00C9rythr\u00E9e" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "\u00C9thiopie" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambie" },
  { code: "GH", name: "Ghana" },
  { code: "GN", name: "Guin\u00E9e" },
  { code: "GW", name: "Guin\u00E9e-Bissau" },
  { code: "CI", name: "C\u00F4te d'Ivoire" },
  { code: "KE", name: "Kenya" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libye" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "ML", name: "Mali" },
  { code: "MR", name: "Mauritanie" },
  { code: "MU", name: "Maurice" },
  { code: "MA", name: "Maroc" },
  { code: "MZ", name: "Mozambique" },
  { code: "NA", name: "Namibie" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "RW", name: "Rwanda" },
  { code: "ST", name: "S\u00E3o Tom\u00E9-et-Principe" },
  { code: "SN", name: "S\u00E9n\u00E9gal" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SO", name: "Somalie" },
  { code: "ZA", name: "Afrique du Sud" },
  { code: "SS", name: "Soudan du Sud" },
  { code: "SD", name: "Soudan" },
  { code: "TZ", name: "Tanzanie" },
  { code: "TG", name: "Togo" },
  { code: "TN", name: "Tunisie" },
  { code: "UG", name: "Ouganda" },
  { code: "ZM", name: "Zambie" },
  { code: "ZW", name: "Zimbabwe" },
];

// map "nom saisi" -> ISO2 (simple mais efficace, extensible)
function normalizeCountryInputToISO2(inputRaw = "", suggestions = []) {
  const raw = String(inputRaw || "").trim();
  if (!raw) return "";

  // Si deja ISO2
  const maybeIso2 = raw.toUpperCase().slice(0, 2);
  if (/^[A-Z]{2}$/.test(maybeIso2) && raw.length <= 2) return maybeIso2;

  // Normalisation "nom"
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Cherche dans suggestions (en se basant sur le label)
  for (const s of suggestions) {
    const labelNorm = String(s.name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // match exact ou "contient"
    if (normalized === labelNorm || labelNorm.includes(normalized)) {
      return String(s.code || "").toUpperCase().slice(0, 2);
    }
  }

  // fallback: si l'utilisateur tape "Mali", "Senegal", etc (sans emoji)
  // -> on essaye aussi sur le premier mot des labels
  for (const s of suggestions) {
    const firstWord = String(s.name || "")
      .split(" ")[0]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "")
      .trim();

    const inputFirst = normalized.split(" ")[0]?.trim() || "";
    if (inputFirst && firstWord && inputFirst === firstWord) {
      return String(s.code || "").toUpperCase().slice(0, 2);
    }
  }

  // Si l'utilisateur tape un truc du style "ML - Mali"
  if (/^[A-Za-z]{2}\b/.test(raw)) return raw.toUpperCase().slice(0, 2);

  return "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{6,20}$/;

function normalizePhone(value) {
  const compact = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "")
    .replace(/[^\d+]/g, "");
  const hasLeadingPlus = compact.startsWith("+");
  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  if (!hasLeadingPlus && digits.startsWith("00") && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }
  return hasLeadingPlus ? `+${digits}` : digits;
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(() => {
    const savedCountry = localStorage.getItem("teranga_register_country") || "ML";
    return {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      country: savedCountry,
    };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [masterCountries, setMasterCountries] = useState([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterError, setMasterError] = useState("");

  const navigate = useNavigate();

  /* ==========================================================
     Pays ISO2 "canonique" calcule (pour multi-pays master)
  ========================================================== */
  const masterOptions = useMemo(() => {
    const map = new Map();
    for (const c of masterCountries) {
      const iso = String(c?.isoCode || "").toUpperCase().slice(0, 2);
      if (!iso || map.has(iso)) continue;
      map.set(iso, {
        code: iso,
        name: c?.name || iso,
      });
    }
    return Array.from(map.values());
  }, [masterCountries]);

  const suggestionsSource =
    masterOptions.length > 0 ? masterOptions : COUNTRY_SUGGESTIONS;

  const countryISO2 = useMemo(() => {
    return (
      normalizeCountryInputToISO2(form.country, suggestionsSource) ||
      String(form.country || "").toUpperCase().slice(0, 2)
    );
  }, [form.country, suggestionsSource]);

  const supportedIsoSet = useMemo(
    () => new Set(masterOptions.map((c) => c.code)),
    [masterOptions]
  );

  const countrySupported = supportedIsoSet.has(
    String(countryISO2 || "").toUpperCase()
  );

  useEffect(() => {
    if (countryISO2 && /^[A-Z]{2}$/.test(countryISO2)) {
      localStorage.setItem("teranga_register_country", countryISO2);
    }
  }, [countryISO2]);

  useEffect(() => {
    let active = true;
    (async () => {
      setMasterLoading(true);
      setMasterError("");
      try {
        const countries = await getMasterCountries();
        if (!active) return;
        const normalized = Array.isArray(countries) ? countries : [];
        setMasterCountries(normalized);
        if (!normalized.length) {
          setMasterError(t("auth.register.errors.countryNoMaster"));
        }
      } catch (err) {
        if (!active) return;
        console.error("RegisterPage load master countries error:", err);
        setMasterCountries([]);
        setMasterError(t("auth.register.errors.countriesUnavailable"));
      } finally {
        if (active) setMasterLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t]);

  /* ==========================================================
     Mise a jour champs
  ========================================================== */
  function updateField(field, value) {
    // Email en minuscules
    if (field === "email") value = String(value || "").toLowerCase();
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ==========================================================
     Validation (front) - coherente et non bloquante
  ========================================================== */
  function validate() {
    const firstName = String(form.firstName || "").trim();
    const lastName = String(form.lastName || "").trim();
    const email = String(form.email || "").trim().toLowerCase();
    const phone = normalizePhone(form.phone);
    const password = String(form.password || "");
    const iso2 = String(countryISO2 || "").trim();

    if (!firstName) return t("auth.register.errors.firstName");
    if (!lastName) return t("auth.register.errors.lastName");
    if (!phone && !email) return t("auth.register.errors.contact");
    if (phone && !PHONE_RE.test(phone)) return t("auth.register.errors.phone");
    if (email && !EMAIL_RE.test(email)) return t("auth.register.errors.email");
    if (!password || password.length < 8)
      return t("auth.register.errors.password");
    if (!iso2 || !/^[A-Z]{2}$/.test(iso2))
      return t("auth.register.errors.countryIso");
    if (masterLoading) return t("auth.register.errors.loadingCountries");
    if (masterError) return masterError;
    if (!countrySupported) return t("auth.register.errors.countryNoMaster");

    return "";
  }

  /* ==========================================================
     Inscription
  ========================================================== */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const validationError = validate();
    if (validationError) {
      setFeedback({ type: "error", message: validationError });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...form,
        email: String(form.email || "").trim().toLowerCase() || undefined,
        firstName: String(form.firstName || "").trim(),
        lastName: String(form.lastName || "").trim(),
        phone: normalizePhone(form.phone) || undefined,
        country: countryISO2, // multi-pays safe : ISO2 canonique
        language: i18n.language || "fr",
      };

      await register(payload);

      navigate("/login", {
        state: buildAuthFeedbackState(t("auth.register.success"), "success"),
      });
    } catch (err) {
      const backendMsg = err?.response?.data?.error;
      setFeedback({
        type: "error",
        message: backendMsg || t("auth.register.errors.generic"),
      });
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     UI - Apple Light Premium A1
  ========================================================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
      <div className="page-shell w-full max-w-md p-8">
        {/* HEADER */}
        <div className="text-center mb-8">
          <p className="page-kicker mb-3">{t("auth.register.kicker")}</p>
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {t("auth.register.title")}
          </h1>
          <p className="page-lead">
            {t("auth.register.subtitle")}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {t("auth.register.subline")}
          </p>
        </div>

        <AuthFeedbackBanner
          className="mb-4"
          type={feedback?.type}
          message={feedback?.message}
        />

        {/* FORMULAIRE */}
        <form onSubmit={handleRegister} className="space-y-5">
          {/* CHAMPS CLASSIQUES */}
          {[
            {
              field: "firstName",
              label: t("auth.register.firstName"),
              icon: User,
              placeholder: t("auth.register.firstNamePlaceholder"),
              required: true,
            },
            {
              field: "lastName",
              label: t("auth.register.lastName"),
              icon: User,
              placeholder: t("auth.register.lastNamePlaceholder"),
              required: true,
            },
            {
              field: "phone",
              label: t("auth.register.phone"),
              icon: Phone,
              type: "tel",
              placeholder: t("auth.register.phonePlaceholder"),
              required: false,
            },
            {
              field: "email",
              label: t("auth.register.email"),
              icon: Mail,
              type: "email",
              placeholder: t("auth.register.emailPlaceholder"),
              required: false,
            },
          ].map(
            ({
              field,
              label,
              icon: Icon,
              type = "text",
              placeholder,
              required,
            }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  {label}
                </label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
                  <input
                    type={type}
                    value={form[field]}
                    placeholder={placeholder}
                    onChange={(e) => updateField(field, e.target.value)}
                    required={required}
                    className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )
          )}

          {/* PAYS */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t("auth.register.countryLabel")}
            </label>

            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="text"
                value={form.country}
                placeholder={t("auth.register.countryPlaceholder")}
                onChange={(e) => updateField("country", e.target.value)}
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 bg-surface-card text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <p className="text-xs text-text-muted mt-1">
              {t("auth.register.countryExample")}{" "}
              {countryISO2 && /^[A-Z]{2}$/.test(countryISO2) ? (
                <>
                  ({t("auth.register.countryDetected")} <strong>{countryISO2}</strong>)
                </>
              ) : null}
            </p>

            {/* SUGGESTED PAYS COUVERTS */}
            <div className="mt-3">
              {masterLoading ? (
                <p className="text-xs text-text-muted">
                  {t("auth.register.countriesLoading")}
                </p>
              ) : masterError ? (
                <p className="text-xs text-rose-700 dark:text-rose-300">{masterError}</p>
              ) : masterOptions.length ? (
                <>
                  <p className="text-xs text-text-muted">
                    {t("auth.register.countriesHint", {
                      count: masterOptions.length,
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {masterOptions.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => updateField("country", c.code)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${
                          countryISO2 === c.code
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-surface-main text-text-secondary border-border hover:bg-surface-main/80"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-text-muted">
                  {t("auth.register.countriesEmpty")}
                </p>
              )}
              {!masterLoading && !masterError && countryISO2 && !countrySupported && (
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-2">
                  {t("auth.register.errors.countryNoMaster")}
                </p>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              {t("auth.register.regionInfo")}
            </div>
          </div>

          {/* {t("auth.register.passwordLabel")} */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t("auth.register.passwordLabel")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={form.password}
                placeholder={t("auth.register.passwordPlaceholder")}
                onChange={(e) => updateField("password", e.target.value)}
                className="w-full border border-border rounded-xl pl-10 pr-10 py-2 bg-surface-card text-text-primary text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-blue-600"
                aria-label={
                  showPassword
                    ? t("auth.register.passwordHide")
                    : t("auth.register.passwordShow")
                }
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {t("auth.register.passwordMin")}
            </p>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading || masterLoading || Boolean(masterError)}
            className={`w-full py-2.5 text-white font-semibold rounded-xl transition flex items-center justify-center shadow-sm
              ${
                loading || masterLoading || Boolean(masterError)
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" /> {t("auth.register.submitting")}
              </>
            ) : (
              t("auth.register.submit")
            )}
          </button>
        </form>

        {/* FOOTER */}
        <div className="mt-8 text-center text-sm text-text-secondary">
          {t("auth.register.haveAccount")}{" "}
          <Link
            to="/login"
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            {t("auth.register.loginLink")}
          </Link>
        </div>
      </div>
    </div>
  );
}












