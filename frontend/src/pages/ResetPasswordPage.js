import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../services/auth';
import AuthFeedbackBanner from '../components/AuthFeedbackBanner';
import { buildAuthFeedbackState } from '../utils/authFeedback';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenFromUrl = useMemo(
    () => String(searchParams.get('token') || '').trim(),
    [searchParams]
  );

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    const trimmedToken = String(token || '').trim();
    if (!trimmedToken) {
      setFeedback({
        type: 'error',
        message: t('auth.resetPassword.errors.tokenRequired', {
          defaultValue: 'Token requis.',
        }),
      });
      return;
    }
    if (!password || password.length < 8) {
      setFeedback({
        type: 'error',
        message: t('auth.resetPassword.errors.passwordMin', {
          defaultValue: 'Mot de passe trop court (minimum 8 caract\u00E8res).',
        }),
      });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: t('auth.resetPassword.errors.passwordMismatch', {
          defaultValue: 'Les mots de passe ne correspondent pas.',
        }),
      });
      return;
    }

    setLoading(true);
    try {
      const successMessage =
        t('auth.resetPassword.success', {
          defaultValue: 'Mot de passe r\u00E9initialis\u00E9 avec succ\u00E8s.',
        });
      const data = await resetPassword({
        token: trimmedToken,
        password,
      });
      const message = data?.message || successMessage;
      setFeedback({ type: 'success', message });
      setTimeout(
        () =>
          navigate('/login', {
            replace: true,
            state: buildAuthFeedbackState(message, 'success'),
          }),
        1200
      );
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err?.response?.data?.error ||
          t('auth.resetPassword.error', {
            defaultValue: 'Impossible de r\u00E9initialiser le mot de passe.',
          }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card shadow-sm p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {t('auth.resetPassword.title', {
            defaultValue: 'R\u00E9initialiser le mot de passe',
          })}
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          {t('auth.resetPassword.subtitle', {
            defaultValue:
              'Saisissez le token et votre nouveau mot de passe.',
          })}
        </p>

        <AuthFeedbackBanner
          className="mb-4"
          type={feedback?.type}
          message={feedback?.message}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.resetPassword.token', { defaultValue: 'Token' })}
            </label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('auth.resetPassword.tokenPlaceholder', {
                defaultValue: 'Collez votre token ici',
              })}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.resetPassword.newPassword', {
                defaultValue: 'Nouveau mot de passe',
              })}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.resetPassword.confirmPassword', {
                defaultValue: 'Confirmer le mot de passe',
              })}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
                {t('auth.resetPassword.saving', { defaultValue: 'Validation...' })}
              </>
            ) : (
              t('auth.resetPassword.submit', {
                defaultValue: 'Mettre \u00E0 jour le mot de passe',
              })
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            {t('auth.resetPassword.backToLogin', { defaultValue: 'Retour \u00E0 la connexion' })}
          </Link>
        </div>
      </div>
    </div>
  );
}


