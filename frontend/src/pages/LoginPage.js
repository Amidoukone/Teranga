import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, me } from "../services/auth";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const { t } = useTranslation();
  // Champs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

 // Aatats
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  /* ==========================================================
     Initialisation au montage.
  ========================================================== */
  useEffect(() => {
    const msg = location.state?.successMsg;
    const routeError = location.state?.errorMsg;
    if (msg) {
      setSuccessMsg(msg);
    }
    if (routeError) {
      setErrorMsg(routeError);
    }
    if (msg || routeError) {
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  /* ==========================================================
     Initialisation au montage.
  ========================================================== */
  useEffect(() => {
    async function check() {
      try {
        const u = await me();
        if (u?.user && !u?.offline) navigate("/dashboard");
      } catch {}
    }
    check();
  }, [navigate]);

  /* ==========================================================
     Module: authentification et acces utilisateur.
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
      setErrorMsg(backendMsg || t("auth.login.errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     Rendu principal.
  ========================================================== */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
      <div className="page-shell w-full max-w-md p-8 relative">

        {/* ---------- LOGO + TITRE ---------- */}
        <div className="text-center mb-8">
          <p className="page-kicker mb-3">{t("auth.login.kicker")}</p>
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-sm"
          />

          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {t("auth.login.title")}
          </h1>

          <p className="page-lead mt-1">{t("auth.login.subtitle")}</p>
        </div>

 {/* ---------- MESSAGE DE SUCCES ---------- */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

 {/* ---------- MESSAGE D'ERREUR ---------- */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm shadow-sm">
            {errorMsg}
          </div>
        )}

        {/* ---------- FORMULAIRE ---------- */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t("auth.login.emailLabel")}
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />

              <input
                type="email"
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t("auth.login.passwordLabel")}
            </label>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />

              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-border rounded-xl pl-10 pr-10 py-2 text-sm bg-surface-card text-text-primary
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={t("auth.login.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                aria-label={
                  showPassword
                    ? t("auth.login.passwordHide")
                    : t("auth.login.passwordShow")
                }
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-blue-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-main px-3 py-2 text-sm text-text-secondary">
            {t("auth.login.forgotInfo", {
              defaultValue:
                "Mot de passe oublie ? Contactez l'admin ou le master de votre pays/region pour reinitialiser. Ensuite, vous pourrez le modifier dans votre compte.",
            })}
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
                {t("auth.login.submitting")}
              </>
            ) : (
              t("auth.login.submit")
            )}
          </button>
        </form>

 {/* ---------- LIENS SUPPLAaMENTAIRES ---------- */}
        <div className="mt-8 text-center text-sm text-text-secondary">
          <p className="mb-2">{t("auth.login.clientNoAccount")}</p>

          <Link
            to="/register"
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            {t("auth.login.createAccount")}
          </Link>

          <p className="mt-4 text-text-muted text-xs">
            {t("auth.login.supportInfo")}
          </p>
        </div>
      </div>
    </div>
  );
}



