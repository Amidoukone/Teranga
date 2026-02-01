import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, me } from "../services/auth";
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

/* ==========================================================
   🌍 Suggestions de pays ISO2
========================================================== */
const COUNTRY_SUGGESTIONS = [
  { code: "ML", name: "Mali 🇲🇱" },
  { code: "SN", name: "Sénégal 🇸🇳" },
  { code: "CI", name: "Côte d’Ivoire 🇨🇮" },
  { code: "NE", name: "Niger 🇳🇪" },
  { code: "BF", name: "Burkina Faso 🇧🇫" },
  { code: "FR", name: "France 🇫🇷" },
  { code: "BE", name: "Belgique 🇧🇪" },
  { code: "CA", name: "Canada 🇨🇦" },
  { code: "US", name: "États-Unis 🇺🇸" },
];

// map “nom saisi” -> ISO2 (simple mais efficace, extensible)
function normalizeCountryInputToISO2(inputRaw = "", suggestions = []) {
  const raw = String(inputRaw || "").trim();
  if (!raw) return "";

  // Si déjà ISO2
  const maybeIso2 = raw.toUpperCase().slice(0, 2);
  if (/^[A-Z]{2}$/.test(maybeIso2) && raw.length <= 2) return maybeIso2;

  // Normalisation “nom”
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

    // match exact ou “contient”
    if (normalized === labelNorm || labelNorm.includes(normalized)) {
      return String(s.code || "").toUpperCase().slice(0, 2);
    }
  }

  // fallback: si l’utilisateur tape “Mali”, “Senegal”, etc (sans emoji)
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

  // Si l’utilisateur tape un truc du style “ML - Mali”
  if (/^[A-Za-z]{2}\b/.test(raw)) return raw.toUpperCase().slice(0, 2);

  return "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
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
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();

  /* ==========================================================
     🔐 Redirection si déjà connecté
  ========================================================== */
  useEffect(() => {
    let active = true;

    async function checkUser() {
      try {
        const u = await me();
        if (!active) return;
        if (u?.user) navigate("/dashboard");
      } catch {
        // ignore
      }
    }

    checkUser();
    return () => {
      active = false;
    };
  }, [navigate]);

  /* ==========================================================
     Pays ISO2 “canonique” calculé (pour multi-pays master)
  ========================================================== */
  const countryISO2 = useMemo(() => {
    return (
      normalizeCountryInputToISO2(form.country, COUNTRY_SUGGESTIONS) ||
      String(form.country || "").toUpperCase().slice(0, 2)
    );
  }, [form.country]);

  useEffect(() => {
    if (countryISO2 && /^[A-Z]{2}$/.test(countryISO2)) {
      localStorage.setItem("teranga_register_country", countryISO2);
    }
  }, [countryISO2]);

  /* ==========================================================
     Mise à jour champs
  ========================================================== */
  function updateField(field, value) {
    // Email en minuscules
    if (field === "email") value = String(value || "").toLowerCase();
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ==========================================================
     Validation (front) — cohérente et non bloquante
  ========================================================== */
  function validate() {
    const firstName = String(form.firstName || "").trim();
    const lastName = String(form.lastName || "").trim();
    const email = String(form.email || "").trim().toLowerCase();
    const password = String(form.password || "");
    const iso2 = String(countryISO2 || "").trim();

    if (!firstName) return "Veuillez renseigner votre prénom.";
    if (!lastName) return "Veuillez renseigner votre nom.";
    if (!email || !EMAIL_RE.test(email)) return "Adresse email invalide.";
    if (!password || password.length < 8)
      return "Le mot de passe doit contenir au moins 8 caractères.";
    if (!iso2 || !/^[A-Z]{2}$/.test(iso2))
      return "Veuillez renseigner un pays valide (format ISO2 : ML, SN, FR...).";

    return "";
  }

  /* ==========================================================
     🚀 Inscription
  ========================================================== */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...form,
        email: String(form.email || "").trim().toLowerCase(),
        firstName: String(form.firstName || "").trim(),
        lastName: String(form.lastName || "").trim(),
        phone: String(form.phone || "").trim() || undefined,
        country: countryISO2, // ✅ multi-pays safe : ISO2 canonique
        role: "client",
      };

      await register(payload);

      navigate("/login", {
        state: {
          successMsg:
            "✔ Votre compte a été créé avec succès ! Vous pouvez vous connecter.",
        },
      });
    } catch (err) {
      const backendMsg = err?.response?.data?.error;
      setErrorMsg(
        backendMsg || "Une erreur est survenue. Vérifiez vos informations."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     🖼️ UI — Apple Light Premium A1
  ========================================================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
      <div className="page-shell w-full max-w-md p-8">
        {/* HEADER */}
        <div className="text-center mb-8">
          <p className="page-kicker mb-3">Rejoignez Teranga</p>
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Créer un compte
          </h1>
          <p className="text-sm text-slate-600">
            Inscription pour les <strong>clients</strong>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Les agents et administrateurs sont ajoutés par Teranga.
          </p>
        </div>

        {/* MESSAGE ERREUR */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
            {errorMsg}
          </div>
        )}

        {/* FORMULAIRE */}
        <form onSubmit={handleRegister} className="space-y-5">
          {/* CHAMPS CLASSIQUES */}
          {[
            {
              field: "firstName",
              label: "Prénom",
              icon: User,
              placeholder: "Votre prénom",
              required: true,
            },
            {
              field: "lastName",
              label: "Nom",
              icon: User,
              placeholder: "Votre nom",
              required: true,
            },
            {
              field: "email",
              label: "Adresse email",
              icon: Mail,
              type: "email",
              placeholder: "exemple@email.com",
              required: true,
            },
            {
              field: "phone",
              label: "Téléphone (optionnel)",
              icon: Phone,
              type: "tel",
              placeholder: "+223 70 00 00 00",
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
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  {label}
                </label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={type}
                    value={form[field]}
                    placeholder={placeholder}
                    onChange={(e) => updateField(field, e.target.value)}
                    required={required}
                    className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )
          )}

          {/* 🌍 PAYS */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Pays (ISO2 ou nom)
            </label>

            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={form.country}
                placeholder="ML, SN, FR… ou nom du pays"
                onChange={(e) => updateField("country", e.target.value)}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Exemple : <strong>ML</strong> pour Mali, <strong>SN</strong> pour
              Sénégal.{" "}
              {countryISO2 && /^[A-Z]{2}$/.test(countryISO2) ? (
                <>
                  (Détecté : <strong>{countryISO2}</strong>)
                </>
              ) : null}
            </p>

            {/* SUGGESTIONS */}
            <div className="mt-3 flex flex-wrap gap-2">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => updateField("country", c.code)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    countryISO2 === c.code
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 🔐 MOT DE PASSE */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={form.password}
                placeholder="••••••••"
                onChange={(e) => updateField("password", e.target.value)}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-blue-600"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Minimum <strong>8 caractères</strong>.
            </p>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white font-semibold rounded-xl transition flex items-center justify-center shadow-sm
              ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" /> Création…
              </>
            ) : (
              "Créer mon compte"
            )}
          </button>
        </form>

        {/* FOOTER */}
        <div className="mt-8 text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link
            to="/login"
            className="text-blue-600 font-medium hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
