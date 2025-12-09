import { useEffect, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories";
import { me } from "../services/auth";

/*
============================================================================
📂 AdminCategoriesPage — Apple Light Premium A1
============================================================================
*/

export default function AdminCategoriesPage() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false); // 🔒 anti double-submit

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [search, setSearch] = useState("");

  /* ============================================================
     🔄 Initialisation
  ============================================================ */
  useEffect(() => {
    async function init() {
      try {
        const ud = await me();
        setUser(ud.user);
        await loadCategories();
      } catch (err) {
        console.error("❌ init AdminCategoriesPage:", err);
      }
    }
    init();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const cats = await getCategories();
      setCategories(cats || []);
    } catch (err) {
      console.error("❌ loadCategories:", err);
      alert("Erreur lors du chargement des catégories.");
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     🧹 Reset form
  ============================================================ */
  function resetForm() {
    setForm({ name: "", description: "" });
    setEditing(null);
  }

  /* ============================================================
     💾 Submit — avec verrou 'saving'
  ============================================================ */
  async function handleSubmit(e) {
    e.preventDefault();

    if (saving) return; // 🔒 empêche double-clic si la requête est en cours

    if (!form.name.trim()) {
      alert("Le nom est requis.");
      return;
    }

    try {
      setSaving(true);

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
      alert("Erreur lors de l'enregistrement de la catégorie.");
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     🗑 Suppression
  ============================================================ */
  async function handleDelete(id) {
    if (!window.confirm("Supprimer cette catégorie ?")) return;

    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error("❌ deleteCategory:", err);
      alert("Erreur lors de la suppression.");
    }
  }

  /* ============================================================
     🔎 Filtrage simple par nom
  ============================================================ */
  const filteredCategories = categories.filter((c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (c.name || "").toLowerCase().includes(term);
  });

  /* ============================================================
     🧱 UI LOADING GLOBAL (user)
  ============================================================ */
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  /* ============================================================
     🧱 RENDER PRINCIPAL
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
            <p className="text-sm text-slate-600 mt-1">
              Connecté en tant que{" "}
              <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (showForm) resetForm();
                setShowForm((v) => !v);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-xl shadow-sm bg-slate-900 text-white hover:bg-slate-800 transition"
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
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              ></textarea>
            </div>

            {/* Actions */}
            <div className="text-right mt-2">
              <button
                type="submit"
                disabled={saving}
                className={`px-5 py-2.5 text-sm font-semibold rounded-xl shadow-sm text-white transition
                  ${
                    saving
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
                      setForm({
                        name: c.name || "",
                        description: c.description || "",
                      });
                      setEditing(c);
                      setShowForm(true);
                    }}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition shadow-sm"
                  >
                    ✏️ Modifier
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
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
