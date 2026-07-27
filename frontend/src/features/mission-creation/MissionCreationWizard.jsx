import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { getTradeCategories } from "../../services/missionRequests";
import { listSavedLocations, createSavedLocation } from "../../services/savedLocations";
import { estimateMission, createMission, uploadMissionAttachments } from "../../services/missions";
import AuthFeedbackBanner from "../../components/AuthFeedbackBanner";
import WizardProgress from "./WizardProgress";
import CategoryStep from "./steps/CategoryStep";
import LocationStep from "./steps/LocationStep";
import DescriptionStep from "./steps/DescriptionStep";
import ConfirmStep from "./steps/ConfirmStep";

const TOTAL_STEPS = 4;

export default function MissionCreationWizard() {
  const { t } = useTranslation();

  const [step, setStep] = useState(1);

  const [tradeCategories, setTradeCategories] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);

  const [category, setCategory] = useState({ requestKind: null, tradeCategoryId: "", serviceType: "" });

  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [savedLocationId, setSavedLocationId] = useState(null);
  const [saveThisLocation, setSaveThisLocation] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [voiceNote, setVoiceNote] = useState(null);

  const [estimate, setEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [categories, locations] = await Promise.all([
          getTradeCategories(),
          listSavedLocations(),
        ]);
        if (cancelled) return;
        setTradeCategories(categories);
        setSavedLocations(locations);
      } catch (_err) {
        if (!cancelled) {
          setFeedback({ type: "error", message: t("missionCreation.errors.loadOptions") });
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
          setLoadingSavedLocations(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const executionType = category.requestKind === "trade_category" ? "provider" : "agent";

  const categoryLabel = category.tradeCategoryId
    ? tradeCategories.find((tc) => String(tc.id) === String(category.tradeCategoryId))?.name || ""
    : category.serviceType
    ? t(`services.type.${category.serviceType}`)
    : "";

  const canGoNext = () => {
    if (step === 1) return Boolean(category.requestKind);
    if (step === 3) return title.trim().length >= 3;
    return true;
  };

  const goNext = async () => {
    if (!canGoNext()) {
      setFeedback({ type: "error", message: t("missionCreation.errors.stepIncomplete") });
      return;
    }
    setFeedback(null);

    if (step === 3) {
      setLoadingEstimate(true);
      try {
        const data = await estimateMission({
          executionType,
          tradeCategoryId: category.tradeCategoryId ? Number(category.tradeCategoryId) : undefined,
          serviceType: category.serviceType || undefined,
          // Destination réelle de la mission (étape Location) : le tarif affiché doit refléter
          // où la mission a lieu, pas le pays du compte (correction transfrontalière).
          address: address.trim() || undefined,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        });
        setEstimate(data);
      } catch (_err) {
        setEstimate(null);
      } finally {
        setLoadingEstimate(false);
      }
    }

    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    setFeedback(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSelectSavedLocation = (location) => {
    setSavedLocationId(location.id);
    setAddress(location.address);
    setCoordinates({ latitude: Number(location.latitude), longitude: Number(location.longitude) });
    setSaveThisLocation(false);
  };

  const handleAddressChange = (value) => {
    setAddress(value);
    setCoordinates(null);
    setSavedLocationId(null);
  };

  const handlePlaceSelected = ({ address: resolvedAddress, latitude, longitude }) => {
    setAddress(resolvedAddress);
    setCoordinates({ latitude, longitude });
    setSavedLocationId(null);
  };

  const handleMapPositionChange = ({ latitude, longitude }) => {
    setCoordinates({ latitude, longitude });
    setSavedLocationId(null);
  };

  const resetWizard = () => {
    setStep(1);
    setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
    setAddress("");
    setCoordinates(null);
    setSavedLocationId(null);
    setSaveThisLocation(false);
    setNewLocationLabel("");
    setTitle("");
    setDescription("");
    setPhoto(null);
    setVoiceNote(null);
    setEstimate(null);
    setResult(null);
    setFeedback(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        executionType,
        title: title.trim(),
        description: description.trim() || undefined,
      };
      if (category.tradeCategoryId) payload.tradeCategoryId = Number(category.tradeCategoryId);
      else payload.serviceType = category.serviceType;

      if (savedLocationId) {
        payload.savedLocationId = savedLocationId;
      } else if (address.trim()) {
        payload.address = address.trim();
        if (coordinates?.latitude != null) payload.latitude = coordinates.latitude;
        if (coordinates?.longitude != null) payload.longitude = coordinates.longitude;
      }

      const data = await createMission(payload);
      const missionId = data?.mission?.id;

      if (saveThisLocation && !savedLocationId && address.trim() && coordinates?.latitude != null) {
        try {
          await createSavedLocation({
            label: newLocationLabel.trim() || undefined,
            address: address.trim(),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          });
        } catch (_err) {
          // Non bloquant : la mission est déjà créée, seul l'enregistrement du lieu favori échoue.
        }
      }

      if (missionId && (photo || voiceNote)) {
        try {
          await uploadMissionAttachments(missionId, { photo, voiceNote });
        } catch (_err) {
          // Non bloquant : la mission est déjà créée, seules les pièces jointes échouent.
        }
      }

      setResult(data);
    } catch (error) {
      const backendMessage = error?.response?.data?.error;
      setFeedback({
        type: "error",
        message: backendMessage || t("missionCreation.errors.submitFailed"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm sm:p-8">
        <AuthFeedbackBanner type="success" message={t("missionCreation.success.message")} />
        <h3 className="mt-5 text-lg font-semibold text-text-primary">
          {t("missionCreation.success.title")}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {t("missionCreation.success.reference", { id: result.mission?.id })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={
              result.mission?.missionStatus
                ? `/missions/${result.mission.id}/track`
                : "/services"
            }
            className="btn-primary rounded-full px-6 py-2.5 text-sm"
          >
            {t("missionCreation.success.trackCta")}
          </Link>
          <button
            type="button"
            onClick={resetWizard}
            className="btn-secondary rounded-full px-6 py-2.5 text-sm"
          >
            {t("missionCreation.success.newRequestCta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-[28px] border border-border/70 bg-surface-card p-6 shadow-sm sm:p-8">
      <WizardProgress currentStep={step} />

      {feedback ? (
        <div className="mb-5">
          <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
        </div>
      ) : null}

      {step === 1 ? (
        <CategoryStep
          tradeCategories={tradeCategories}
          loading={loadingOptions}
          value={category}
          onChange={setCategory}
        />
      ) : null}

      {step === 2 ? (
        <LocationStep
          address={address}
          coordinates={coordinates}
          onAddressChange={handleAddressChange}
          onPlaceSelected={handlePlaceSelected}
          onMapPositionChange={handleMapPositionChange}
          savedLocations={savedLocations}
          loadingSavedLocations={loadingSavedLocations}
          onSelectSavedLocation={handleSelectSavedLocation}
          saveThisLocation={saveThisLocation}
          onToggleSaveThisLocation={setSaveThisLocation}
          newLocationLabel={newLocationLabel}
          onLocationLabelChange={setNewLocationLabel}
        />
      ) : null}

      {step === 3 ? (
        <DescriptionStep
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          photo={photo}
          onPhotoChange={setPhoto}
          voiceNote={voiceNote}
          onVoiceNoteChange={setVoiceNote}
        />
      ) : null}

      {step === 4 ? (
        <ConfirmStep
          estimate={estimate}
          loadingEstimate={loadingEstimate}
          summary={{ categoryLabel, title, address }}
        />
      ) : null}

      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="btn-secondary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm disabled:opacity-60"
          >
            <ArrowLeft size={16} />
            {t("missionCreation.wizard.back")}
          </button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm"
          >
            {t("missionCreation.wizard.next")}
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingEstimate}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? t("missionCreation.wizard.submitting") : t("missionCreation.wizard.confirm")}
          </button>
        )}
      </div>
    </div>
  );
}
