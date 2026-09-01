import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bike,
  CarFront,
  CheckCircle2,
  FileCheck2,
  Image as ImageIcon,
  Loader2,
  Power,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import { AdminField, AdminPageHeader } from "../components/admin/AdminFormUi";
import { getFileUrl } from "../services/api";
import { notify } from "../utils/notify";
import { optimizeImageForUpload } from "../utils/imageUpload";
import {
  createProviderVehicle,
  getProvider,
  listProviderVehicles,
  updateProviderDriverCompliance,
  updateProviderMobilityAvailability,
  updateProviderVehicle,
  uploadProviderMobilityMedia,
} from "../services/providers";

const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const DOCUMENT_ACCEPT = `${PHOTO_ACCEPT},application/pdf,.pdf`;
const OPTIONAL_VEHICLE_TEXT_FIELDS = [
  "brand",
  "model",
  "color",
  "plateNumber",
  "photoUrl",
  "registrationNumber",
  "registrationDocumentUrl",
  "insurancePolicyNumber",
  "insuranceDocumentUrl",
  "inspectionCertificateNumber",
  "inspectionDocumentUrl",
];
const OPTIONAL_VEHICLE_DATE_FIELDS = [
  "insuranceExpiresAt",
  "inspectionExpiresAt",
];

const EMPTY_VEHICLE = {
  vehicleType: "motorcycle",
  brand: "",
  model: "",
  color: "",
  plateNumber: "",
  capacity: "1",
  hasPassengerHelmet: false,
  hasAirConditioning: false,
  photoUrl: "",
  registrationNumber: "",
  registrationDocumentUrl: "",
  registrationVerified: false,
  insurancePolicyNumber: "",
  insuranceDocumentUrl: "",
  insuranceExpiresAt: "",
  insuranceVerified: false,
  inspectionCertificateNumber: "",
  inspectionDocumentUrl: "",
  inspectionExpiresAt: "",
  inspectionVerified: false,
  status: "pending",
};

function driverFormFrom(provider = {}) {
  return {
    profilePhotoUrl: provider.profilePhotoUrl || "",
    driverLicenseNumber: provider.driverLicenseNumber || "",
    driverLicenseDocumentUrl: provider.driverLicenseDocumentUrl || "",
    driverLicenseExpiresAt: provider.driverLicenseExpiresAt || "",
    driverLicenseVerified: Boolean(provider.driverLicenseVerified),
    identityDocumentUrl: provider.identityDocumentUrl || "",
    identityDocumentVerified: Boolean(provider.identityDocumentVerified),
  };
}

function vehicleFormFrom(vehicle) {
  if (!vehicle) return { ...EMPTY_VEHICLE };
  return Object.fromEntries(
    Object.keys(EMPTY_VEHICLE).map((key) => [
      key,
      typeof EMPTY_VEHICLE[key] === "boolean"
        ? Boolean(vehicle[key])
        : vehicle[key] == null
        ? ""
        : String(vehicle[key]),
    ])
  );
}

function vehiclePayloadFrom(form) {
  const payload = { ...form };
  for (const field of [
    ...OPTIONAL_VEHICLE_TEXT_FIELDS,
    ...OPTIONAL_VEHICLE_DATE_FIELDS,
  ]) {
    const value = String(form[field] || "").trim();
    payload[field] = value || null;
  }
  if (payload.plateNumber) payload.plateNumber = payload.plateNumber.toUpperCase();

  const capacity = Number.parseInt(String(form.capacity || ""), 10);
  if (Number.isInteger(capacity)) payload.capacity = capacity;
  else delete payload.capacity;
  return payload;
}

function vehicleReadinessFrom(vehicle, complianceState) {
  if (complianceState?.eligible) {
    return {
      badgeClass: "app-badge app-badge-success",
      labelKey: "adminProviderMobility.vehicle.states.assignable",
    };
  }
  if (vehicle.status === "pending") {
    return {
      badgeClass: "app-badge app-badge-info",
      labelKey: "adminProviderMobility.vehicle.states.registered",
    };
  }
  if (["suspended", "retired"].includes(vehicle.status)) {
    return {
      badgeClass: "app-badge app-badge-neutral",
      labelKey: `adminProviderMobility.vehicle.statuses.${vehicle.status}`,
    };
  }
  return {
    badgeClass: "app-badge app-badge-warning",
    labelKey: "adminProviderMobility.vehicle.states.needsReview",
  };
}

export default function AdminProviderMobilityPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [provider, setProvider] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [driverForm, setDriverForm] = useState(driverFormFrom());
  const [vehicleForm, setVehicleForm] = useState(vehicleFormFrom());
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingDriver, setSavingDriver] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [uploadingMediaCount, setUploadingMediaCount] = useState(0);
  const [activeStep, setActiveStep] = useState("driver");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, fleet] = await Promise.all([getProvider(id), listProviderVehicles(id)]);
      setProvider(detail?.provider || null);
      setCompliance(detail?.compliance || null);
      setVehicles(fleet);
      setDriverForm(driverFormFrom(detail?.provider));
      setSelectedVehicleId((current) => {
        const selectable = fleet.filter((vehicle) =>
          ["pending", "active"].includes(vehicle.status)
        );
        const currentStillExists = selectable.some(
          (vehicle) => String(vehicle.id) === String(current)
        );
        if (currentStillExists) return current;
        return String(
          selectable.find((vehicle) => vehicle.status === "active")?.id ||
            selectable[0]?.id ||
            ""
        );
      });
    } catch (error) {
      notify(error?.response?.data?.error || t("adminProviderMobility.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const changeDriver = (key, value) => setDriverForm((current) => ({ ...current, [key]: value }));
  const changeVehicle = (key, value) =>
    setVehicleForm((current) => ({ ...current, [key]: value }));
  const changeUploadingMedia = (uploading) =>
    setUploadingMediaCount((current) => Math.max(0, current + (uploading ? 1 : -1)));

  const saveDriver = async (event) => {
    event.preventDefault();
    setSavingDriver(true);
    try {
      const result = await updateProviderDriverCompliance(id, driverForm);
      setProvider(result.provider);
      setCompliance(result.compliance);
      notify.success(t("adminProviderMobility.success.driver"));
      setActiveStep("vehicle");
    } catch (error) {
      notify(error?.response?.data?.error || t("adminProviderMobility.errors.driver"));
    } finally {
      setSavingDriver(false);
    }
  };

  const saveVehicle = async (event) => {
    event.preventDefault();
    setSavingVehicle(true);
    try {
      const payload = vehiclePayloadFrom(vehicleForm);
      if (editingVehicleId) await updateProviderVehicle(id, editingVehicleId, payload);
      else await createProviderVehicle(id, payload);
      notify.success(
        t(
          editingVehicleId
            ? "adminProviderMobility.success.vehicleUpdated"
            : "adminProviderMobility.success.vehicleCreated"
        )
      );
      setEditingVehicleId(null);
      setVehicleForm(vehicleFormFrom());
      await load();
    } catch (error) {
      notify(error?.response?.data?.error || t("adminProviderMobility.errors.vehicle"));
    } finally {
      setSavingVehicle(false);
    }
  };

  const startEdit = (vehicle) => {
    setActiveStep("vehicle");
    setEditingVehicleId(vehicle.id);
    setVehicleForm(vehicleFormFrom(vehicle));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const changeAvailability = async (availabilityStatus) => {
    setSavingAvailability(true);
    try {
      await updateProviderMobilityAvailability(
        id,
        availabilityStatus,
        availabilityStatus === "available" ? selectedVehicleId : null
      );
      notify.success(
        t(
          availabilityStatus === "available"
            ? "adminProviderMobility.success.available"
            : "adminProviderMobility.success.offline"
        )
      );
      await load();
    } catch (error) {
      notify(
        error?.response?.data?.error ||
          t("adminProviderMobility.errors.availability")
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-surface-main p-10 text-center text-text-muted">{t("common.loading")}</div>;
  }

  const onboardingChecks = [
    Boolean(compliance?.driverEligible),
    vehicles.length > 0,
  ];
  const completedChecks = onboardingChecks.filter(Boolean).length;
  const progressPercent = Math.round((completedChecks / onboardingChecks.length) * 100);
  const fleetReadinessKey = compliance?.hasEligibleVehicle
    ? "assignable"
    : vehicles.length > 0
    ? "awaitingActivation"
    : "none";
  const selectableVehicles = vehicles.filter((vehicle) =>
    ["pending", "active"].includes(vehicle.status)
  );
  const selectedCompliance = compliance?.vehicles?.find(
    (vehicle) => String(vehicle.id) === String(selectedVehicleId)
  );
  const canAuthorizeRides = Boolean(
    provider?.status === "active" &&
      compliance?.driverEligible &&
      selectedCompliance?.canBeActivated
  );

  return (
    <main className="min-h-screen bg-surface-main px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-7">
        <Link to="/admin/providers" className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300">
          <ArrowLeft size={15} /> {t("adminProviderMobility.back")}
        </Link>
        <AdminPageHeader
          title={t("adminProviderMobility.title", { name: provider?.displayFirstName || "" })}
          subtitle={t("adminProviderMobility.subtitle")}
        />

        <section className="rounded-2xl border border-blue-500/25 bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Power size={19} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {t("adminProviderMobility.operations.title")}
                </h2>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {t(`adminProviderMobility.operations.${provider?.availabilityStatus || "offline"}`)}
              </p>
            </div>

            {provider?.availabilityStatus === "busy" ? null : provider?.availabilityStatus ===
              "available" ? (
              <button
                type="button"
                disabled={savingAvailability}
                onClick={() => changeAvailability("offline")}
                className="app-btn-secondary min-h-11 rounded-full px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {t(
                  savingAvailability
                    ? "adminProviderMobility.operations.saving"
                    : "adminProviderMobility.operations.disable"
                )}
              </button>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <label className="min-w-56 text-xs font-medium text-text-secondary">
                  {t("adminProviderMobility.operations.vehicle")}
                  <select
                    className="app-input mt-1"
                    value={selectedVehicleId}
                    onChange={(event) => setSelectedVehicleId(event.target.value)}
                  >
                    <option value="">{t("adminProviderMobility.operations.selectVehicle")}</option>
                    {selectableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {t(`adminProviderMobility.vehicle.${vehicle.vehicleType}`)}
                        {vehicle.plateNumber ? ` · ${vehicle.plateNumber}` : ` #${vehicle.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!canAuthorizeRides || savingAvailability}
                  onClick={() => changeAvailability("available")}
                  className="app-btn-primary min-h-11 self-end rounded-full px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(
                    savingAvailability
                      ? "adminProviderMobility.operations.saving"
                      : "adminProviderMobility.operations.enable"
                  )}
                </button>
              </div>
            )}
          </div>

          {provider?.availabilityStatus === "offline" && !canAuthorizeRides ? (
            <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {provider?.status !== "active"
                ? t("adminProviderMobility.operations.accountRequired")
                : !compliance?.driverEligible
                ? t("adminProviderMobility.operations.driverRequired")
                : !selectableVehicles.length
                ? t("adminProviderMobility.operations.vehicleRequired")
                : selectedCompliance?.activationIssues?.join(", ") ||
                  t("adminProviderMobility.operations.selectVehicle")}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-surface-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {t("adminProviderMobility.guide.title")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("adminProviderMobility.guide.progress", {
                  completed: completedChecks,
                  total: onboardingChecks.length,
                })}
              </p>
            </div>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-main">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label={t("adminProviderMobility.guide.progress", { completed: completedChecks, total: onboardingChecks.length })}
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { value: "driver", complete: onboardingChecks[0] },
              { value: "vehicle", complete: onboardingChecks[1] },
            ].map(({ value, complete }, index) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveStep(value)}
                aria-pressed={activeStep === value}
                className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                  activeStep === value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-border bg-surface-main text-text-secondary hover:border-blue-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  {complete ? <CheckCircle2 size={17} /> : <span>{index + 1}.</span>}
                  {t(`adminProviderMobility.guide.${value}`)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-card p-4">
            <p className="text-xs text-text-muted">{t("adminProviderMobility.summary.driver")}</p>
            <p className={`mt-1 font-semibold ${compliance?.driverEligible ? "text-emerald-700" : "text-amber-700"}`}>
              {t(compliance?.driverEligible ? "adminProviderMobility.summary.compliant" : "adminProviderMobility.summary.incomplete")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-card p-4">
            <p className="text-xs text-text-muted">{t("adminProviderMobility.summary.fleet")}</p>
            <p className="mt-1 font-semibold text-text-primary">{vehicles.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-card p-4">
            <p className="text-xs text-text-muted">{t("adminProviderMobility.summary.eligibleVehicle")}</p>
            <p className={`mt-1 font-semibold ${compliance?.hasEligibleVehicle ? "text-emerald-700" : "text-amber-700"}`}>
              {t(`adminProviderMobility.summary.${fleetReadinessKey}`)}
            </p>
          </div>
        </section>

        {activeStep === "driver" && compliance?.driverIssues?.length ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{t("adminProviderMobility.missingDriver")}</p>
            <p className="mt-1">{compliance.driverIssues.join(", ")}</p>
          </div>
        ) : null}

        {activeStep === "driver" ? (
        <form onSubmit={saveDriver} className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-text-primary">{t("adminProviderMobility.driver.title")}</h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">{t("adminProviderMobility.privateDocuments")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MobilityMediaPicker
              label={t("adminProviderMobility.driver.profilePhotoUrl")}
              value={driverForm.profilePhotoUrl}
              providerId={id}
              kind="profilePhoto"
              photosOnly
              onUploaded={(url) => changeDriver("profilePhotoUrl", url)}
              onUploadStateChange={changeUploadingMedia}
              t={t}
            />
            <AdminField label={t("adminProviderMobility.driver.licenseNumber")}>
              <input className="app-input" value={driverForm.driverLicenseNumber} onChange={(e) => changeDriver("driverLicenseNumber", e.target.value)} />
            </AdminField>
            <MobilityMediaPicker
              label={t("adminProviderMobility.driver.licenseDocumentUrl")}
              value={driverForm.driverLicenseDocumentUrl}
              providerId={id}
              kind="driverLicense"
              onUploaded={(url) => changeDriver("driverLicenseDocumentUrl", url)}
              onUploadStateChange={changeUploadingMedia}
              t={t}
            />
            <AdminField label={t("adminProviderMobility.driver.licenseExpiry")}>
              <input className="app-input" type="date" value={driverForm.driverLicenseExpiresAt} onChange={(e) => changeDriver("driverLicenseExpiresAt", e.target.value)} />
            </AdminField>
            <MobilityMediaPicker
              label={t("adminProviderMobility.driver.identityDocumentUrl")}
              value={driverForm.identityDocumentUrl}
              providerId={id}
              kind="identityDocument"
              onUploaded={(url) => changeDriver("identityDocumentUrl", url)}
              onUploadStateChange={changeUploadingMedia}
              t={t}
            />
            <div className="flex flex-wrap items-end gap-5 pb-2">
              <CheckField label={t("adminProviderMobility.driver.licenseVerified")} checked={driverForm.driverLicenseVerified} onChange={(value) => changeDriver("driverLicenseVerified", value)} />
              <CheckField label={t("adminProviderMobility.driver.identityVerified")} checked={driverForm.identityDocumentVerified} onChange={(value) => changeDriver("identityDocumentVerified", value)} />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button className="app-btn-primary rounded-full px-5 py-2.5 text-sm" disabled={savingDriver || uploadingMediaCount > 0}>
              {t(savingDriver ? "adminProviderMobility.saving" : "adminProviderMobility.driver.save")}
            </button>
          </div>
        </form>
        ) : null}

        {activeStep === "vehicle" ? (
        <>
        <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">{t("adminProviderMobility.fleet.title")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {vehicles.map((vehicle) => {
              const state = compliance?.vehicles?.find((item) => item.id === vehicle.id);
              const Icon = vehicle.vehicleType === "motorcycle" ? Bike : CarFront;
              const identity = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
              const details = [vehicle.color, vehicle.plateNumber].filter(Boolean).join(" · ");
              const readiness = vehicleReadinessFrom(vehicle, state);
              return (
                <article key={vehicle.id} className="rounded-xl border border-border bg-surface-main/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <Icon size={20} className="mt-0.5 text-blue-600" />
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-text-primary">
                          {identity || t(`adminProviderMobility.vehicle.${vehicle.vehicleType}`)}
                        </p>
                        <p className="break-words text-xs text-text-secondary">
                          {details || t("adminProviderMobility.vehicle.optionalDetailsMissing")}
                        </p>
                      </div>
                    </div>
                    <span className={readiness.badgeClass}>
                      {t(readiness.labelKey)}
                    </span>
                  </div>
                  {vehicle.status === "pending" && state?.activationIssues?.length ? (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      {state.activationIssues.join(", ")}
                    </p>
                  ) : vehicle.status === "pending" ? (
                    <p className="mt-3 text-xs text-text-muted">
                      {t("adminProviderMobility.vehicle.registeredHint")}
                    </p>
                  ) : state?.issues?.length ? (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      {state.issues.join(", ")}
                    </p>
                  ) : null}
                  <button type="button" onClick={() => startEdit(vehicle)} className="mt-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {t("adminProviderMobility.fleet.edit")}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <VehicleForm
          t={t}
          form={vehicleForm}
          change={changeVehicle}
          onSubmit={saveVehicle}
          saving={savingVehicle}
          editing={Boolean(editingVehicleId)}
          onCancel={() => {
            setEditingVehicleId(null);
            setVehicleForm(vehicleFormFrom());
          }}
          providerId={id}
          onUploadStateChange={changeUploadingMedia}
          mediaUploading={uploadingMediaCount > 0}
        />
        </>
        ) : null}
      </div>
    </main>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded" />
      {label}
    </label>
  );
}

function VehicleForm({
  t,
  form,
  change,
  onSubmit,
  saving,
  editing,
  onCancel,
  providerId,
  onUploadStateChange,
  mediaUploading,
}) {
  const isMotorcycle = form.vehicleType === "motorcycle";
  const optionalLabel = (key) =>
    t("adminProviderMobility.vehicle.optionalField", {
      label: t(`adminProviderMobility.vehicle.${key}`),
    });
  const selectVehicleType = (vehicleType) => {
    change("vehicleType", vehicleType);
    change("capacity", vehicleType === "motorcycle" ? "1" : "4");
    change("hasPassengerHelmet", false);
    change("hasAirConditioning", false);
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">
        {t(
          editing
            ? isMotorcycle
              ? "adminProviderMobility.vehicle.editMotorcycleTitle"
              : "adminProviderMobility.vehicle.editCarTitle"
            : isMotorcycle
            ? "adminProviderMobility.vehicle.createMotorcycleTitle"
            : "adminProviderMobility.vehicle.createCarTitle"
        )}
      </h2>
      <p className="mt-1 text-xs text-text-muted">
        {t("adminProviderMobility.vehicle.draftHint")}
      </p>

      <div
        className="mt-5 grid grid-cols-2 gap-3"
        role="group"
        aria-label={t("adminProviderMobility.vehicle.type")}
      >
        {[
          { value: "motorcycle", icon: Bike },
          { value: "car", icon: CarFront },
        ].map(({ value, icon: Icon }) => {
          const selected = form.vehicleType === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => selectVehicleType(value)}
              className={`min-h-24 rounded-2xl border p-4 text-left transition ${
                selected
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-border bg-surface-main text-text-primary hover:border-blue-400"
              }`}
            >
              <Icon size={24} />
              <span className="mt-2 block text-sm font-semibold">
                {t(`adminProviderMobility.vehicle.${value}`)}
              </span>
              <span className={`mt-1 block text-xs ${selected ? "text-blue-100" : "text-text-muted"}`}>
                {t(`adminProviderMobility.vehicle.${value}Hint`)}
              </span>
            </button>
          );
        })}
      </div>

      <section className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          {isMotorcycle ? <Bike size={20} className="text-blue-600" /> : <CarFront size={20} className="text-blue-600" />}
          <h3 className="text-sm font-semibold text-text-primary">
            {t(
              isMotorcycle
                ? "adminProviderMobility.vehicle.motorcycleDetails"
                : "adminProviderMobility.vehicle.carDetails"
            )}
          </h3>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[["brand", "brand"], ["model", "model"], ["color", "color"], ["plateNumber", "plate"]].map(([field, key]) => (
          <AdminField key={field} className="min-w-0" label={optionalLabel(key)}>
            <input className="app-input" type="text" value={form[field]} onChange={(e) => change(field, e.target.value)} />
          </AdminField>
        ))}
        <MobilityMediaPicker
          label={optionalLabel("photoUrl")}
          value={form.photoUrl}
          providerId={providerId}
          kind="vehiclePhoto"
          photosOnly
          onUploaded={(url) => change("photoUrl", url)}
          onUploadStateChange={onUploadStateChange}
          t={t}
        />
        <AdminField
          className="min-w-0"
          label={optionalLabel(isMotorcycle ? "motorcycleCapacity" : "carCapacity")}
        >
          <input className="app-input" type="number" min="1" max={isMotorcycle ? "2" : "12"} value={form.capacity} onChange={(e) => change("capacity", e.target.value)} />
        </AdminField>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          {isMotorcycle ? <CheckField label={t("adminProviderMobility.vehicle.helmet")} checked={form.hasPassengerHelmet} onChange={(value) => change("hasPassengerHelmet", value)} /> : null}
          {!isMotorcycle ? <CheckField label={t("adminProviderMobility.vehicle.airConditioning")} checked={form.hasAirConditioning} onChange={(value) => change("hasAirConditioning", value)} /> : null}
        </div>
      </section>
      <DocumentFields t={t} form={form} change={change} prefix="registration" numberField="registrationNumber" urlField="registrationDocumentUrl" verifiedField="registrationVerified" providerId={providerId} mediaKind="vehicleRegistration" onUploadStateChange={onUploadStateChange} />
      <DocumentFields t={t} form={form} change={change} prefix="insurance" numberField="insurancePolicyNumber" urlField="insuranceDocumentUrl" expiryField="insuranceExpiresAt" verifiedField="insuranceVerified" providerId={providerId} mediaKind="vehicleInsurance" onUploadStateChange={onUploadStateChange} />
      <DocumentFields t={t} form={form} change={change} prefix="inspection" numberField="inspectionCertificateNumber" urlField="inspectionDocumentUrl" expiryField="inspectionExpiresAt" verifiedField="inspectionVerified" providerId={providerId} mediaKind="vehicleInspection" onUploadStateChange={onUploadStateChange} />
      {editing ? <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdminField label={t("adminProviderMobility.vehicle.status")}>
          <select className="app-input" value={form.status} onChange={(e) => change("status", e.target.value)}>
            {["pending", "active", "suspended", "retired"].map((status) => <option key={status} value={status}>{t(`adminProviderMobility.vehicle.statuses.${status}`)}</option>)}
          </select>
        </AdminField>
      </div> : null}
      <div className="mt-5 flex justify-end gap-2">
        {editing ? <button type="button" onClick={onCancel} className="app-btn-secondary rounded-full px-5 py-2.5 text-sm">{t("common.cancel")}</button> : null}
        <button className="app-btn-primary rounded-full px-5 py-2.5 text-sm" disabled={saving || mediaUploading}>{t(saving ? "adminProviderMobility.saving" : "adminProviderMobility.vehicle.save")}</button>
      </div>
    </form>
  );
}

function DocumentFields({
  t,
  form,
  change,
  prefix,
  numberField,
  urlField,
  expiryField,
  verifiedField,
  providerId,
  mediaKind,
  onUploadStateChange,
}) {
  const optionalLabel = (label) =>
    t("adminProviderMobility.vehicle.optionalField", { label });

  return (
    <fieldset className="mt-5 rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-semibold text-text-primary">{t(`adminProviderMobility.documents.${prefix}.title`)}</legend>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminField label={optionalLabel(t("adminProviderMobility.documents.number"))}><input className="app-input" value={form[numberField]} onChange={(e) => change(numberField, e.target.value)} /></AdminField>
        <MobilityMediaPicker
          label={optionalLabel(t("adminProviderMobility.documents.url"))}
          value={form[urlField]}
          providerId={providerId}
          kind={mediaKind}
          onUploaded={(url) => change(urlField, url)}
          onUploadStateChange={onUploadStateChange}
          t={t}
        />
        {expiryField ? <AdminField label={optionalLabel(t("adminProviderMobility.documents.expiry"))}><input className="app-input" type="date" value={form[expiryField]} onChange={(e) => change(expiryField, e.target.value)} /></AdminField> : null}
      </div>
      <div className="mt-3"><CheckField label={t("adminProviderMobility.documents.verified")} checked={form[verifiedField]} onChange={(value) => change(verifiedField, value)} /></div>
    </fieldset>
  );
}

function MobilityMediaPicker({
  label,
  value,
  providerId,
  kind,
  photosOnly = false,
  onUploaded,
  onUploadStateChange,
  t,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const chooseFile = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError("");
    setFileName(selectedFile.name);
    onUploadStateChange?.(true);
    try {
      const preparedFile = await optimizeImageForUpload(selectedFile);
      const media = await uploadProviderMobilityMedia(
        providerId,
        kind,
        preparedFile,
        setProgress
      );
      if (!media?.url) throw new Error(t("adminProviderMobility.errors.upload"));
      onUploaded(media.url);
      setProgress(100);
      notify.success(t("adminProviderMobility.success.upload"));
    } catch (uploadError) {
      const message =
        uploadError?.response?.data?.error ||
        uploadError?.message ||
        t("adminProviderMobility.errors.upload");
      setError(message);
      setFileName("");
      notify.error(message);
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  };

  return (
    <AdminField label={label} className="min-w-0">
      <div className="min-w-0 overflow-hidden rounded-xl border border-dashed border-border bg-surface-main/50 p-3">
        {value ? (
          <div className="mb-3 flex min-w-0 items-center gap-3 overflow-hidden">
            {photosOnly ? (
              <img
                src={getFileUrl(value)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
              />
            ) : (
              <FileCheck2 className="shrink-0 text-emerald-600" size={24} />
            )}
            <div className="min-w-0 flex-1">
              <p
                className="block max-w-full truncate text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                title={fileName || undefined}
              >
                {fileName || t("adminProviderMobility.media.saved")}
              </p>
              <a
                href={getFileUrl(value)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 underline dark:text-blue-300"
              >
                {t("adminProviderMobility.media.preview")}
              </a>
            </div>
            <button
              type="button"
              onClick={() => {
                onUploaded("");
                setFileName("");
              }}
              disabled={uploading}
              className="shrink-0 rounded-full p-2 text-text-muted hover:bg-surface-card hover:text-rose-600"
              aria-label={t("adminProviderMobility.media.remove")}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
            {photosOnly ? <ImageIcon size={18} /> : <FileCheck2 size={18} />}
            {t(
              photosOnly
                ? "adminProviderMobility.media.photoHint"
                : "adminProviderMobility.media.documentHint"
            )}
          </div>
        )}
        <label
          className={`flex w-full min-w-0 max-w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-border bg-surface-card px-4 py-2 text-xs font-semibold text-text-secondary sm:w-auto ${
            uploading ? "pointer-events-none opacity-60" : "hover:border-blue-400"
          }`}
        >
          {uploading ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <Upload size={14} className="shrink-0" />}
          <span className="min-w-0 truncate">
            {uploading
              ? t("adminProviderMobility.media.uploading", { progress })
              : t(value ? "adminProviderMobility.media.replace" : "adminProviderMobility.media.choose")}
          </span>
          <input
            type="file"
            className="sr-only"
            accept={photosOnly ? PHOTO_ACCEPT : DOCUMENT_ACCEPT}
            onChange={chooseFile}
            disabled={uploading}
          />
        </label>
        {error ? <p className="mt-2 break-words text-xs text-rose-600">{error}</p> : null}
      </div>
    </AdminField>
  );
}
