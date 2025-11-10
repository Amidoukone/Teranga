import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, me } from '../services/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // ✅ nouveau state
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ✅ Redirection si déjà connecté
  useEffect(() => {
    async function check() {
      try {
        const u = await me();
        if (u?.user) navigate('/dashboard');
      } catch {
        // pas connecté : normal
      }
    }
    check();
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (e) {
      alert('❌ Échec de connexion : vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* Logo / Titre */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🌍</span>
            <h1 className="text-2xl font-bold text-blue-700">Teranga</h1>
          </div>
          <p className="text-gray-600 text-sm">
            Connectez-vous à votre espace personnel
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Champ Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="exemple@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Champ Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} // 👀 bascule ici
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {/* Bouton afficher/masquer */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-blue-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  // 👁️ Icône "visible"
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.3 4.5 12 4.5c4.7 0 8.578 3.01 9.964 7.178a1.012 1.012 0 010 .644C20.578 16.49 16.7 19.5 12 19.5c-4.7 0-8.578-3.01-9.964-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ) : (
                  // 🙈 Icône "caché"
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223a10.477 10.477 0 00-1.7 3.77 1.012 1.012 0 000 .514C3.657 16.49 7.536 19.5 12 19.5c1.59 0 3.09-.312 4.45-.877m3.57-2.26A10.45 10.45 0 0021.72 12a10.48 10.48 0 00-4.312-5.44M9.88 9.88a3 3 0 104.24 4.24M3 3l18 18"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Bouton de connexion */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white font-semibold rounded-lg transition
              ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Aide / liens */}
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
            Les agents et administrateurs sont créés par l’administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}
