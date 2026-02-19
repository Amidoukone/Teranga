import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function RecoveryCodesPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const recoveryCodes = Array.isArray(location.state?.recoveryCodes)
    ? location.state.recoveryCodes
    : [];
  const warning = String(location.state?.warning || '').trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {t('auth.recoveryCodes.title', { defaultValue: 'Codes de recuperation' })}
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          {t('auth.recoveryCodes.subtitle', {
            defaultValue:
              'Conservez ces codes dans un endroit sur. Ils ne seront plus affiches.',
          })}
        </p>

        {warning ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {warning}
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <code
                key={code}
                className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
              >
                {code}
              </code>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t('auth.recoveryCodes.empty', {
              defaultValue:
                "Aucun code disponible. Verifiez que la migration recovery_codes est appliquee.",
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            {t('auth.recoveryCodes.toLogin', { defaultValue: 'Aller a la connexion' })}
          </button>
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            {t('auth.recoveryCodes.loginLink', { defaultValue: 'Connexion' })}
          </Link>
        </div>
      </div>
    </div>
  );
}
