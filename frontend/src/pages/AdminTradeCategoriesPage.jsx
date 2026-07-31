// frontend/src/pages/AdminTradeCategoriesPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listTradeCategoriesAdmin,
  createTradeCategory,
  updateTradeCategory,
  deleteTradeCategory,
} from "../services/tradeCategories";
import { getCountries } from "../services/countries";
import { getRegions } from "../services/regions";
import { me } from "../services/auth";
import { normalizeRole, isMasterUser, isGlobalAdminUser } from "../utils/role";
import { notify } from "../utils/notify";
import { getFeedbackIcon } from "../utils/feedback";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import {
  AdminActionsRow,
  AdminField,
  AdminFormPanel,
  AdminPageHeader,
  AdminPanelCard,
  AdminRowActions,
} from "../components/admin/AdminFormUi";

// Gestion des filières (trade categories) Teranga Pro, scopées par pays/région (voir
// backend/src/controllers/tradeCategory.controller.js) : un master (admin scopé) hérite
// TOUJOURS de son propre périmètre à la création — jamais d'un pays/région choisi dans le
// formulaire, il ne peut donc éditer/supprimer que SES filières. Seul l'admin global peut
// choisir un périmètre arbitraire ou laisser vide pour une filière globale (le catalogue par
// défaut, visible partout). Sans ce scope, une filière "par défaut" créée par un master
// apparaissait partout et une mission qui l'utilisait ne pouvait pas être routée de façon
// fiable vers le bon master (voir mission.controller.js / resolveMissionGeoScope.js
// tradeCategoryScope).

function isTruthyId(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s === "0") return false;
  return true;
}

// Miroir client de geoScope.js canAccessGeoResource() : un master ne peut gérer que les
// filières de SON périmètre exact (jamais les globales, jamais un autre pays/région).
function canManageTradeCategory(user, tc, globalAdmin) {
  if (globalAdmin) return true;
  if (!isTruthyId(tc?.countryId)) return false;

  const userRegionId = user?.regionId ?? null;
  const userCountryId = user?.countryId ?? null;

  if (isTruthyId(userRegionId)) {
    if (String(tc.regionId) === String(userRegionId)) return true;
    if (!isTruthyId(tc.regionId) && isTruthyId(userCountryId) && String(tc.countryId) === String(userCountryId)) {
      return true;
    }
    return false;
  }
  if (isTruthyId(userCountryId)) return String(tc.countryId) === String(userCountryId);
  return false;
}

const DEFAULT_FORM = {
  name: "",
  requiresCompany: false,
  defaultWarrantyDays: "0",
  isActive: true,
  countryId: "",
  regionId: "",
};

export default function AdminTradeCategoriesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const [user, setUser] = useState(null);
  const [tradeCategories, setTradeCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [search, setSearch] = useState("");

  const isMaster = useMemo(() => isMasterUser(user), [user]);
  const globalAdmin = useMemo(() => isGlobalAdminUser(user), [user]);

  const regionsForCountry = useMemo(
    () => regions.filter((r) => String(r.countryId) === String(form.countryId)),
    [regions, form.countryId]
  );

  const loadTradeCategories = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const rows = await listTradeCategoriesAdmin();
      setTradeCategories(rows || []);
    } catch (err) {
      console.error("AdminTradeCategoriesPage load error:", err);
      setErrorMsg(t("adminTradeCategoriesPage.errors.load"));
      notify(t("adminTradeCategoriesPage.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ud = await me();
        if (!mounted) return;
        const current = ud?.user;
        if (!current) {
          window.location.href = "/login";
          return;
        }
        if (normalizeRole(current.role) !== "admin") {
          window.location.href = "/dashboard";
          return;
        }
        setUser(current);
        await loadTradeCategories();

        // Pays/régions uniquement nécessaires pour l'admin global (sélecteur de périmètre) : un
        // master hérite toujours du sien, aucun appel supplémentaire nécessaire pour lui.
        if (isGlobalAdminUser(current)) {
          const [countryList, regionList] = await Promise.all([getCountries(), getRegions()]);
          if (!mounted) return;
          setCountries(countryList || []);
          setRegions(regionList || []);
        }
      } catch (err) {
        console.error("AdminTradeCategoriesPage init error:", err);
        if (!mounted) return;
        setErrorMsg(t("adminTradeCategoriesPage.errors.sessionLoad"));
      }
    }

    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    if (!form.name.trim()) {
      notify(t("adminTradeCategoriesPage.errors.nameRequired"));
      return;
    }

    const payload = {
      name: form.name.trim(),
      requiresCompany: Boolean(form.requiresCompany),
      defaultWarrantyDays: Number(form.defaultWarrantyDays) || 0,
      isActive: Boolean(form.isActive),
    };

    // countryId/regionId : uniquement pour l'admin global — un master ne peut jamais choisir de
    // périmètre, le backend l'ignorerait de toute façon (il hérite du sien systématiquement).
    if (globalAdmin) {
      payload.countryId = form.countryId ? Number(form.countryId) : null;
      payload.regionId = form.regionId ? Number(form.regionId) : null;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      if (editing) {
        await updateTradeCategory(editing.id, payload);
        notify(t("adminTradeCategoriesPage.alerts.updated"));
      } else {
        await createTradeCategory(payload);
        notify(t("adminTradeCategoriesPage.alerts.created"));
      }

      resetForm();
      await loadTradeCategories();
      setShowForm(false);
    } catch (err) {
      console.error("AdminTradeCategoriesPage submit error:", err);
      const message =
        err?.response?.data?.error || t("adminTradeCategoriesPage.errors.save");
      setErrorMsg(message);
      notify(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirmDelete("tradeCategory");
    if (!ok) return;

    try {
      setErrorMsg("");
      await deleteTradeCategory(id);
      await loadTradeCategories();
    } catch (err) {
      console.error("AdminTradeCategoriesPage delete error:", err);
      const message =
        err?.response?.data?.error || t("adminTradeCategoriesPage.errors.delete");
      setErrorMsg(message);
      notify(message);
    }
  }

  const filteredTradeCategories = tradeCategories.filter((c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (c.name || "").toLowerCase().includes(term);
  });

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-text-secondary text-lg animate-pulse">
          {t("adminTradeCategoriesPage.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-10">
      <div className="max-w-5xl mx-auto bg-surface-card shadow-lg shadow-slate-200/40 rounded-3xl p-8 border border-border">
        {/* HEADER */}
        <AdminPageHeader
          className="items-center"
          title={t("adminTradeCategoriesPage.title")}
          titleClassName="text-3xl"
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {t("adminTradeCategoriesPage.labels.connectedAs", {
                  email: user.email,
                  role: user.role,
                })}
              </span>

              {isMaster && (
                <span className="app-badge app-badge-success text-[0.7rem]">
                  {t("adminTradeCategoriesPage.badges.master")}
                </span>
              )}
            </span>
          }
          subtitleClassName="mt-1 text-sm text-text-secondary"
          meta={
            (isTruthyId(user.countryId) || isTruthyId(user.regionId)) && (
              <p className="text-xs text-text-muted mt-2">
                {t("adminTradeCategoriesPage.labels.scope")}{" "}
                {isTruthyId(user.regionId)
                  ? t("adminTradeCategoriesPage.labels.regionId", { id: user.regionId })
                  : t("adminTradeCategoriesPage.labels.countryId", { id: user.countryId })}
              </p>
            )
          }
          actions={
            <>
              <button
                onClick={() => {
                  if (showForm) resetForm();
                  setShowForm((v) => !v);
                }}
                className="app-btn-neutral px-4 py-2 text-sm font-semibold rounded-xl shadow-sm transition"
              >
                {showForm
                  ? t("adminTradeCategoriesPage.buttons.hideForm")
                  : t("adminTradeCategoriesPage.buttons.showForm")}
              </button>

              <button
                onClick={loadTradeCategories}
                disabled={loading}
                className="app-btn-primary px-4 py-2 text-sm font-semibold rounded-xl shadow-sm"
              >
                {loading
                  ? t("adminTradeCategoriesPage.loading")
                  : t("adminTradeCategoriesPage.buttons.refresh")}
              </button>
            </>
          }
        />

        {errorMsg && (
          <div className="app-alert app-alert-error mb-6 flex gap-2 items-start">
            <span className="mt-[2px]">{getFeedbackIcon("error")}</span>
            <p className="break-words">{errorMsg}</p>
          </div>
        )}

        {/* BARRE DE RECHERCHE */}
        <AdminPanelCard className="mb-6 bg-surface-main/70 p-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              /
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminTradeCategoriesPage.searchPlaceholder")}
              className="app-input w-full pl-10 pr-3 bg-surface-main"
            />
          </div>
        </AdminPanelCard>

        {/* FORMULAIRE */}
        {showForm && (
          <AdminFormPanel onSubmit={handleSubmit} className="mb-10 animate-fadeIn">
            <AdminField
              label={t("adminTradeCategoriesPage.form.nameLabel")}
              labelClassName="text-sm font-medium text-text-primary"
            >
              <input
                type="text"
                placeholder={t("adminTradeCategoriesPage.form.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="app-input"
              />
            </AdminField>

            <AdminField
              label={t("adminTradeCategoriesPage.form.warrantyLabel")}
              labelClassName="text-sm font-medium text-text-primary"
            >
              <input
                type="number"
                min="0"
                max="3650"
                value={form.defaultWarrantyDays}
                onChange={(e) =>
                  setForm({ ...form, defaultWarrantyDays: e.target.value })
                }
                className="app-input"
              />
            </AdminField>

            {globalAdmin ? (
              <>
                <AdminField
                  label={t("adminTradeCategoriesPage.form.countryLabel")}
                  labelClassName="text-sm font-medium text-text-primary"
                >
                  <select
                    value={form.countryId}
                    onChange={(e) =>
                      setForm({ ...form, countryId: e.target.value, regionId: "" })
                    }
                    className="app-input"
                  >
                    <option value="">{t("adminTradeCategoriesPage.form.countryGlobalOption")}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminField
                  label={t("adminTradeCategoriesPage.form.regionLabel")}
                  labelClassName="text-sm font-medium text-text-primary"
                >
                  <select
                    value={form.regionId}
                    onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                    disabled={!form.countryId}
                    className="app-input disabled:opacity-60"
                  >
                    <option value="">{t("adminTradeCategoriesPage.form.regionWholeCountryOption")}</option>
                    {regionsForCountry.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </>
            ) : (
              <p className="sm:col-span-2 text-xs text-text-muted italic">
                {t("adminTradeCategoriesPage.form.masterScopeNotice", {
                  scope: isTruthyId(user.regionId)
                    ? t("adminTradeCategoriesPage.labels.regionId", { id: user.regionId })
                    : t("adminTradeCategoriesPage.labels.countryId", { id: user.countryId }),
                })}
              </p>
            )}

            <AdminField label="" labelClassName="text-sm font-medium text-text-primary">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={form.requiresCompany}
                  onChange={(e) =>
                    setForm({ ...form, requiresCompany: e.target.checked })
                  }
                />
                {t("adminTradeCategoriesPage.form.requiresCompanyLabel")}
              </label>
            </AdminField>

            <AdminField label="" labelClassName="text-sm font-medium text-text-primary">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {t("adminTradeCategoriesPage.form.isActiveLabel")}
              </label>
            </AdminField>

            <AdminActionsRow className="mt-2 justify-end text-right">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm bg-surface-main/80 text-text-secondary hover:bg-surface-main transition"
                >
                  {t("adminTradeCategoriesPage.buttons.cancel")}
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="app-btn-primary px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm"
              >
                {saving
                  ? t("adminTradeCategoriesPage.buttons.saving")
                  : editing
                  ? t("adminTradeCategoriesPage.buttons.update")
                  : t("adminTradeCategoriesPage.buttons.create")}
              </button>
            </AdminActionsRow>
          </AdminFormPanel>
        )}

        {loading && tradeCategories.length === 0 ? (
          <p className="text-text-muted italic text-center py-8">
            {t("adminTradeCategoriesPage.loadingTradeCategories")}
          </p>
        ) : filteredTradeCategories.length === 0 ? (
          <p className="text-text-muted italic text-center py-8">
            {t("adminTradeCategoriesPage.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredTradeCategories.map((c) => {
              const canManage = canManageTradeCategory(user, c, globalAdmin);
              const scopeLabel = c.region?.name
                ? c.region.name
                : c.country?.name
                ? c.country.name
                : t("adminTradeCategoriesPage.badges.global");

              return (
                <div
                  key={c.id}
                  className="bg-surface-card border border-border rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-main hover:shadow-md transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-text-primary break-words">
                        {c.name}
                      </h3>
                      <span
                        className={`app-badge text-[0.7rem] ${
                          c.isActive ? "app-badge-success" : "app-badge-warning"
                        }`}
                      >
                        {c.isActive
                          ? t("adminTradeCategoriesPage.badges.active")
                          : t("adminTradeCategoriesPage.badges.inactive")}
                      </span>
                      <span className="app-badge text-[0.7rem] bg-surface-main text-text-secondary border-border">
                        {scopeLabel}
                      </span>
                      {c.requiresCompany && (
                        <span className="app-badge app-badge-info text-[0.7rem]">
                          {t("adminTradeCategoriesPage.badges.requiresCompany")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-1 break-words">
                      {t("adminTradeCategoriesPage.table.warranty", {
                        count: c.defaultWarrantyDays || 0,
                      })}
                    </p>
                  </div>

                  {canManage ? (
                    <AdminRowActions
                      className="justify-end sm:flex-nowrap"
                      itemClassName="px-3 py-1.5 text-xs sm:text-sm rounded-xl shadow-sm"
                      actions={[
                        {
                          key: "edit-trade-category",
                          label: t("adminTradeCategoriesPage.table.edit"),
                          onClick: () => {
                            setForm({
                              name: c.name || "",
                              requiresCompany: Boolean(c.requiresCompany),
                              defaultWarrantyDays: String(c.defaultWarrantyDays ?? 0),
                              isActive: Boolean(c.isActive),
                              countryId: c.countryId ? String(c.countryId) : "",
                              regionId: c.regionId ? String(c.regionId) : "",
                            });
                            setEditing(c);
                            setShowForm(true);
                          },
                          buttonClassName: "app-btn-warning",
                        },
                        {
                          key: "delete-trade-category",
                          label: t("adminTradeCategoriesPage.table.delete"),
                          onClick: () => handleDelete(c.id),
                          buttonClassName: "app-btn-danger",
                        },
                      ]}
                    />
                  ) : (
                    <span className="text-xs text-text-muted italic self-start sm:self-center">
                      {t("adminTradeCategoriesPage.badges.readOnly")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
