import { useState, useEffect } from "react";
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

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    country: "ML",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();

  /* ==========================================================
     🔐 Redirection si déjà connecté
  ========================================================== */
  useEffect(() => {
    async function checkUser() {
      try {
        const u = await me();
        if (u?.user) navigate("/dashboard");
      } catch {}
    }
    checkUser();
  }, [navigate]);

  /* ==========================================================
     Mise à jour champs
  ========================================================== */
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ==========================================================
     🚀 Inscription
  ========================================================== */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const payload = {
        ...form,
        country: (form.country || "").toUpperCase().slice(0, 2),
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/40 to-white px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-lg shadow-slate-200/50 rounded-3xl p-8 border border-slate-200">

        {/* HEADER */}
        <div className="text-center mb-8">
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
          ].map(({ field, label, icon: Icon, type = "text", placeholder, required }) => (
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
          ))}

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
              Exemple : <strong>ML</strong> pour Mali, <strong>SN</strong> pour Sénégal.
            </p>

            {/* SUGGESTIONS */}
            <div className="mt-3 flex flex-wrap gap-2">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => updateField("country", c.code)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    form.country?.toUpperCase().slice(0, 2) === c.code
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
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-blue-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
