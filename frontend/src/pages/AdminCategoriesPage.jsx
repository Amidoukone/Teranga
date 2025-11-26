// frontend/src/pages/AdminCategoriesPage.jsx
import { useEffect, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories";
import { me } from "../services/auth";

/* ============================================================
   📂 PAGE ADMIN — CATÉGORIES
   Version Premium + Responsive + UX Améliorée
   - Animations douces
   - Boutons plus accessibles
   - Formulaire modernisé
   - Design cohérent Teranga PRO
   - Aucune fonctionnalité supprimée
============================================================ */

export default function AdminCategoriesPage() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  /* ============================================================
     🔄 Initialisation
  ============================================================= */
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
  ============================================================= */
  function resetForm() {
    setForm({ name: "", description: "" });
    setEditing(null);
  }

  /* ============================================================
     💾 Submit
  ============================================================= */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Le nom est requis.");
      return;
    }

    try {
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
    }
  }

  /* ============================================================
     🗑 Suppression
  ============================================================= */
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
     🧱 UI LOADING
  ============================================================= */
  if (!user)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  /* ============================================================
     🧱 RENDER PRINCIPAL
  ============================================================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
              📂 <span>Gestion des catégories</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (showForm) resetForm();
                setShowForm((v) => !v);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? "➖ Masquer le formulaire" : "➕ Nouvelle catégorie"}
            </button>

            <button
              onClick={loadCategories}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${
                loading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {loading ? "Chargement…" : "🔄 Rafraîchir"}
            </button>
          </div>
        </div>

        {/* FORMULAIRE */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 grid grid-cols-1 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm animate-fadeIn"
          >
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Nom de la catégorie *
              </label>
              <input
                type="text"
                placeholder="Ex : Informatique"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2
                           focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Description (optionnelle)
              </label>
              <textarea
                placeholder="Description de la catégorie…"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2
                           focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            {/* Actions */}
            <div className="text-right">
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                {editing ? "💾 Mettre à jour" : "➕ Ajouter"}
              </button>
            </div>
          </form>
        )}

        {/* LISTE DES CATÉGORIES */}
        {categories.length === 0 ? (
          <p className="text-gray-500 italic text-center py-8">
            Aucune catégorie trouvée.
          </p>
        ) : (
          <div className="grid gap-4">
            {categories.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition"
              >
                {/* Informations */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 break-words">
                    {c.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 break-words">
                    {c.description || "—"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <button
                    onClick={() => {
                      setForm({
                        name: c.name || "",
                        description: c.description || "",
                      });
                      setEditing(c);
                      setShowForm(true);
                    }}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition shadow-sm"
                  >
                    ✏️ Modifier
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
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
