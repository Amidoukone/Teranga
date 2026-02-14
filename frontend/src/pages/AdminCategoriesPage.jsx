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
import { isGlobalAdminUser, isMasterUser } from "../utils/role";

/*
============================================================================
📂 AdminCategoriesPage — Apple Light Premium A1 (Multi-pays + MASTER safe)
============================================================================
✅ Objectif:
- Garder 100% des fonctionnalités existantes (CRUD + recherche + anti double-submit)
- Ajouter une compatibilité "master" multi-pays sans casser la prod
  - master explicite: user.role === "master"
  - master implicite: user.role === "admin" + (countryId/regionId) => admin scoped
- Ne rien imposer au backend (on reste rétro-compatible)
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
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false); // 🔒 anti double-submit

  // ✅ Ajout: état d'erreur UI (n'enlève rien, remplace juste certains alert)
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [search, setSearch] = useState("");

  // ✅ Flags: n’impacte pas le fonctionnement, juste l’UX/affichage
  const isMaster = useMemo(() => computeIsMaster(user), [user]);
  const canWrite = useMemo(() => isGlobalAdminUser(user), [user]);

  /* ============================================================
     🔄 Initialisation (inchangé fonctionnellement)
  ============================================================ */
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ud = await me();
        if (!mounted) return;
        setUser(ud.user);
        await loadCategories();
      } catch (err) {
        console.error("❌ init AdminCategoriesPage:", err);
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
      console.error("❌ loadCategories:", err);
      setErrorMsg(t("adminCategoriesPage.errors.load"));
      alert(t("adminCategoriesPage.errors.load"));
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     🧹 Reset form (inchangé)
  ============================================================ */
  function resetForm() {
    setForm({ name: "", description: "" });
    setEditing(null);
  }

  /* ============================================================
     💾 Submit — avec verrou 'saving' (inchangé + guard write)
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!canWrite) {
      alert(t("adminCategoriesPage.errors.forbidden"));
      return;
    }

    if (saving) return; // 🔒 empêche double-clic si la requête est en cours

    if (!form.name.trim()) {
      alert(t("adminCategoriesPage.errors.nameRequired"));
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      if (editing) {
        await updateCategory(editing.id, form);
        alert(t("adminCategoriesPage.alerts.updated"));
      } else {
        await createCategory(form);
        alert(t("adminCategoriesPage.alerts.created"));
      }

      resetForm();
      await loadCategories();
      setShowForm(false);
    } catch (err) {
      console.error("❌ handleSubmit:", err);
      setErrorMsg(t("adminCategoriesPage.errors.save"));
      alert(t("adminCategoriesPage.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     🗑 Suppression (inchangé + guard write)
  ============================================================ */
  async function handleDelete(id) {
    if (!canWrite) {
      alert(t("adminCategoriesPage.errors.forbidden"));
      return;
    }

    if (!window.confirm(t("adminCategoriesPage.alerts.deleteConfirm"))) return;

    try {
      setErrorMsg("");
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error("❌ deleteCategory:", err);
      setErrorMsg(t("adminCategoriesPage.errors.delete"));
      alert(t("adminCategoriesPage.errors.delete"));
    }
  }

  /* ============================================================
     🔎 Filtrage simple par nom (inchangé)
  ============================================================ */
  const filteredCategories = categories.filter((c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (c.name || "").toLowerCase().includes(term);
  });

  /* ============================================================
     🧱 UI LOADING GLOBAL (user) (inchangé)
  ============================================================ */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">
          {t("adminCategoriesPage.loading")}
        </p>
      </div>
    );
  }

  // ============================== PARTIE 2 / 2 ==============================
// ============================== PARTIE 2 / 2 ==============================
// (suite) frontend/src/pages/AdminCategoriesPage.jsx

  /* ============================================================
     🧱 RENDER PRINCIPAL (conserve toute la structure + ajoute badges/guards)
  ============================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/40 to-white px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-lg shadow-slate-200/40 rounded-3xl p-8 border border-slate-200">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              📂 <span>{t("adminCategoriesPage.title")}</span>
            </h1>

            <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-2">
              <span>
                {t("adminCategoriesPage.labels.connectedAs", {
                  email: user.email,
                  role: user.role,
                })}
              </span>

              {/* ✅ Badge master/admin scoped (n'impacte pas les fonctions) */}
              {isMaster && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  {t("adminCategoriesPage.badges.master")}
                </span>
              )}

              {/* ✅ Lecture seule si pas admin/master */}
              {!canWrite && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                  {t("adminCategoriesPage.badges.readOnly")}
                </span>
              )}
            </p>

            {/* ✅ Optionnel: info scope si présent (safe) */}
            {(isTruthyId(user.countryId) || isTruthyId(user.regionId)) && (
              <p className="text-xs text-slate-500 mt-2">
                {t("adminCategoriesPage.labels.scope")}{" "}
                {isTruthyId(user.regionId)
                  ? t("adminCategoriesPage.labels.regionId", { id: user.regionId })
                  : t("adminCategoriesPage.labels.countryId", { id: user.countryId })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (!canWrite) {
                  alert(t("adminCategoriesPage.errors.forbidden"));
                  return;
                }
                if (showForm) resetForm();
                setShowForm((v) => !v);
              }}
              disabled={!canWrite}
              className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-sm transition ${
                canWrite
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {showForm
                ? t("adminCategoriesPage.buttons.hideForm")
                : t("adminCategoriesPage.buttons.showForm")}
            </button>

            <button
              onClick={loadCategories}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-sm text-white transition ${
                loading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {loading
                ? t("adminCategoriesPage.loading")
                : t("adminCategoriesPage.buttons.refresh")}
            </button>
          </div>
        </div>

        {/* ✅ Message d’erreur (nouveau, sans enlever les alert existants) */}
        {errorMsg && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex gap-2 items-start">
            <span className="mt-[2px]">⚠️</span>
            <p className="break-words">{errorMsg}</p>
          </div>
        )}

        {/* BARRE DE RECHERCHE */}
        <div className="mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminCategoriesPage.searchPlaceholder")}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* FORMULAIRE */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 grid grid-cols-1 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn"
          >
            {/* Nom */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-800">
                {t("adminCategoriesPage.form.nameLabel")}
              </label>
              <input
                type="text"
                placeholder={t("adminCategoriesPage.form.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={!canWrite}
                className={`w-full border rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  canWrite ? "border-slate-300" : "border-slate-200 opacity-70"
                }`}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-800">
                {t("adminCategoriesPage.form.descriptionLabel")}
              </label>
              <textarea
                placeholder={t("adminCategoriesPage.form.descriptionPlaceholder")}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                disabled={!canWrite}
                className={`w-full border rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                  canWrite ? "border-slate-300" : "border-slate-200 opacity-70"
                }`}
              ></textarea>
            </div>

            {/* Actions */}
            <div className="text-right mt-2 flex flex-wrap justify-end gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                >
                  {t("adminCategoriesPage.buttons.cancel")}
                </button>
              )}

              <button
                type="submit"
                disabled={saving || !canWrite}
                className={`px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm text-white transition
                  ${
                    saving || !canWrite
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                  }`}
              >
                {saving
                  ? t("adminCategoriesPage.buttons.saving")
                  : editing
                  ? t("adminCategoriesPage.buttons.update")
                  : t("adminCategoriesPage.buttons.create")}
              </button>
            </div>
          </form>
        )}

        {/* LISTE DES CATÉGORIES */}
        {loading && categories.length === 0 ? (
          <p className="text-slate-500 italic text-center py-8">
            {t("adminCategoriesPage.loadingCategories")}
          </p>
        ) : filteredCategories.length === 0 ? (
          <p className="text-slate-500 italic text-center py-8">
            {t("adminCategoriesPage.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCategories.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 hover:shadow-md transition"
              >
                {/* Infos catégorie */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                    {c.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 break-words">
                    {c.description || t("adminCategoriesPage.table.emptyValue")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:flex-nowrap justify-end">
                  <button
                    onClick={() => {
                      if (!canWrite) {
                        alert(t("adminCategoriesPage.errors.forbidden"));
                        return;
                      }
                      setForm({
                        name: c.name || "",
                        description: c.description || "",
                      });
                      setEditing(c);
                      setShowForm(true);
                    }}
                    disabled={!canWrite}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl transition shadow-sm ${
                      canWrite
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "bg-amber-200 text-amber-700 cursor-not-allowed"
                    }`}
                  >
                    {t("adminCategoriesPage.table.edit")}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={!canWrite}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl transition shadow-sm ${
                      canWrite
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-red-200 text-red-700 cursor-not-allowed"
                    }`}
                  >
                    {t("adminCategoriesPage.table.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
