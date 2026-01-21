// ============================== PARTIE 1 / 2 ==============================
// frontend/src/pages/AdminCategoriesPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories";
import { me } from "../services/auth";

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

  // Admin scoped (master implicite) : admin + scope geo
  if (
    user.role === "admin" &&
    (isTruthyId(user.countryId) || isTruthyId(user.regionId))
  ) {
    return true;
  }

  return false;
}

function computeCanWrite(user) {
  if (!user) return false;
  // On conserve la logique actuelle: seuls admin/master peuvent écrire
  return user.role === "admin" || user.role === "master";
}

export default function AdminCategoriesPage() {
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
  const canWrite = useMemo(() => computeCanWrite(user), [user]);

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
        setErrorMsg("Erreur lors du chargement de la session.");
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
      setErrorMsg("Erreur lors du chargement des catégories.");
      alert("Erreur lors du chargement des catégories.");
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
      alert("Accès interdit.");
      return;
    }

    if (saving) return; // 🔒 empêche double-clic si la requête est en cours

    if (!form.name.trim()) {
      alert("Le nom est requis.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      if (editing) {
        await updateCategory(editing.id, form);
        alert("✅ Catégorie mise à jour.");
      } else {
        await createCategory(form);
        alert("✅ Catégorie ajoutée.");
      }

      resetForm();
      await loadCategories();
      setShowForm(false);
    } catch (err) {
      console.error("❌ handleSubmit:", err);
      setErrorMsg("Erreur lors de l'enregistrement de la catégorie.");
      alert("Erreur lors de l'enregistrement de la catégorie.");
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     🗑 Suppression (inchangé + guard write)
  ============================================================ */
  async function handleDelete(id) {
    if (!canWrite) {
      alert("Accès interdit.");
      return;
    }

    if (!window.confirm("Supprimer cette catégorie ?")) return;

    try {
      setErrorMsg("");
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error("❌ deleteCategory:", err);
      setErrorMsg("Erreur lors de la suppression.");
      alert("Erreur lors de la suppression.");
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
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
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
              📂 <span>Gestion des catégories</span>
            </h1>

            <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Connecté en tant que <strong>{user.email}</strong> ({user.role})
              </span>

              {/* ✅ Badge master/admin scoped (n'impacte pas les fonctions) */}
              {isMaster && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  MASTER
                </span>
              )}

              {/* ✅ Lecture seule si pas admin/master */}
              {!canWrite && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                  🔒 Lecture seule
                </span>
              )}
            </p>

            {/* ✅ Optionnel: info scope si présent (safe) */}
            {(isTruthyId(user.countryId) || isTruthyId(user.regionId)) && (
              <p className="text-xs text-slate-500 mt-2">
                Scope :{" "}
                {isTruthyId(user.regionId)
                  ? `Région #${user.regionId}`
                  : `Pays #${user.countryId}`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (!canWrite) {
                  alert("Accès interdit.");
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
              {showForm ? "➖ Masquer le formulaire" : "➕ Nouvelle catégorie"}
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
              {loading ? "Chargement…" : "🔄 Rafraîchir"}
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
              placeholder="Rechercher une catégorie par nom…"
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
                Nom de la catégorie *
              </label>
              <input
                type="text"
                placeholder="Ex : Informatique"
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
                Description (optionnelle)
              </label>
              <textarea
                placeholder="Description de la catégorie…"
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
                  Annuler
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
                  ? "Enregistrement…"
                  : editing
                  ? "💾 Mettre à jour"
                  : "➕ Ajouter"}
              </button>
            </div>
          </form>
        )}

        {/* LISTE DES CATÉGORIES */}
        {loading && categories.length === 0 ? (
          <p className="text-slate-500 italic text-center py-8">
            Chargement des catégories…
          </p>
        ) : filteredCategories.length === 0 ? (
          <p className="text-slate-500 italic text-center py-8">
            Aucune catégorie trouvée.
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
                    {c.description || "—"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:flex-nowrap justify-end">
                  <button
                    onClick={() => {
                      if (!canWrite) {
                        alert("Accès interdit.");
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
                    ✏️ Modifier
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
                    🗑 Supprimer
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
