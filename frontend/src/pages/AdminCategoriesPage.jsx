// ============================== PARTIE 1 / 2 ==============================
// frontend/src/pages/AdminCategoriesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories";
import { me } from "../services/auth";
import { normalizeRole, isGlobalAdminUser, isMasterUser } from "../utils/role";
import { notify } from '../utils/notify';
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import {
  AdminActionsRow,
  AdminField,
  AdminFormPanel,
  AdminPageHeader,
  AdminPanelCard,
  AdminRowActions,
} from "../components/admin/AdminFormUi";

/*
============================================================================
Module: administration des categories.
============================================================================
Roles admin/master et perimetre d'acces.
  - master explicite: user.role === "master"
  - master implicite: user.role === "admin" + (countryId/regionId) => admin scoped
Roles admin/master et perimetre d'acces.
- Ne pas casser tes services (getCategories/create/update/delete)
============================================================================
*/

function isTruthyId(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s === "0") return false;
  return true;
}

function computeIsMaster(user) {
  if (!user) return false;
  if (user.role === "master") return true;
  return isMasterUser(user);
}

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const { confirmDelete } = useDeleteConfirm();
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false); // Affiche l etat de chargement.

 // Contexte: administration des categories.
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [search, setSearch] = useState("");

 // Contexte: administration des categories.
  const isMaster = useMemo(() => computeIsMaster(user), [user]);
  const canWrite = useMemo(() => isGlobalAdminUser(user), [user]);

  /* ============================================================
     Initialisation au montage.
  ============================================================ */
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
        await loadCategories();
      } catch (err) {
        console.error("init AdminCategoriesPage:", err);
        if (!mounted) return;
        setErrorMsg(t("adminCategoriesPage.errors.sessionLoad"));
      }
    }

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCategories() {
    setLoading(true);
    setErrorMsg("");
    try {
      const cats = await getCategories();
      setCategories(cats || []);
    } catch (err) {
      console.error("loadCategories:", err);
      setErrorMsg(t("adminCategoriesPage.errors.load"));
      notify(t("adminCategoriesPage.errors.load"));
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     Sous-composant formulaire.
  ============================================================ */
  function resetForm() {
    setForm({ name: "", description: "" });
    setEditing(null);
  }

  /* ============================================================
     Soumission protegee (anti double-clic).
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!canWrite) {
      notify(t("adminCategoriesPage.errors.forbidden"));
      return;
    }

    if (saving) return; // Roles admin/master et perimetre d'acces.

    if (!form.name.trim()) {
      notify(t("adminCategoriesPage.errors.nameRequired"));
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      if (editing) {
        await updateCategory(editing.id, form);
        notify(t("adminCategoriesPage.alerts.updated"));
      } else {
        await createCategory(form);
        notify(t("adminCategoriesPage.alerts.created"));
      }

      resetForm();
      await loadCategories();
      setShowForm(false);
    } catch (err) {
      console.error("handleSubmit:", err);
      setErrorMsg(t("adminCategoriesPage.errors.save"));
      notify(t("adminCategoriesPage.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     Contexte: administration des categories.
  ============================================================ */
  async function handleDelete(id) {
    if (!canWrite) {
      notify(t("adminCategoriesPage.errors.forbidden"));
      return;
    }

    const ok = await confirmDelete("category");
    if (!ok) return;

    try {
      setErrorMsg("");
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error("deleteCategory:", err);
      setErrorMsg(t("adminCategoriesPage.errors.delete"));
      notify(t("adminCategoriesPage.errors.delete"));
    }
  }

  /* ============================================================
     Filtrage et tri cote interface utilisateur.
  ============================================================ */
  const filteredCategories = categories.filter((c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (c.name || "").toLowerCase().includes(term);
  });

  /* ============================================================
     Rendu principal.
  ============================================================ */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-main">
        <p className="text-text-secondary text-lg animate-pulse">
          {t("adminCategoriesPage.loading")}
        </p>
      </div>
    );
  }

  // ============================== PARTIE 2 / 2 ==============================
// ============================== PARTIE 2 / 2 ==============================
// (suite) frontend/src/pages/AdminCategoriesPage.jsx

  /* ============================================================
     Roles admin/master et perimetre d'acces.
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-main via-surface-card to-surface-main px-4 py-10">
      <div className="max-w-5xl mx-auto bg-surface-card shadow-lg shadow-slate-200/40 rounded-3xl p-8 border border-border">
        {/* HEADER */}
        <AdminPageHeader
          className="items-center"
          title={t("adminCategoriesPage.title")}
          titleClassName="text-3xl"
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {t("adminCategoriesPage.labels.connectedAs", {
                  email: user.email,
                  role: user.role,
                })}
              </span>

              {isMaster && (
                <span className="app-badge app-badge-success text-[0.7rem]">
                  {t("adminCategoriesPage.badges.master")}
                </span>
              )}

              {!canWrite && (
                <span className="app-badge app-badge-warning text-[0.7rem]">
                  {t("adminCategoriesPage.badges.readOnly")}
                </span>
              )}
            </span>
          }
          subtitleClassName="mt-1 text-sm text-text-secondary"
          meta={
            (isTruthyId(user.countryId) || isTruthyId(user.regionId)) && (
              <p className="text-xs text-text-muted mt-2">
                {t("adminCategoriesPage.labels.scope")}{" "}
                {isTruthyId(user.regionId)
                  ? t("adminCategoriesPage.labels.regionId", { id: user.regionId })
                  : t("adminCategoriesPage.labels.countryId", { id: user.countryId })}
              </p>
            )
          }
          actions={
            <>
              <button
                onClick={() => {
                  if (!canWrite) {
                    notify(t("adminCategoriesPage.errors.forbidden"));
                    return;
                  }
                  if (showForm) resetForm();
                  setShowForm((v) => !v);
                }}
                disabled={!canWrite}
                className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-sm transition ${
                  canWrite
                    ? "app-btn-neutral"
                    : "bg-surface-main/80 text-text-muted cursor-not-allowed"
                }`}
              >
                {showForm
                  ? t("adminCategoriesPage.buttons.hideForm")
                  : t("adminCategoriesPage.buttons.showForm")}
              </button>

              <button
                onClick={loadCategories}
                disabled={loading}
                className="app-btn-primary px-4 py-2 text-sm font-semibold rounded-xl shadow-sm"
              >
                {loading
                  ? t("adminCategoriesPage.loading")
                  : t("adminCategoriesPage.buttons.refresh")}
              </button>
            </>
          }
        />

 {/* Contexte: administration des categories. */}
        {errorMsg && (
          <div className="app-alert app-alert-error mb-6 flex gap-2 items-start">
            <span className="mt-[2px]">!</span>
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
              placeholder={t("adminCategoriesPage.searchPlaceholder")}
              className="app-input w-full pl-10 pr-3 bg-surface-main"
            />
          </div>
        </AdminPanelCard>

        {/* FORMULAIRE */}
        {showForm && (
          <AdminFormPanel
            onSubmit={handleSubmit}
            className="mb-10 animate-fadeIn"
          >
            {/* Nom */}
            <AdminField
              label={t("adminCategoriesPage.form.nameLabel")}
              labelClassName="text-sm font-medium text-text-primary"
            >
              <input
                type="text"
                placeholder={t("adminCategoriesPage.form.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={!canWrite}
                className={`app-input ${canWrite ? "" : "opacity-70"}`}
              />
            </AdminField>

            {/* Description */}
            <AdminField
              label={t("adminCategoriesPage.form.descriptionLabel")}
              labelClassName="text-sm font-medium text-text-primary"
            >
              <textarea
                placeholder={t("adminCategoriesPage.form.descriptionPlaceholder")}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                disabled={!canWrite}
                className={`app-input resize-y ${canWrite ? "" : "opacity-70"}`}
              ></textarea>
            </AdminField>

            {/* Actions */}
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
                  {t("adminCategoriesPage.buttons.cancel")}
                </button>
              )}

              <button
                type="submit"
                disabled={saving || !canWrite}
                className="app-btn-primary px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm"
              >
                {saving
                  ? t("adminCategoriesPage.buttons.saving")
                  : editing
                  ? t("adminCategoriesPage.buttons.update")
                  : t("adminCategoriesPage.buttons.create")}
              </button>
            </AdminActionsRow>
          </AdminFormPanel>
        )}

 {/* Contexte: administration des categories. */}
        {loading && categories.length === 0 ? (
          <p className="text-text-muted italic text-center py-8">
            {t("adminCategoriesPage.loadingCategories")}
          </p>
        ) : filteredCategories.length === 0 ? (
          <p className="text-text-muted italic text-center py-8">
            {t("adminCategoriesPage.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCategories.map((c) => (
              <div
                key={c.id}
                className="bg-surface-card border border-border rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-main hover:shadow-md transition"
              >
 {/* Contexte: administration des categories. */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-text-primary break-words">
                    {c.name}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1 break-words">
                    {c.description || t("adminCategoriesPage.table.emptyValue")}
                  </p>
                </div>

                {/* Actions */}
                <AdminRowActions
                  className="justify-end sm:flex-nowrap"
                  itemClassName="px-3 py-1.5 text-xs sm:text-sm rounded-xl shadow-sm"
                  actions={[
                    {
                      key: "edit-category",
                      label: t("adminCategoriesPage.table.edit"),
                      onClick: () => {
                        if (!canWrite) {
                          notify(t("adminCategoriesPage.errors.forbidden"));
                          return;
                        }
                        setForm({
                          name: c.name || "",
                          description: c.description || "",
                        });
                        setEditing(c);
                        setShowForm(true);
                      },
                      disabled: !canWrite,
                      buttonClassName: canWrite
                        ? "app-btn-warning"
                        : "app-btn-disabled-warning",
                    },
                    {
                      key: "delete-category",
                      label: t("adminCategoriesPage.table.delete"),
                      onClick: () => handleDelete(c.id),
                      disabled: !canWrite,
                      buttonClassName: canWrite
                        ? "app-btn-danger"
                        : "app-btn-disabled-danger",
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





