import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { submitMissionRequest, getTradeCategories } from "../services/missionRequests";
import { getMasterCountries } from "../services/franchises";
import { persistSession } from "../services/auth";
import AuthFeedbackBanner from "./AuthFeedbackBanner";
import LocationAutocompleteInput from "../features/mission-creation/LocationAutocompleteInput";
import CategoryPicker from "../features/mission-creation/CategoryPicker";
import { Button, FormField } from "./ui";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";

export default function MissionRequestForm() {
  const { t } = useTranslation();

  const [tradeCategories, setTradeCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [requestKind, setRequestKind] = useState(null);
  const [tradeCategoryId, setTradeCategoryId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [countryId, setCountryId] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState(null);

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
    setRequestKind(null);
    setTradeCategoryId("");
    setServiceType("");
    setPhone("");
    setPin("");
    setFirstName("");
    setTitle("");
    setDescription("");
    setAddress("");
    setCoordinates(null);
  };

  const handleCategoryChange = (selection) => {
    setRequestKind(selection.requestKind);
    setTradeCategoryId(selection.tradeCategoryId || "");
    setServiceType(selection.serviceType || "");
  };

  // Révélation progressive : un choix à la fois plutôt qu'un mur de champs
  // (design thinking — réduire la charge cognitive, cf. section 12.2 du BM
  // "création de mission en moins de 60 secondes").
  const showDetails = Boolean(requestKind);
  const showIdentity = showDetails && title.trim().length >= 3;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    if (!requestKind || !phone.trim() || !pin.trim() || !countryId || !title.trim()) {
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
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
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

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 block px-0 text-sm font-medium text-text-primary">
          {t("homePage.missionRequest.chooseNeed")}
        </legend>
        <CategoryPicker
          tradeCategories={tradeCategories}
          loading={loadingOptions}
          value={{ requestKind, tradeCategoryId, serviceType }}
          onChange={handleCategoryChange}
        />
      </fieldset>

      {showDetails ? (
        <div className="mt-5 space-y-4 border-t border-border/60 pt-5">
          <FormField label={t("homePage.missionRequest.fields.title")} required>
            <input
              type="text"
              className={inputClass}
              placeholder={t("homePage.missionRequest.fields.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </FormField>

          <FormField
            label={t("homePage.missionRequest.fields.address")}
            hint={t("homePage.missionRequest.fields.addressHint")}
          >
            <LocationAutocompleteInput
              className={inputClass}
              placeholder={t("homePage.missionRequest.fields.addressPlaceholder")}
              value={address}
              onChange={(value) => {
                setAddress(value);
                setCoordinates(null);
              }}
              onPlaceSelected={({ address: resolvedAddress, latitude, longitude }) => {
                setAddress(resolvedAddress);
                setCoordinates({ latitude, longitude });
              }}
            />
          </FormField>

          <FormField label={t("homePage.missionRequest.fields.description")}>
            <textarea
              className={`${inputClass} min-h-[88px]`}
              placeholder={t("homePage.missionRequest.fields.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>
      ) : null}

      {showIdentity ? (
        <div className="mt-5 space-y-4 border-t border-border/60 pt-5">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {t("homePage.missionRequest.identity.title")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("homePage.missionRequest.identity.hint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("homePage.missionRequest.fields.phone")} required>
              <input
                type="tel"
                className={inputClass}
                placeholder={t("homePage.missionRequest.fields.phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </FormField>

            <FormField
              label={t("homePage.missionRequest.fields.pin")}
              hint={t("homePage.missionRequest.fields.pinHint")}
              required
            >
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
            </FormField>
          </div>

          <FormField label={t("homePage.missionRequest.fields.firstName")}>
            <input
              type="text"
              className={inputClass}
              placeholder={t("homePage.missionRequest.fields.firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>

          <FormField
            label={t("homePage.missionRequest.fields.country")}
            hint={t("homePage.missionRequest.identity.countryHint")}
          >
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
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={loadingOptions}
            className="w-full rounded-full sm:w-auto"
          >
            {submitting
              ? t("homePage.missionRequest.submitting")
              : t("homePage.missionRequest.submit")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
