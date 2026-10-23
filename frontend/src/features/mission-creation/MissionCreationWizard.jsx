import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { getTradeCategories } from "../../services/missionRequests";
import { getMasterCountries } from "../../services/franchises";
import { getRegions } from "../../services/regions";
import { getLocalServiceCatalog, filterLocalServiceChoices } from "../../services/serviceCatalog";
import { listSavedLocations, createSavedLocation } from "../../services/savedLocations";
import { estimateMission, createMission, uploadMissionAttachments } from "../../services/missions";
import { me } from "../../services/auth";
import AuthFeedbackBanner from "../../components/AuthFeedbackBanner";
import WizardProgress from "./WizardProgress";
import CategoryStep from "./steps/CategoryStep";
import LocationStep from "./steps/LocationStep";
import DescriptionStep from "./steps/DescriptionStep";
import ConfirmStep from "./steps/ConfirmStep";

const TOTAL_STEPS = 4;

export default function MissionCreationWizard({ serviceOnly = false, preferredCategorySlug = null }) {
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const submission = useRef(null);

  const [tradeCategories, setTradeCategories] = useState([]);
  const [classicTypes, setClassicTypes] = useState(undefined);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [countryId, setCountryId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);

  const [category, setCategory] = useState({ requestKind: null, tradeCategoryId: "", serviceType: "" });

  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [savedLocationId, setSavedLocationId] = useState(null);
  const [saveThisLocation, setSaveThisLocation] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");

  // Retrait — uniquement pour la filière livraison (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §1.2),
  // état distinct de address/coordinates (qui restent la dépose).
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoordinates, setPickupCoordinates] = useState(null);

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
        const [countryList, locations, session] = await Promise.all([
          getMasterCountries(),
          listSavedLocations().catch(() => []),
          me().catch(() => ({ user: null })),
        ]);
        if (cancelled) return;
        setCountries(countryList);
        const accountCountry = countryList.find((item) => String(item.id) === String(session.user?.countryId));
        const initialCountry = accountCountry || (countryList.length === 1 ? countryList[0] : null);
        setCountryId(initialCountry ? String(initialCountry.id) : "");
        setRegionId(accountCountry && session.user?.regionId ? String(session.user.regionId) : "");
        setSavedLocations(locations);
      } catch (_err) {
        if (!cancelled) {
          setFeedback({ type: "error", message: t("missionCreation.errors.loadOptions") });
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedLocations(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!countryId) {
      setLoadingOptions(false);
      return;
    }
    let cancelled = false;
    getRegions({ countryId }).then((items) => {
      if (cancelled) return;
      setRegions(items);
      setRegionId((current) => current && !items.some((item) => String(item.id) === String(current)) ? "" : current);
    }).catch(() => {
      if (!cancelled) setRegions([]);
    });
    return () => { cancelled = true; };
  }, [countryId]);

  useEffect(() => {
    if (!countryId) return;
    let cancelled = false;
    setLoadingOptions(true);
    (async () => {
      try {
        const scope = { countryId, ...(regionId ? { regionId } : {}) };
        const [categories, catalog] = await Promise.all([
          getTradeCategories(scope),
          getLocalServiceCatalog(scope),
        ]);
        if (cancelled) return;
        const localChoices = filterLocalServiceChoices(
          regionId ? categories : categories.filter((item) => !item.regionId),
          catalog
        );
        const visibleCategories = serviceOnly
          ? localChoices.tradeCategories.filter((item) => !["mobilite", "livraison"].includes(item.slug))
          : localChoices.tradeCategories;
        setTradeCategories(visibleCategories);
        setClassicTypes(localChoices.classicTypes);
        const preferredCategory = preferredCategorySlug
          ? visibleCategories.find((item) => item.slug === preferredCategorySlug)
          : null;
        setCategory(preferredCategory
          ? { requestKind: "trade_category", tradeCategoryId: String(preferredCategory.id), serviceType: "" }
          : { requestKind: null, tradeCategoryId: "", serviceType: "" });
        setFeedback(null);
      } catch (_err) {
        if (!cancelled) {
          setTradeCategories([]);
          setClassicTypes([]);
          setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
          setFeedback({ type: "error", message: t("missionCreation.errors.loadOptions") });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => { cancelled = true; };
  }, [countryId, regionId, preferredCategorySlug, serviceOnly, t]);

  const executionType = category.requestKind === "trade_category" ? "provider" : "agent";

  const selectedTradeCategorySlug = category.tradeCategoryId
    ? tradeCategories.find((tc) => String(tc.id) === String(category.tradeCategoryId))?.slug || null
    : null;

  // Livraison (colis) et Mobilité (passager) : capture d'un second lieu (départ), même mécanisme
  // partagé — docs/DEV_SPEC_TERANGA_v7_PHASE4.md §1.2 étend la Phase 3 Lot 1.
  const requiresPickup = selectedTradeCategorySlug === "livraison" || selectedTradeCategorySlug === "mobilite";
  const isMobilite = selectedTradeCategorySlug === "mobilite";

  const categoryLabel = category.tradeCategoryId
    ? tradeCategories.find((tc) => String(tc.id) === String(category.tradeCategoryId))?.name || ""
    : category.serviceType
    ? t(`services.type.${category.serviceType}`)
    : "";

  const canGoNext = () => {
    if (step === 1) return Boolean(countryId && category.requestKind && !loadingOptions);
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
          countryId: Number(countryId),
          ...(regionId ? { regionId: Number(regionId) } : {}),
          executionType,
          tradeCategoryId: category.tradeCategoryId ? Number(category.tradeCategoryId) : undefined,
          serviceType: category.serviceType || undefined,
          // Destination réelle de la mission (étape Location) : le tarif affiché doit refléter
          // où la mission a lieu, pas le pays du compte (correction transfrontalière).
          address: address.trim() || undefined,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          pickupLatitude: pickupCoordinates?.latitude,
          pickupLongitude: pickupCoordinates?.longitude,
        });
        setEstimate(data);
      } catch (error) {
        setEstimate(null);
        setFeedback({
          type: "error",
          message: error?.response?.data?.error || t("missionCreation.errors.submitFailed"),
        });
        return;
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
    setAddress("");
    setSavedLocationId(null);
    setSaveThisLocation(false);
  };

  // Distinct de handleAddressChange (qui efface les coordonnées quand l'utilisateur tape un
  // nouveau texte libre) : ici adresse ET coordonnées sont connues simultanément et cohérentes
  // (géolocalisation + géocodage inverse côté LocationStep), donc posées ensemble sans s'effacer
  // l'une l'autre.
  const handleCurrentLocationResolved = ({ latitude, longitude, address: resolvedAddress }) => {
    setCoordinates({ latitude, longitude });
    setAddress(resolvedAddress || '');
    setSavedLocationId(null);
  };

  const handlePickupAddressChange = (value) => {
    setPickupAddress(value);
    setPickupCoordinates(null);
  };

  const handlePickupPlaceSelected = ({ address: resolvedAddress, latitude, longitude }) => {
    setPickupAddress(resolvedAddress);
    setPickupCoordinates({ latitude, longitude });
  };

  const handlePickupMapPositionChange = ({ latitude, longitude }) => {
    setPickupCoordinates({ latitude, longitude });
    setPickupAddress("");
  };

  const resetWizard = () => {
    setStep(1);
    setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
    setAddress("");
    setCoordinates(null);
    setSavedLocationId(null);
    setSaveThisLocation(false);
    setNewLocationLabel("");
    setPickupAddress("");
    setPickupCoordinates(null);
    setTitle("");
    setDescription("");
    setPhoto(null);
    setVoiceNote(null);
    setEstimate(null);
    setResult(null);
    setFeedback(null);
  };

  const clearLocation = () => {
    setAddress("");
    setCoordinates(null);
    setSavedLocationId(null);
    setSaveThisLocation(false);
    setNewLocationLabel("");
    setPickupAddress("");
    setPickupCoordinates(null);
    setEstimate(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        countryId: Number(countryId),
        ...(regionId ? { regionId: Number(regionId) } : {}),
        executionType,
        title: title.trim(),
        description: description.trim() || undefined,
      };
      if (category.tradeCategoryId) payload.tradeCategoryId = Number(category.tradeCategoryId);
      else payload.serviceType = category.serviceType;

      if (savedLocationId) {
        payload.savedLocationId = savedLocationId;
      } else if (address.trim() || coordinates?.latitude != null) {
        // Le clic "position actuelle"/dépose d'épingle pose des coordonnées sans forcément
        // renseigner l'adresse — ne pas les perdre silencieusement au moment de l'envoi.
        if (address.trim()) payload.address = address.trim();
        if (coordinates?.latitude != null) payload.latitude = coordinates.latitude;
        if (coordinates?.longitude != null) payload.longitude = coordinates.longitude;
      }

      if (requiresPickup) {
        if (pickupAddress.trim()) payload.pickupAddress = pickupAddress.trim();
        if (pickupCoordinates?.latitude != null) payload.pickupLatitude = pickupCoordinates.latitude;
        if (pickupCoordinates?.longitude != null) payload.pickupLongitude = pickupCoordinates.longitude;
      }

      const fingerprint = JSON.stringify(payload);
      if (submission.current?.fingerprint !== fingerprint) {
        submission.current = { fingerprint, requestKey: window.crypto?.randomUUID?.() || `mission-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      }
      const data = await createMission({ ...payload, requestKey: submission.current.requestKey });
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
                ? selectedTradeCategorySlug === "livraison"
                  ? `/livraisons/${result.mission.id}`
                  : selectedTradeCategorySlug === "mobilite"
                  ? `/courses/${result.mission.id}`
                  : `/missions/${result.mission.id}/track`
                : `/services/${result.mission.id}`
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
          countries={countries}
          regions={regions}
          countryId={countryId}
          regionId={regionId}
          onCountryChange={(value) => {
            if (value !== countryId) clearLocation();
            setCountryId(value);
            setRegionId("");
            setRegions([]);
            setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
            setLoadingOptions(Boolean(value));
          }}
          onRegionChange={(value) => {
            if (value !== regionId) clearLocation();
            setRegionId(value);
            setCategory({ requestKind: null, tradeCategoryId: "", serviceType: "" });
            setLoadingOptions(true);
          }}
          tradeCategories={tradeCategories}
          classicTypes={classicTypes}
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
          onCurrentLocationResolved={handleCurrentLocationResolved}
          savedLocations={savedLocations}
          loadingSavedLocations={loadingSavedLocations}
          onSelectSavedLocation={handleSelectSavedLocation}
          saveThisLocation={saveThisLocation}
          onToggleSaveThisLocation={setSaveThisLocation}
          newLocationLabel={newLocationLabel}
          onLocationLabelChange={setNewLocationLabel}
          requiresPickup={requiresPickup}
          isMobilite={isMobilite}
          pickupAddress={pickupAddress}
          pickupCoordinates={pickupCoordinates}
          countryIso={countries.find((item) => String(item.id) === countryId)?.isoCode || ""}
          countryName={countries.find((item) => String(item.id) === countryId)?.name || ""}
          regionName={regions.find((item) => String(item.id) === regionId)?.name || ""}
          onPickupAddressChange={handlePickupAddressChange}
          onPickupPlaceSelected={handlePickupPlaceSelected}
          onPickupMapPositionChange={handlePickupMapPositionChange}
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
          summary={{
            countryName: countries.find((item) => String(item.id) === countryId)?.name || "",
            regionName: regions.find((item) => String(item.id) === regionId)?.name || "",
            categoryLabel,
            title,
            address,
            coordinates,
            pickupAddress: requiresPickup ? pickupAddress : "",
            pickupCoordinates: requiresPickup ? pickupCoordinates : null,
            isMobilite,
          }}
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
