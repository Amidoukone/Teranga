import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { changePassword, logout, me } from "../services/auth";
import { useTranslation } from "react-i18next";
import SettingsSubpageLayout from "../components/SettingsSubpageLayout";

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  helpText,
  helpTone = "neutral",
  showActionLabel,
  hideActionLabel,
}) {
  const helpToneClass =
    helpTone === "error"
      ? "text-red-600 dark:text-red-400"
      : helpTone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-text-muted";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
        <input
          id={id}
          type={show ? "text" : "password"}
          className="w-full border border-border/80 rounded-xl pl-10 pr-11 py-2.5 text-sm bg-surface-card text-text-primary shadow-sm focus:ring-4 focus:ring-primary/15 focus:border-primary outline-none"
          placeholder="********"
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
          aria-describedby={helpText ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-3 inline-flex items-center text-text-muted hover:text-text-primary"
          aria-label={show ? hideActionLabel : showActionLabel}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {helpText ? (
        <p id={`${id}-hint`} className={`text-xs ${helpToneClass}`}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
}

function RequirementItem({ state, label }) {
  const isOk = state === "ok";
  const isBad = state === "bad";

  return (
    <li
      className={[
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        isOk
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
          : isBad
            ? "border-amber-200 bg-amber-50/80 text-amber-800"
            : "border-border/70 bg-surface-card text-text-secondary",
      ].join(" ")}
    >
      {isOk ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : isBad ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      )}
      <span>{label}</span>
    </li>
  );
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hasMinLength = newPassword.length >= 8;
  const matchesConfirm = confirm.length > 0 && newPassword === confirm;
  const differsFromCurrent =
    Boolean(newPassword) && Boolean(currentPassword) && newPassword !== currentPassword;
  const canSubmit =
    Boolean(currentPassword) &&
    Boolean(newPassword) &&
    Boolean(confirm) &&
    hasMinLength &&
    matchesConfirm &&
    differsFromCurrent;

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

    if (!currentPassword || !newPassword) {
      setErrorMsg(t("changePasswordPage.errors.required"));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg(t("changePasswordPage.errors.tooShort"));
      return;
    }

    if (newPassword !== confirm) {
      setErrorMsg(t("changePasswordPage.errors.mismatch"));
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMsg(t("changePasswordPage.errors.sameAsCurrent"));
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });
      await logout().catch(() => null);
      navigate("/login", {
        replace: true,
        state: {
          successMsg: t("changePasswordPage.success.changedLogin"),
        },
      });
    } catch (err) {
      const msg =
        err?.response?.data?.error || t("changePasswordPage.errors.update");
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  const newPasswordHelpText =
    newPassword.length === 0
      ? t("changePasswordPage.hints.minLength")
      : hasMinLength
        ? t("changePasswordPage.hints.minLength")
        : t("changePasswordPage.errors.tooShort");

  const confirmHelpText =
    confirm.length === 0
      ? t("changePasswordPage.hints.matches")
      : matchesConfirm
        ? t("changePasswordPage.hints.matches")
        : t("changePasswordPage.errors.mismatch");

  return (
    <SettingsSubpageLayout
      kicker={t("changePasswordPage.kicker")}
      title={t("changePasswordPage.title")}
      subtitle={t("changePasswordPage.subtitle")}
      headerActions={
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface-card px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-main/70 hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("changePasswordPage.links.backToDashboard")}</span>
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-2xl border border-border/80 bg-surface-main/60 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-text-primary">
            <Lock className="h-4 w-4" />
            <h2 className="text-base font-semibold">{t("nav.security")}</h2>
          </div>

          {errorMsg && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="current-password"
              label={t("changePasswordPage.labels.currentPassword")}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              show={showCurrentPassword}
              onToggleShow={() => setShowCurrentPassword((prev) => !prev)}
              autoComplete="current-password"
              showActionLabel={t("changePasswordPage.actions.showPassword")}
              hideActionLabel={t("changePasswordPage.actions.hidePassword")}
            />

            <PasswordField
              id="new-password"
              label={t("changePasswordPage.labels.newPassword")}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              show={showNewPassword}
              onToggleShow={() => setShowNewPassword((prev) => !prev)}
              autoComplete="new-password"
              helpText={newPasswordHelpText}
              helpTone={newPassword.length === 0 ? "neutral" : hasMinLength ? "success" : "error"}
              showActionLabel={t("changePasswordPage.actions.showPassword")}
              hideActionLabel={t("changePasswordPage.actions.hidePassword")}
            />

            <PasswordField
              id="confirm-password"
              label={t("changePasswordPage.labels.confirmPassword")}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
              autoComplete="new-password"
              helpText={confirmHelpText}
              helpTone={confirm.length === 0 ? "neutral" : matchesConfirm ? "success" : "error"}
              showActionLabel={t("changePasswordPage.actions.showPassword")}
              hideActionLabel={t("changePasswordPage.actions.hidePassword")}
            />

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className={[
                "w-full justify-center rounded-xl px-4 py-2.5 text-white shadow-sm transition",
                loading || !canSubmit
                  ? "cursor-not-allowed bg-blue-400"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
              ].join(" ")}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("changePasswordPage.buttons.updating")}
                </>
              ) : (
                t("changePasswordPage.buttons.update")
              )}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border/80 bg-surface-card p-5">
            <div className="mb-3 flex items-center gap-2 text-text-primary">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-base font-semibold">{t("changePasswordPage.hints.title")}</h2>
            </div>

            <ul className="space-y-2">
              <RequirementItem
                state={newPassword.length === 0 ? "idle" : hasMinLength ? "ok" : "bad"}
                label={t("changePasswordPage.hints.minLength")}
              />
              <RequirementItem
                state={confirm.length === 0 ? "idle" : matchesConfirm ? "ok" : "bad"}
                label={t("changePasswordPage.hints.matches")}
              />
              <RequirementItem
                state={
                  !currentPassword || !newPassword
                    ? "idle"
                    : differsFromCurrent
                      ? "ok"
                      : "bad"
                }
                label={t("changePasswordPage.hints.differs")}
              />
            </ul>
          </section>

          <section className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>{t("changePasswordPage.kicker")}</span>
            </div>
            <p className="text-sm text-amber-800">{t("changePasswordPage.hints.logoutNotice")}</p>
          </section>
        </aside>
      </div>
    </SettingsSubpageLayout>
  );
}


