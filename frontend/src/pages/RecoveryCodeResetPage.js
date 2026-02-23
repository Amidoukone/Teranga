import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, KeyRound, Mail, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { recoverWithCode } from '../services/auth';

export default function RecoveryCodeResetPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [newCodes, setNewCodes] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setNewCodes([]);

    if (!password || password.length < 8) {
      setErrorMsg(
        t('auth.recoveryCode.errors.passwordMin', {
          defaultValue: 'Mot de passe trop court (minimum 8 caracteres).',
        })
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(
        t('auth.recoveryCode.errors.passwordMismatch', {
          defaultValue: 'Les mots de passe ne correspondent pas.',
        })
      );
      return;
    }

    setLoading(true);
    try {
      const data = await recoverWithCode({
        email: String(email || '').trim().toLowerCase(),
        recoveryCode: String(recoveryCode || '').trim(),
        password,
      });

      setSuccessMsg(
        data?.message ||
          t('auth.recoveryCode.success', {
            defaultValue: 'Mot de passe reinitialise avec succes.',
          })
      );

      const codes = Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : [];
      setNewCodes(codes);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.error ||
          t('auth.recoveryCode.error', {
            defaultValue: 'Impossible de reinitialiser le mot de passe.',
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
          {t('auth.recoveryCode.title', { defaultValue: 'Reset avec code de recuperation' })}
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          {t('auth.recoveryCode.subtitle', {
            defaultValue: 'Utilisez un code de recuperation pour changer votre mot de passe.',
          })}
        </p>
        <p className="text-xs text-text-muted mb-4">
          {t('auth.recoveryCode.help', {
            defaultValue:
              'Ces codes sont remis lors de l inscription ou apres regeneration depuis un compte connecte.',
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

        {newCodes.length ? (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t('auth.recoveryCode.newCodesTitle', { defaultValue: 'Nouveaux codes de recuperation' })}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              {t('auth.recoveryCode.newCodesInfo', {
                defaultValue: 'Conservez ces codes. Ils ne seront plus affiches.',
              })}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {newCodes.map((code) => (
                <code
                  key={code}
                  className="rounded-lg bg-surface-card border border-amber-500/30 px-2 py-1 text-xs text-text-primary"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.recoveryCode.email', { defaultValue: 'Email' })}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.recoveryCode.code', { defaultValue: 'Code de recuperation' })}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder={t('auth.recoveryCode.codePlaceholder', {
                  defaultValue: 'ABCDE-12345',
                })}
                className="w-full border border-border rounded-xl pl-10 pr-3 py-2 text-sm bg-surface-card text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              {t('auth.recoveryCode.newPassword', { defaultValue: 'Nouveau mot de passe' })}
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
              {t('auth.recoveryCode.confirmPassword', { defaultValue: 'Confirmer le mot de passe' })}
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
                {t('auth.recoveryCode.submitting', { defaultValue: 'Validation...' })}
              </>
            ) : (
              t('auth.recoveryCode.submit', { defaultValue: 'Reinitialiser avec code' })
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            {t('auth.recoveryCode.backToLogin', { defaultValue: 'Retour a la connexion' })}
          </Link>
        </div>
      </div>
    </div>
  );
}


