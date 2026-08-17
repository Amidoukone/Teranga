import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bike, CarFront, ShieldCheck } from "lucide-react";

import { AdminField, AdminPageHeader } from "../components/admin/AdminFormUi";
import { notify } from "../utils/notify";
import {
  createProviderVehicle,
  getProvider,
  listProviderVehicles,
  updateProviderDriverCompliance,
  updateProviderVehicle,
} from "../services/providers";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, fleet] = await Promise.all([getProvider(id), listProviderVehicles(id)]);
      setProvider(detail?.provider || null);
      setCompliance(detail?.compliance || null);
      setVehicles(fleet);
      setDriverForm(driverFormFrom(detail?.provider));
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

  const saveDriver = async (event) => {
    event.preventDefault();
    setSavingDriver(true);
    try {
      const result = await updateProviderDriverCompliance(id, driverForm);
      setProvider(result.provider);
      setCompliance(result.compliance);
      notify.success(t("adminProviderMobility.success.driver"));
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
      const payload = {
        ...vehicleForm,
        capacity: Number(vehicleForm.capacity),
        plateNumber: vehicleForm.plateNumber.trim().toUpperCase(),
      };
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
    setEditingVehicleId(vehicle.id);
    setVehicleForm(vehicleFormFrom(vehicle));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  if (loading) {
    return <div className="min-h-screen bg-surface-main p-10 text-center text-text-muted">{t("common.loading")}</div>;
  }

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
              {t(compliance?.hasEligibleVehicle ? "adminProviderMobility.summary.yes" : "adminProviderMobility.summary.no")}
            </p>
          </div>
        </section>

        {compliance?.driverIssues?.length ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{t("adminProviderMobility.missingDriver")}</p>
            <p className="mt-1">{compliance.driverIssues.join(", ")}</p>
          </div>
        ) : null}

        <form onSubmit={saveDriver} className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-text-primary">{t("adminProviderMobility.driver.title")}</h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">{t("adminProviderMobility.privateDocuments")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <AdminField label={t("adminProviderMobility.driver.profilePhotoUrl")}>
              <input className="app-input" type="url" value={driverForm.profilePhotoUrl} onChange={(e) => changeDriver("profilePhotoUrl", e.target.value)} />
            </AdminField>
            <AdminField label={t("adminProviderMobility.driver.licenseNumber")}>
              <input className="app-input" value={driverForm.driverLicenseNumber} onChange={(e) => changeDriver("driverLicenseNumber", e.target.value)} />
            </AdminField>
            <AdminField label={t("adminProviderMobility.driver.licenseDocumentUrl")}>
              <input className="app-input" type="url" value={driverForm.driverLicenseDocumentUrl} onChange={(e) => changeDriver("driverLicenseDocumentUrl", e.target.value)} />
            </AdminField>
            <AdminField label={t("adminProviderMobility.driver.licenseExpiry")}>
              <input className="app-input" type="date" value={driverForm.driverLicenseExpiresAt} onChange={(e) => changeDriver("driverLicenseExpiresAt", e.target.value)} />
            </AdminField>
            <AdminField label={t("adminProviderMobility.driver.identityDocumentUrl")}>
              <input className="app-input" type="url" value={driverForm.identityDocumentUrl} onChange={(e) => changeDriver("identityDocumentUrl", e.target.value)} />
            </AdminField>
            <div className="flex flex-wrap items-end gap-5 pb-2">
              <CheckField label={t("adminProviderMobility.driver.licenseVerified")} checked={driverForm.driverLicenseVerified} onChange={(value) => changeDriver("driverLicenseVerified", value)} />
              <CheckField label={t("adminProviderMobility.driver.identityVerified")} checked={driverForm.identityDocumentVerified} onChange={(value) => changeDriver("identityDocumentVerified", value)} />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button className="app-btn-primary rounded-full px-5 py-2.5 text-sm" disabled={savingDriver}>
              {t(savingDriver ? "adminProviderMobility.saving" : "adminProviderMobility.driver.save")}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">{t("adminProviderMobility.fleet.title")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {vehicles.map((vehicle) => {
              const state = compliance?.vehicles?.find((item) => item.id === vehicle.id);
              const Icon = vehicle.vehicleType === "motorcycle" ? Bike : CarFront;
              return (
                <article key={vehicle.id} className="rounded-xl border border-border bg-surface-main/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <Icon size={20} className="mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-text-primary">{vehicle.brand} {vehicle.model}</p>
                        <p className="text-xs text-text-secondary">{vehicle.color} · {vehicle.plateNumber}</p>
                      </div>
                    </div>
                    <span className={state?.eligible ? "app-badge app-badge-success" : "app-badge app-badge-warning"}>
                      {t(state?.eligible ? "adminProviderMobility.summary.compliant" : "adminProviderMobility.summary.incomplete")}
                    </span>
                  </div>
                  {state?.issues?.length ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{state.issues.join(", ")}</p> : null}
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
        />
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

function VehicleForm({ t, form, change, onSubmit, saving, editing, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">
        {t(editing ? "adminProviderMobility.vehicle.editTitle" : "adminProviderMobility.vehicle.createTitle")}
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AdminField label={t("adminProviderMobility.vehicle.type")}>
          <select className="app-input" value={form.vehicleType} onChange={(e) => change("vehicleType", e.target.value)}>
            <option value="motorcycle">{t("adminProviderMobility.vehicle.motorcycle")}</option>
            <option value="car">{t("adminProviderMobility.vehicle.car")}</option>
          </select>
        </AdminField>
        {[["brand", "brand"], ["model", "model"], ["color", "color"], ["plateNumber", "plate"], ["photoUrl", "photoUrl"]].map(([field, key]) => (
          <AdminField key={field} label={t(`adminProviderMobility.vehicle.${key}`)}>
            <input className="app-input" type={field === "photoUrl" ? "url" : "text"} required={field !== "photoUrl"} value={form[field]} onChange={(e) => change(field, e.target.value)} />
          </AdminField>
        ))}
        <AdminField label={t("adminProviderMobility.vehicle.capacity")}>
          <input className="app-input" type="number" min="1" max="12" required value={form.capacity} onChange={(e) => change("capacity", e.target.value)} />
        </AdminField>
      </div>
      <div className="mt-4 flex flex-wrap gap-5">
        {form.vehicleType === "motorcycle" ? <CheckField label={t("adminProviderMobility.vehicle.helmet")} checked={form.hasPassengerHelmet} onChange={(value) => change("hasPassengerHelmet", value)} /> : null}
        {form.vehicleType === "car" ? <CheckField label={t("adminProviderMobility.vehicle.airConditioning")} checked={form.hasAirConditioning} onChange={(value) => change("hasAirConditioning", value)} /> : null}
      </div>
      <DocumentFields t={t} form={form} change={change} prefix="registration" numberField="registrationNumber" urlField="registrationDocumentUrl" verifiedField="registrationVerified" />
      <DocumentFields t={t} form={form} change={change} prefix="insurance" numberField="insurancePolicyNumber" urlField="insuranceDocumentUrl" expiryField="insuranceExpiresAt" verifiedField="insuranceVerified" />
      <DocumentFields t={t} form={form} change={change} prefix="inspection" numberField="inspectionCertificateNumber" urlField="inspectionDocumentUrl" expiryField="inspectionExpiresAt" verifiedField="inspectionVerified" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdminField label={t("adminProviderMobility.vehicle.status")}>
          <select className="app-input" value={form.status} onChange={(e) => change("status", e.target.value)}>
            {["pending", "active", "suspended", "retired"].map((status) => <option key={status} value={status}>{t(`adminProviderMobility.vehicle.statuses.${status}`)}</option>)}
          </select>
        </AdminField>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {editing ? <button type="button" onClick={onCancel} className="app-btn-secondary rounded-full px-5 py-2.5 text-sm">{t("common.cancel")}</button> : null}
        <button className="app-btn-primary rounded-full px-5 py-2.5 text-sm" disabled={saving}>{t(saving ? "adminProviderMobility.saving" : "adminProviderMobility.vehicle.save")}</button>
      </div>
    </form>
  );
}

function DocumentFields({ t, form, change, prefix, numberField, urlField, expiryField, verifiedField }) {
  return (
    <fieldset className="mt-5 rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-semibold text-text-primary">{t(`adminProviderMobility.documents.${prefix}.title`)}</legend>
      <div className="grid gap-4 md:grid-cols-3">
        <AdminField label={t("adminProviderMobility.documents.number")}><input className="app-input" value={form[numberField]} onChange={(e) => change(numberField, e.target.value)} /></AdminField>
        <AdminField label={t("adminProviderMobility.documents.url")}><input className="app-input" type="url" value={form[urlField]} onChange={(e) => change(urlField, e.target.value)} /></AdminField>
        {expiryField ? <AdminField label={t("adminProviderMobility.documents.expiry")}><input className="app-input" type="date" value={form[expiryField]} onChange={(e) => change(expiryField, e.target.value)} /></AdminField> : null}
      </div>
      <div className="mt-3"><CheckField label={t("adminProviderMobility.documents.verified")} checked={form[verifiedField]} onChange={(value) => change(verifiedField, value)} /></div>
    </fieldset>
  );
}
