import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from "lucide-react";
import { changePassword, logout, me } from "../services/auth";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const res = await me();
        if (!res?.user) {
          navigate("/login");
        }
      } catch {
        navigate("/login");
      }
    }
    check();
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!currentPassword || !newPassword) {
      setErrorMsg("Tous les champs sont requis.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("Mot de passe trop court (minimum 8 caracteres).");
      return;
    }

    if (newPassword !== confirm) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
      });
      setSuccessMsg(res?.message || "Mot de passe modifie.");
      logout();
      navigate("/login", {
        state: { successMsg: "Mot de passe modifie. Reconnectez-vous." },
      });
    } catch (err) {
      const msg = err?.response?.data?.error || "Erreur de modification.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
      <div className="page-shell w-full max-w-md p-8 relative">
        <div className="text-center mb-8">
          <p className="page-kicker mb-3">Securite</p>
          <img
            src="/logo_180x180.png"
            alt="Logo Teranga"
            className="w-16 h-16 mx-auto mb-3 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Modifier le mot de passe
          </h1>
          <p className="page-lead mt-1">Protegez votre compte.</p>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Mot de passe actuel
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-sm bg-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="********"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Masquer" : "Afficher"}
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

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-sm bg-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="********"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-sm bg-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="********"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>

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
                Mise a jour...
              </>
            ) : (
              "Mettre a jour"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          <Link to="/dashboard" className="text-blue-600 font-medium hover:underline">
            Retour au dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
