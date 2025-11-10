// frontend/src/pages/AdminCategoriesPage.jsx
import { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/categories';
import { me } from '../services/auth';

export default function AdminCategoriesPage() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    async function init() {
      try {
        const ud = await me();
        setUser(ud.user);
        await loadCategories();
      } catch (err) {
        console.error('❌ init AdminCategoriesPage:', err);
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
      console.error('❌ loadCategories:', err);
      alert('Erreur chargement catégories.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: '', description: '' });
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (!form.name) {
        alert('Nom requis.');
        return;
      }

      if (editing) {
        await updateCategory(editing.id, form);
        alert('✅ Catégorie mise à jour');
      } else {
        await createCategory(form);
        alert('✅ Catégorie ajoutée');
      }

      resetForm();
      await loadCategories();
    } catch (err) {
      console.error('❌ handleSubmit:', err);
      alert('Erreur sauvegarde catégorie.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      console.error('❌ deleteCategory:', err);
      alert('Erreur suppression catégorie.');
    }
  }

  if (!user)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-600 text-lg animate-pulse">Chargement…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📂 Gestion des catégories</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté en tant que <strong>{user.email}</strong> ({user.role})
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle catégorie'}
            </button>
            <button
              onClick={loadCategories}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                loading
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8"
          >
            <input
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Description (optionnelle)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-right">
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                {editing ? '💾 Mettre à jour' : '➕ Ajouter'}
              </button>
            </div>
          </form>
        )}

        {categories.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">Aucune catégorie trouvée.</p>
        ) : (
          <div className="grid gap-4">
            {categories.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:shadow-md transition flex justify-between items-start"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
                  <p className="text-sm text-gray-600">{c.description || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setForm(c);
                      setEditing(c);
                      setShowForm(true);
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
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
