import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, me } from "../services/auth";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  // Champs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // États
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();

  // =====================================================================
  // 🔐 Redirection automatique si utilisateur déjà connecté
  // =====================================================================
  useEffect(() => {
    async function check() {
      try {
        const u = await me();
        if (u?.user) navigate("/dashboard");
      } catch {
        // utilisateur non connecté, normal
      }
    }
    check();
  }, [navigate]);

  // =====================================================================
  // 🚪 Connexion
  // =====================================================================
  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (e) {
      setErrorMsg("Échec de connexion : identifiants invalides.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================================
  // 🖥️ UI
  // =====================================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100 relative">

        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/logo_180x180.png" 
            alt="Logo Teranga" 
            className="w-16 h-16 mx-auto mb-2 drop-shadow-sm"
          />
          <h1 className="text-2xl font-extrabold text-blue-700 tracking-tight">
            Connexion Teranga
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Accédez à votre espace sécurisé
          </p>
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Mot de passe
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 text-sm 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* Afficher / cacher */}
              <button
                type="button"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-blue-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Connexion */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white font-semibold rounded-lg transition flex items-center justify-center
              ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"}`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        {/* Liens supplémentaires */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">
            <strong>Clients :</strong> Vous n’avez pas encore de compte ?
          </p>

          <Link
            to="/register"
            className="text-blue-600 font-medium hover:underline"
          >
            ➕ Créer un compte client
          </Link>

          <p className="mt-4 text-gray-500 text-xs">
            Les agents et administrateurs sont créés uniquement par l’administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}
