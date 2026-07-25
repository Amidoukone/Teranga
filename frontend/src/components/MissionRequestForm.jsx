import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { submitMissionRequest, getTradeCategories } from "../services/missionRequests";
import { getMasterCountries } from "../services/franchises";
import { persistSession } from "../services/auth";
import AuthFeedbackBanner from "./AuthFeedbackBanner";

const CLASSIC_SERVICE_TYPES = ["errand", "administrative", "payment", "money_transfer", "other"];

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-text-primary";

export default function MissionRequestForm() {
  const { t } = useTranslation();

  const [tradeCategories, setTradeCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [requestKind, setRequestKind] = useState("trade_category");
  const [tradeCategoryId, setTradeCategoryId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [countryId, setCountryId] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [categories, countryList] = await Promise.all([
          getTradeCategories(),
          getMasterCountries(),
        ]);
        if (cancelled) return;
        setTradeCategories(categories);
        setCountries(countryList);
        if (categories[0]) setTradeCategoryId(String(categories[0].id));
        if (countryList[0]) setCountryId(String(countryList[0].id));
        setFeedback(null);
      } catch (_err) {
        if (!cancelled) {
          setFeedback({ type: "error", message: t("homePage.missionRequest.loadError") });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const resetForNewRequest = () => {
    setResult(null);
    setFeedback(null);
    setPhone("");
    setPin("");
    setFirstName("");
    setTitle("");
    setDescription("");
    setAddress("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    if (!phone.trim() || !pin.trim() || !countryId || !title.trim()) {
      setFeedback({ type: "error", message: t("homePage.missionRequest.errors.required") });
      return;
    }
    if (requestKind === "trade_category" && !tradeCategoryId) {
      setFeedback({ type: "error", message: t("homePage.missionRequest.errors.required") });
      return;
    }
    if (requestKind === "classic" && !serviceType) {
      setFeedback({ type: "error", message: t("homePage.missionRequest.errors.required") });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phone: phone.trim(),
        pin: pin.trim(),
        firstName: firstName.trim() || undefined,
        countryId: Number(countryId),
        requestKind,
        title: title.trim(),
        description: description.trim() || undefined,
        address: address.trim() || undefined,
      };
      if (requestKind === "trade_category") {
        payload.tradeCategoryId = Number(tradeCategoryId);
      } else {
        payload.serviceType = serviceType;
      }

      const data = await submitMissionRequest(payload);
      await persistSession(data);

      setResult(data);
      setFeedback({
        type: "success",
        message: data.isNewAccount
          ? t("homePage.missionRequest.successNewAccount")
          : t("homePage.missionRequest.successExisting"),
      });
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;
      const message =
        status === 401
          ? t("homePage.missionRequest.errors.wrongPin")
          : backendMessage || t("homePage.missionRequest.errors.generic");
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm sm:p-8">
        <AuthFeedbackBanner type="success" message={feedback?.message} />
        <h3 className="mt-5 text-lg font-semibold text-text-primary">
          {t("homePage.missionRequest.successTitle")}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {t("homePage.missionRequest.successReference", { id: result.service?.id })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/services" className="btn-primary rounded-full px-6 py-2.5 text-sm">
            {t("homePage.missionRequest.trackCta")}
          </Link>
          <button
            type="button"
            onClick={resetForNewRequest}
            className="btn-secondary rounded-full px-6 py-2.5 text-sm"
          >
            {t("homePage.missionRequest.newRequestCta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-xl rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm sm:p-8"
    >
      {feedback ? (
        <div className="mb-5">
          <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRequestKind("trade_category")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            requestKind === "trade_category"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-border bg-surface-main text-text-secondary"
          }`}
        >
          {t("homePage.missionRequest.kindToggle.tradeCategory")}
        </button>
        <button
          type="button"
          onClick={() => setRequestKind("classic")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            requestKind === "classic"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-border bg-surface-main text-text-secondary"
          }`}
        >
          {t("homePage.missionRequest.kindToggle.classic")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {requestKind === "trade_category" ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("homePage.missionRequest.fields.tradeCategory")}</label>
            <select
              className={inputClass}
              value={tradeCategoryId}
              onChange={(e) => setTradeCategoryId(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">{t("homePage.missionRequest.fields.tradeCategoryPlaceholder")}</option>
              {tradeCategories.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("homePage.missionRequest.fields.serviceType")}</label>
            <select
              className={inputClass}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              <option value="">{t("homePage.missionRequest.fields.serviceTypePlaceholder")}</option>
              {CLASSIC_SERVICE_TYPES.map((key) => (
                <option key={key} value={key}>
                  {t(`services.type.${key}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("homePage.missionRequest.fields.country")}</label>
          <select
            className={inputClass}
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            disabled={loadingOptions}
          >
            <option value="">{t("homePage.missionRequest.fields.countryPlaceholder")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("homePage.missionRequest.fields.phone")}</label>
          <input
            type="tel"
            className={inputClass}
            placeholder={t("homePage.missionRequest.fields.phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass}>{t("homePage.missionRequest.fields.pin")}</label>
          <input
            type="password"
            inputMode="numeric"
            className={inputClass}
            placeholder={t("homePage.missionRequest.fields.pinPlaceholder")}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            minLength={4}
            required
          />
          <p className="mt-1 text-xs text-text-muted">{t("homePage.missionRequest.fields.pinHint")}</p>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("homePage.missionRequest.fields.firstName")}</label>
          <input
            type="text"
            className={inputClass}
            placeholder={t("homePage.missionRequest.fields.firstNamePlaceholder")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("homePage.missionRequest.fields.title")}</label>
          <input
            type="text"
            className={inputClass}
            placeholder={t("homePage.missionRequest.fields.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("homePage.missionRequest.fields.description")}</label>
          <textarea
            className={`${inputClass} min-h-[88px]`}
            placeholder={t("homePage.missionRequest.fields.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("homePage.missionRequest.fields.address")}</label>
          <input
            type="text"
            className={inputClass}
            placeholder={t("homePage.missionRequest.fields.addressPlaceholder")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || loadingOptions}
        className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm disabled:opacity-60 sm:w-auto"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        {submitting ? t("homePage.missionRequest.submitting") : t("homePage.missionRequest.submit")}
      </button>
    </form>
  );
}
