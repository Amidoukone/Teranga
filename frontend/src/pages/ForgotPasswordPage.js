import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../services/auth';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [debugToken, setDebugToken] = useState('');
  const [debugUrl, setDebugUrl] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setDebugToken('');
    setDebugUrl('');
    setLoading(true);

    try {
      const data = await forgotPassword({
        email: String(email || '').trim().toLowerCase(),
      });
      setSuccessMsg(
        data?.message ||
          t('auth.forgotPassword.success', {
            defaultValue:
              'Si un compte existe, un lien de reinitialisation a ete envoye.',
          })
      );

      const maybeToken = String(data?.debug?.resetToken || '').trim();
      const maybeUrl = String(data?.debug?.resetUrl || '').trim();
      if (maybeToken) setDebugToken(maybeToken);
      if (maybeUrl) setDebugUrl(maybeUrl);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.error ||
          t('auth.forgotPassword.error', {
            defaultValue: 'Impossible d envoyer la demande pour le moment.',
          })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card shadow-sm p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {t('auth.forgotPassword.title', { defaultValue: 'Mot de passe oublie' })}
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          {t('auth.forgotPassword.subtitle', {
            defaultValue:
              'Entrez votre email pour recevoir un lien de reinitialisation.',
          })}
        </p>

        {errorMsg ? (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        ) : null}
        {successMsg ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </div>
        ) : null}

        {(debugToken || debugUrl) ? (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">
              {t('auth.forgotPassword.debugTitle', {
                defaultValue: 'Mode debug actif (sans SMTP)',
              })}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              {t('auth.forgotPassword.debugInfo', {
                defaultValue:
                  'Utilisez ce token/lien pour reinitialiser le mot de passe.',
              })}
            </p>
            {debugToken ? (
              <div className="mt-2">
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-1">Token:</p>
                <code className="block break-all rounded-lg border border-amber-500/30 bg-surface-card px-2 py-1 text-xs text-text-primary">
                  {debugToken}
                </code>
              </div>
            ) : null}
            {debugUrl ? (
              <div className="mt-2">
                <a
                  href={debugUrl}
                  className="text-blue-700 dark:text-blue-400 hover:underline text-xs font-medium"
                >
                  {t('auth.forgotPassword.debugOpenLink', {
                    defaultValue: 'Ouvrir le lien de reinitialisation',
                  })}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            {t('auth.forgotPassword.email', { defaultValue: 'Email' })}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.forgotPassword.emailPlaceholder', {
                defaultValue: 'exemple@email.com',
              })}
              className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white font-semibold rounded-xl transition flex items-center justify-center ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                {t('auth.forgotPassword.sending', { defaultValue: 'Envoi...' })}
              </>
            ) : (
              t('auth.forgotPassword.submit', { defaultValue: 'Envoyer le lien' })
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <div className="mb-2">
            <Link to="/reset-password/code" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
              {t('auth.forgotPassword.recoveryCodeLink', {
                defaultValue: 'Utiliser un code de recuperation',
              })}
            </Link>
            <p className="mt-1 text-xs text-text-muted">
              {t('auth.forgotPassword.recoveryCodeInfo', {
                defaultValue:
                  'Les codes sont affiches uniquement lors de leur generation.',
              })}
            </p>
          </div>
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            {t('auth.forgotPassword.backToLogin', { defaultValue: 'Retour a la connexion' })}
          </Link>
        </div>
      </div>
    </div>
  );
}


