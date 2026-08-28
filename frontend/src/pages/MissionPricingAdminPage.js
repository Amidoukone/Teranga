import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, Pencil, Plus, X, Check } from "lucide-react";

import { me } from "../services/auth";
import { getCountries } from "../services/countries";
import { getRegions } from "../services/regions";
import { getTradeCategories } from "../services/missionRequests";
import { listTradeCategoriesAdmin } from "../services/tradeCategories";
import {
  listMissionPricingRules,
  createMissionPricingRule,
  updateMissionPricingRule,
  deleteMissionPricingRule,
} from "../services/missionPricingRules";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import AuthFeedbackBanner from "../components/AuthFeedbackBanner";

const CLASSIC_SERVICE_TYPES = ["errand", "administrative", "payment", "money_transfer", "other"];

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-xs font-medium text-text-secondary";

const EMPTY_FORM = {
  countryId: "",
  regionId: "",
  categoryMode: "generic",
  tradeCategoryId: "",
  serviceType: "",
  vehicleType: "",
  packageType: "",
  pricingMode: "fixed_estimate",
  basePrice: "",
  minPrice: "",
  pricePerKm: "0",
  priceIncrement: "0",
  estimatedDelayMinutes: "",
};

export default function MissionPricingAdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirmDelete } = useDeleteConfirm();

  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [tradeCategories, setTradeCategories] = useState([]);
  // Catalogue complet (toutes filières visibles par cet admin/master, cf.
  // tradeCategory.controller.js listForAdmin), utilisé UNIQUEMENT pour afficher le nom de la
  // filière de chaque règle existante dans le tableau — `tradeCategories` ci-dessus reste, lui,
  // filtré dynamiquement par le pays/région choisi dans le formulaire de création.
  const [allTradeCategories, setAllTradeCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const isGlobalAdmin = user ? !user.countryId && !user.regionId : false;

  useEffect(() => {
    (async () => {
      try {
        const { user: u } = await me();
        if (!u || u.role !== "admin") {
          navigate("/dashboard");
          return;
        }
        setUser(u);

        const [countryList, regionList, ruleList, allTradeCategoryList] = await Promise.all([
          getCountries(),
          getRegions(),
          listMissionPricingRules(),
          listTradeCategoriesAdmin(),
        ]);
        setCountries(countryList);
        setRegions(regionList);
        setRules(ruleList);
        setAllTradeCategories(allTradeCategoryList || []);

        setForm((f) => ({
          ...f,
          countryId: u.countryId ? String(u.countryId) : f.countryId,
          regionId: u.regionId ? String(u.regionId) : f.regionId,
        }));
      } catch (_err) {
        setFeedback({ type: "error", message: t("missionPricingAdmin.errors.load") });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regionsForCountry = useMemo(
    () => regions.filter((r) => String(r.countryId) === String(form.countryId)),
    [regions, form.countryId]
  );

  // Filières disponibles pour le pays/région actuellement sélectionné dans le formulaire
  // (globales + celles scopées à ce pays/région, cf. AdminTradeCategoriesPage.jsx) : une règle
  // de tarification est toujours créée pour un pays précis, le catalogue de filières doit donc
  // suivre CE choix plutôt que le périmètre du compte admin connecté.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getTradeCategories({
          countryId: form.countryId || undefined,
          regionId: form.regionId || undefined,
        });
        if (!cancelled) setTradeCategories(list);
      } catch (_err) {
        if (!cancelled) setTradeCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.countryId, form.regionId]);

  const countryNameById = useMemo(() => {
    const map = new Map();
    countries.forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [countries]);

  const regionNameById = useMemo(() => {
    const map = new Map();
    regions.forEach((r) => map.set(String(r.id), r.name));
    return map;
  }, [regions]);

  const tradeCategoryNameById = useMemo(() => {
    const map = new Map();
    allTradeCategories.forEach((tc) => map.set(String(tc.id), tc.name));
    return map;
  }, [allTradeCategories]);

  const categoryLabel = (rule) => {
    if (rule.tradeCategoryId) {
      const tradeLabel = tradeCategoryNameById.get(String(rule.tradeCategoryId)) || "—";
      if (rule.vehicleType) {
        return `${tradeLabel} — ${t(`missionPricingAdmin.form.vehicleType.${rule.vehicleType}`)}`;
      }
      if (rule.packageType) {
        return `${tradeLabel} — ${t(`missionPricingAdmin.form.packageType.${rule.packageType}`)}`;
      }
      return tradeLabel;
    }
    if (rule.serviceType) return t(`services.type.${rule.serviceType}`);
    return t("missionPricingAdmin.table.genericCategory");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const payload = {
        countryId: Number(form.countryId),
        regionId: form.regionId ? Number(form.regionId) : null,
        pricingMode: form.pricingMode,
        basePrice: form.basePrice !== "" ? Number(form.basePrice) : null,
        minPrice: form.minPrice !== "" ? Number(form.minPrice) : null,
        pricePerKm: form.pricePerKm !== "" ? Number(form.pricePerKm) : 0,
        priceIncrement: form.priceIncrement !== "" ? Number(form.priceIncrement) : 0,
        estimatedDelayMinutes: Number(form.estimatedDelayMinutes),
      };
      if (form.categoryMode === "trade") payload.tradeCategoryId = Number(form.tradeCategoryId);
      if (form.categoryMode === "classic") payload.serviceType = form.serviceType;
      if (form.categoryMode === "trade" && form.vehicleType) {
        payload.vehicleType = form.vehicleType;
      }
      if (form.categoryMode === "trade" && form.packageType) {
        payload.packageType = form.packageType;
      }

      const created = await createMissionPricingRule(payload);
      setRules((prev) => [created, ...prev]);
      setFeedback({ type: "success", message: t("missionPricingAdmin.success.created") });
      setForm((f) => ({ ...EMPTY_FORM, countryId: f.countryId, regionId: "" }));
    } catch (error) {
      const backendMessage = error?.response?.data?.error;
      setFeedback({ type: "error", message: backendMessage || t("missionPricingAdmin.errors.create") });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setEditForm({
      pricingMode: rule.pricingMode,
      basePrice: rule.basePrice ?? "",
      minPrice: rule.minPrice ?? "",
      pricePerKm: rule.pricePerKm ?? 0,
      priceIncrement: rule.priceIncrement ?? 0,
      estimatedDelayMinutes: rule.estimatedDelayMinutes,
      isActive: rule.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (id) => {
    try {
      const payload = {
        pricingMode: editForm.pricingMode,
        basePrice: editForm.basePrice !== "" ? Number(editForm.basePrice) : null,
        minPrice: editForm.minPrice !== "" ? Number(editForm.minPrice) : null,
        pricePerKm: Number(editForm.pricePerKm) || 0,
        priceIncrement: Number(editForm.priceIncrement) || 0,
        estimatedDelayMinutes: Number(editForm.estimatedDelayMinutes),
        isActive: Boolean(editForm.isActive),
      };
      const updated = await updateMissionPricingRule(id, payload);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      cancelEdit();
    } catch (error) {
      const backendMessage = error?.response?.data?.error;
      setFeedback({ type: "error", message: backendMessage || t("missionPricingAdmin.errors.update") });
    }
  };

  const handleDelete = async (rule) => {
    const ok = await confirmDelete("missionPricingRule");
    if (!ok) return;
    try {
      await deleteMissionPricingRule(rule.id);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: false } : r)));
    } catch (error) {
      const backendMessage = error?.response?.data?.error;
      setFeedback({ type: "error", message: backendMessage || t("missionPricingAdmin.errors.delete") });
    }
  };

  const selectedTradeCategory = tradeCategories.find(
    (tc) => String(tc.id) === String(form.tradeCategoryId)
  );
  const isMobilityPricing = selectedTradeCategory?.slug === "mobilite";
  const isDeliveryPricing = selectedTradeCategory?.slug === "livraison";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-text-muted" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="page-kicker">{t("missionPricingAdmin.kicker")}</p>
      <h1 className="app-page-headline">{t("missionPricingAdmin.title")}</h1>
      <p className="app-page-subtitle">
        {isGlobalAdmin
          ? t("missionPricingAdmin.subtitleGlobal")
          : t("missionPricingAdmin.subtitleScoped", {
              country: countryNameById.get(String(user.countryId)) || "",
            })}
      </p>

      {feedback ? (
        <div className="mt-4">
          <AuthFeedbackBanner type={feedback.type} message={feedback.message} />
        </div>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface-card p-5 sm:grid-cols-2"
      >
        <div>
          <label className={labelClass}>{t("missionPricingAdmin.form.country")}</label>
          <select
            className={inputClass}
            value={form.countryId}
            onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value, regionId: "" }))}
            disabled={!isGlobalAdmin}
            required
          >
            <option value="">{t("missionPricingAdmin.form.selectCountry")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("missionPricingAdmin.form.region")}</label>
          <select
            className={inputClass}
            value={form.regionId}
            onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
            disabled={Boolean(user?.regionId)}
          >
            <option value="">{t("missionPricingAdmin.form.countryWide")}</option>
            {regionsForCountry.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>{t("missionPricingAdmin.form.category")}</label>
          <div className="flex flex-wrap gap-2">
            {["trade", "classic", "generic"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    categoryMode: mode,
                    tradeCategoryId: "",
                    serviceType: "",
                    vehicleType: "",
                    packageType: "",
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  form.categoryMode === mode
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-border bg-surface-main text-text-secondary"
                }`}
              >
                {t(`missionPricingAdmin.form.categoryMode.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        {form.categoryMode === "trade" ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("missionPricingAdmin.form.tradeCategory")}</label>
            <select
              className={inputClass}
              value={form.tradeCategoryId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tradeCategoryId: e.target.value,
                  vehicleType: "",
                  packageType: "",
                }))
              }
              required
            >
              <option value="">{t("missionPricingAdmin.form.selectTradeCategory")}</option>
              {tradeCategories.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {form.categoryMode === "trade" && isMobilityPricing ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("missionPricingAdmin.form.vehicle")}</label>
            <select
              className={inputClass}
              value={form.vehicleType}
              onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
            >
              <option value="">{t("missionPricingAdmin.form.vehicleType.all")}</option>
              <option value="motorcycle">
                {t("missionPricingAdmin.form.vehicleType.motorcycle")}
              </option>
              <option value="car">{t("missionPricingAdmin.form.vehicleType.car")}</option>
            </select>
          </div>
        ) : null}

        {form.categoryMode === "trade" && isDeliveryPricing ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("missionPricingAdmin.form.package")}</label>
            <select
              className={inputClass}
              value={form.packageType}
              onChange={(e) => setForm((f) => ({ ...f, packageType: e.target.value }))}
            >
              <option value="">{t("missionPricingAdmin.form.packageType.all")}</option>
              {['document', 'small', 'standard', 'bulky'].map((type) => (
                <option key={type} value={type}>
                  {t(`missionPricingAdmin.form.packageType.${type}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {form.categoryMode === "classic" ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>{t("missionPricingAdmin.form.serviceType")}</label>
            <select
              className={inputClass}
              value={form.serviceType}
              onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
              required
            >
              <option value="">{t("missionPricingAdmin.form.selectServiceType")}</option>
              {CLASSIC_SERVICE_TYPES.map((key) => (
                <option key={key} value={key}>
                  {t(`services.type.${key}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>{t("missionPricingAdmin.form.pricingMode")}</label>
          <select
            className={inputClass}
            value={form.pricingMode}
            onChange={(e) => setForm((f) => ({ ...f, pricingMode: e.target.value }))}
          >
            <option value="fixed_estimate">{t("missionPricingAdmin.form.pricingModeFixed")}</option>
            <option value="quote_only">{t("missionPricingAdmin.form.pricingModeQuote")}</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("missionPricingAdmin.form.estimatedDelayMinutes")}</label>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={form.estimatedDelayMinutes}
            onChange={(e) => setForm((f) => ({ ...f, estimatedDelayMinutes: e.target.value }))}
            required
          />
        </div>

        {form.pricingMode === "fixed_estimate" ? (
          <>
            <div>
              <label className={labelClass}>{t("missionPricingAdmin.form.basePrice")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t("missionPricingAdmin.form.minPrice")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.minPrice}
                onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t("missionPricingAdmin.form.pricePerKm")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.pricePerKm}
                onChange={(e) => setForm((f) => ({ ...f, pricePerKm: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t("missionPricingAdmin.form.priceIncrement")}</label>
              <input
                type="number"
                min="0"
                step="100"
                className={inputClass}
                value={form.priceIncrement}
                onChange={(e) => setForm((f) => ({ ...f, priceIncrement: e.target.value }))}
              />
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting || !form.countryId}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("missionPricingAdmin.form.submit")}
          </button>
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-main text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">{t("missionPricingAdmin.table.country")}</th>
              <th className="px-4 py-3">{t("missionPricingAdmin.table.category")}</th>
              <th className="px-4 py-3">{t("missionPricingAdmin.table.pricing")}</th>
              <th className="px-4 py-3">{t("missionPricingAdmin.table.delay")}</th>
              <th className="px-4 py-3">{t("missionPricingAdmin.table.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
                <td className="px-4 py-3">
                  {countryNameById.get(String(rule.countryId)) || rule.countryId}
                  <span className="block text-xs text-text-muted">
                    {rule.regionId
                      ? regionNameById.get(String(rule.regionId)) || rule.regionId
                      : t("missionPricingAdmin.form.countryWide")}
                  </span>
                </td>
                <td className="px-4 py-3">{categoryLabel(rule)}</td>

                {editingId === rule.id ? (
                  <>
                    <td className="px-4 py-3">
                      <select
                        className={inputClass}
                        value={editForm.pricingMode}
                        onChange={(e) => setEditForm((f) => ({ ...f, pricingMode: e.target.value }))}
                      >
                        <option value="fixed_estimate">{t("missionPricingAdmin.form.pricingModeFixed")}</option>
                        <option value="quote_only">{t("missionPricingAdmin.form.pricingModeQuote")}</option>
                      </select>
                      {editForm.pricingMode === "fixed_estimate" ? (
                        <div className="mt-1 space-y-1">
                          <input
                            type="number"
                            className={inputClass}
                            placeholder={t("missionPricingAdmin.form.basePrice")}
                            value={editForm.basePrice}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, basePrice: e.target.value }))
                            }
                          />
                          <input
                            type="number"
                            className={inputClass}
                            placeholder={t("missionPricingAdmin.form.pricePerKm")}
                            value={editForm.pricePerKm}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, pricePerKm: e.target.value }))
                            }
                          />
                          <input
                            type="number"
                            className={inputClass}
                            placeholder={t("missionPricingAdmin.form.priceIncrement")}
                            value={editForm.priceIncrement}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, priceIncrement: e.target.value }))
                            }
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        className={inputClass}
                        value={editForm.estimatedDelayMinutes}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, estimatedDelayMinutes: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                        />
                        {t("missionPricingAdmin.table.active")}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(rule.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-emerald-600 hover:bg-emerald-50"
                          aria-label={t("missionPricingAdmin.table.save")}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-surface-main"
                          aria-label={t("missionPricingAdmin.table.cancel")}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      {rule.pricingMode === "fixed_estimate"
                        ? `${rule.basePrice} ${rule.country?.currency || ""} + ${rule.pricePerKm || 0}/km${
                            Number(rule.priceIncrement) > 0 ? ` · ↗ ${rule.priceIncrement}` : ""
                          }`
                        : t("missionPricingAdmin.form.pricingModeQuote")}
                    </td>
                    <td className="px-4 py-3">{rule.estimatedDelayMinutes} min</td>
                    <td className="px-4 py-3">
                      {rule.isActive ? t("missionPricingAdmin.table.active") : t("missionPricingAdmin.table.inactive")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-surface-main"
                          aria-label={t("missionPricingAdmin.table.edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        {rule.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(rule)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-red-600 hover:bg-red-50"
                            aria-label={t("missionPricingAdmin.table.delete")}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                  {t("missionPricingAdmin.table.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
