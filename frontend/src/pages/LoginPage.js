import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, me } from "../services/auth";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  // Champs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // États
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  /* ==========================================================
     ✔ Affiche le message de réussite (depuis /register)
  ========================================================== */
  useEffect(() => {
    const msg = location.state?.successMsg;
    if (msg) {
      setSuccessMsg(msg);
      window.history.replaceState({}, ""); // Nettoyage de l'historique
    }
  }, [location.state]);

  /* ==========================================================
     🔐 Redirection automatique si déjà connecté
  ========================================================== */
  useEffect(() => {
    async function check() {
      try {
        const u = await me();
        if (u?.user) navigate("/dashboard");
      } catch {}
    }
    check();
  }, [navigate]);

  /* ==========================================================
     🚀 Connexion
  ========================================================== */
  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      const backendMsg = err?.response?.data?.error;
      setErrorMsg(
        backendMsg || "Échec de connexion : identifiants incorrects."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     🖥️ UI — Apple Light Premium A1
  ========================================================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
      <div className="page-shell w-full max-w-md p-8 relative">

        {/* ---------- LOGO + TITRE ---------- */}
        <div className="text-center mb-8">
          <p className="page-kicker mb-3">Espace sécurisé</p>
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-sm"
          />

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Connexion à Teranga
          </h1>

          <p className="text-sm text-slate-600 mt-1">
            Accédez à votre espace sécurisé
          </p>
        </div>

        {/* ---------- MESSAGE DE SUCCÈS ---------- */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ---------- MESSAGE D’ERREUR ---------- */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
            {errorMsg}
          </div>
        )}

        {/* ---------- FORMULAIRE ---------- */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Adresse email
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />

              <input
                type="email"
                className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-2 text-sm bg-white 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Mot de passe
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />

              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-sm bg-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                aria-label={
                  showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-blue-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* BOUTON CONNEXION */}
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
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        {/* ---------- LIENS SUPPLÉMENTAIRES ---------- */}
        <div className="mt-8 text-center text-sm text-slate-600">
          <p className="mb-2">
            <strong>Client :</strong> vous n’avez pas encore de compte ?
          </p>

          <Link
            to="/register"
            className="text-blue-600 font-medium hover:underline"
          >
            ➕ Créer un compte client
          </Link>

          <p className="mt-4 text-slate-500 text-xs">
            Les comptes agents et administrateurs sont créés par l’équipe Teranga.
          </p>
        </div>
      </div>
    </div>
  );
}
