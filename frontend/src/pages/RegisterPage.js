import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, me } from "../services/auth";
import { Eye, EyeOff, Loader2, User, Mail, Phone, Globe, Lock } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    country: "",
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
     📝 Mise à jour champs
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
      const payload = { ...form, role: "client" };

      // Normalisation ISO2 du pays
      if (payload.country) {
        payload.country = payload.country.toUpperCase().slice(0, 2);
      }

      await register(payload);

      navigate("/login", {
        state: {
          successMsg: "✔ Votre compte a été créé avec succès ! Vous pouvez vous connecter.",
        },
      });

    } catch (err) {
      console.error("Erreur register:", err);

      // Affichage du vrai message backend
      const backendMsg = err?.response?.data?.error;
      setErrorMsg(backendMsg || "Une erreur est survenue. Vérifiez vos informations.");
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     🖼️ UI
  ========================================================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* ----------- LOGO & TITRE ----------- */}
        <div className="text-center mb-8">
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-2 drop-shadow-sm"
          />
          <h1 className="text-2xl font-extrabold text-blue-700 tracking-tight">
            Créer un compte
          </h1>
          <p className="text-gray-600 text-sm">
            Inscription réservée aux <strong>clients</strong>
          </p>
          <p className="text-xs text-gray-500">
            Les agents et administrateurs sont gérés par l’équipe Teranga.
          </p>
        </div>

        {/* ----------- MESSAGE ERREUR ----------- */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        {/* ----------- FORMULAIRE ----------- */}
        <form onSubmit={handleRegister} className="space-y-5">

          {/* Champs communs */}
          {[
            { field: "firstName", label: "Prénom", icon: User, type: "text", placeholder: "Votre prénom", required: true },
            { field: "lastName", label: "Nom", icon: User, type: "text", placeholder: "Votre nom", required: true },
            { field: "email", label: "Adresse email", icon: Mail, type: "email", placeholder: "exemple@email.com", required: true },
            { field: "phone", label: "Téléphone (optionnel)", icon: Phone, type: "tel", placeholder: "+221 77 000 00 00", required: false },
            { field: "country", label: "Pays (ISO2)", icon: Globe, type: "text", placeholder: "SN, ML, FR…", required: false },
          ].map(({ field, label, icon: Icon, type, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                  required={required}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm 
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {field === "country" && (
                <p className="text-xs text-gray-500 mt-1">
                  Code ISO2 (ex : <strong>SN</strong> = Sénégal).
                </p>
              )}
            </div>
          ))}

          {/* Champ mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
                minLength={8} // 🔥 Aligné avec backend
                className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 text-sm 
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-blue-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Minimum <strong>8</strong> caractères.
            </p>
          </div>

          {/* BOUTON */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white font-semibold rounded-lg transition flex items-center justify-center
              ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"}`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Création…
              </>
            ) : (
              "Créer mon compte"
            )}
          </button>
        </form>

        {/* ----------- LIEN CONNEXION ----------- */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">Déjà un compte ?</p>

          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            🔑 Se connecter
          </Link>
        </div>

      </div>
    </div>
  );
}
