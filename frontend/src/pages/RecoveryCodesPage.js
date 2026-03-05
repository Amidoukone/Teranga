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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-card shadow-sm p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {t('auth.recoveryCodes.title', { defaultValue: 'Codes de récupération' })}
        </h1>
        <p className="text-sm text-text-secondary mb-4">
          {t('auth.recoveryCodes.subtitle', {
            defaultValue:
              'Conservez ces codes dans un endroit sûr. Ils ne seront plus affichés.',
          })}
        </p>

        {warning ? (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {warning}
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <code
                key={code}
                className="rounded-lg bg-surface-main border border-border px-2 py-1.5 text-xs text-text-primary"
              >
                {code}
              </code>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            {t('auth.recoveryCodes.empty', {
              defaultValue:
                "Aucun code disponible. Vérifiez que la migration recovery_codes est appliquée.",
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            {t('auth.recoveryCodes.toLogin', { defaultValue: 'Aller à la connexion' })}
          </button>
          <Link to="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('auth.recoveryCodes.loginLink', { defaultValue: 'Connexion' })}
          </Link>
        </div>
      </div>
    </div>
  );
}


