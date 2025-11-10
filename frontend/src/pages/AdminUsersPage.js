import { useEffect, useState, useCallback } from 'react'; // ✅ suppression de useMemo inutilisé
import { getUsers, createUser, updateUser, deleteUser } from '../services/users';
import { me } from '../services/auth';

export default function AdminUsersPage() {
  const [role, setRole] = useState('client'); // filtre "source" (déjà existant)
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]); // 🆕 liste filtrée pour l’affichage
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_admin_users_showForm');
    return saved === null ? true : saved === '1';
  }); // 🆕 affichage formulaire mémorisé

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', country: '', role: 'client'
  });
  const [editing, setEditing] = useState(null);

  // 🆕 filtres côté UI
  const [filters, setFilters] = useState({
    q: '',
    country: '',
    onlyPhone: false,
    sort: '-createdAt', // -createdAt (récent -> ancien), createdAt, firstName, email, role
  });

  // ✅ Utilise useCallback pour stabiliser la fonction (évite les warnings)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(role);
      setUsers(data || []);
    } catch (err) {
      console.error('❌ Erreur chargement utilisateurs:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  // ✅ Vérification de rôle + chargement initial
  useEffect(() => {
    async function check() {
      const { user } = await me();
      if (user.role !== 'admin') window.location.href = '/dashboard';
    }
    check();
    load();
  }, [load]);

  // 🧠 Mémoriser l’état d’affichage du formulaire
  useEffect(() => {
    localStorage.setItem('teranga_admin_users_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // 🔍 Application des filtres et du tri côté client
  useEffect(() => {
    let arr = [...users];

    // Recherche texte (nom, email, téléphone, pays, rôle)
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((u) =>
        [
          u.firstName,
          u.lastName,
          u.email,
          u.phone,
          u.country,
          u.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    // Filtre pays (ISO2, champ libre)
    if (filters.country.trim()) {
      const c = filters.country.trim().toUpperCase();
      arr = arr.filter((u) => (u.country || '').toUpperCase() === c);
    }

    // Filtre “avec téléphone”
    if (filters.onlyPhone) {
      arr = arr.filter((u) => !!u.phone);
    }

    // Tri
    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va, vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else if (key === 'firstName' || key === 'email' || key === 'role' || key === 'country') {
        va = (a[key] || '').toString().toLowerCase();
        vb = (b[key] || '').toString().toLowerCase();
      } else {
        va = a[key];
        vb = b[key];
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [users, filters]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await updateUser(editing, form);
        alert('✅ Utilisateur mis à jour');
      } else {
        await createUser(form);
        alert('✅ Utilisateur créé');
      }
      resetForm();
      await load();
    } catch (err) {
      console.error('❌ Erreur soumission:', err);
      alert('Erreur lors de la soumission du formulaire.');
    }
  }

  function resetForm() {
    setEditing(null);
    setForm({ firstName: '', lastName: '', email: '', password: '', phone: '', country: '', role });
  }

  function handleEdit(u) {
    setEditing(u.id);
    setShowForm(true); // si on édite, on affiche le formulaire
    setForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phone: u.phone || '',
      country: (u.country || '').toUpperCase().slice(0, 2),
      role: u.role,
      password: ''
    });
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await deleteUser(id);
      alert('✅ Utilisateur supprimé');
      await load();
    } catch (err) {
      console.error('❌ Erreur suppression:', err);
      alert('Erreur lors de la suppression.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">👥 Gestion des utilisateurs</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Créer un utilisateur'}
            </button>

            <button
              onClick={load}
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

        {/* 🎛️ Filtres haut de page */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Filtre “source de rôle” (déjà existant) */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Catégorie
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="client">Clients</option>
                <option value="agent">Agents</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Recherche globale */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Recherche
              </label>
              <input
                placeholder="Nom, email, téléphone, rôle…"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pays */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Pays (ISO2)
              </label>
              <input
                placeholder="Ex: SN, ML, FR"
                value={filters.country}
                onChange={(e) =>
                  setFilters({ ...filters, country: e.target.value.toUpperCase().slice(0, 2) })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* With phone */}
            <div className="flex items-end lg:col-span-1">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.onlyPhone}
                  onChange={(e) => setFilters({ ...filters, onlyPhone: e.target.checked })}
                  className="h-4 w-4"
                />
                Avec téléphone
              </label>
            </div>

            {/* Tri */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tri
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="firstName">Prénom A→Z</option>
                <option value="-firstName">Prénom Z→A</option>
                <option value="email">Email A→Z</option>
                <option value="-email">Email Z→A</option>
                <option value="role">Rôle A→Z</option>
                <option value="-role">Rôle Z→A</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {filtered.length} utilisateur(s) affiché(s)
            </div>
            <button
              onClick={() =>
                setFilters({ q: '', country: '', onlyPhone: false, sort: '-createdAt' })
              }
              className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {/* 🧾 Formulaire création / édition (affichable) */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8"
          >
            <input
              placeholder="Prénom"
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Nom"
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 md:col-span-2"
            />
            <input
              type="password"
              placeholder="Mot de passe (laisser vide si inchangé)"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 md:col-span-2"
            />
            <input
              placeholder="Téléphone"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Pays (ISO2)"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 md:col-span-2"
            >
              <option value="client">Client</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>

            <div className="md:col-span-2 flex gap-2 justify-end">
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-300 hover:bg-gray-400 transition"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
              >
                {editing ? '💾 Mettre à jour' : '➕ Créer utilisateur'}
              </button>
            </div>
          </form>
        )}

        {/* 📋 Liste */}
        {loading ? (
          <p className="text-gray-500 italic text-center py-6">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2 border-b">Nom</th>
                  <th className="text-left px-3 py-2 border-b">Email</th>
                  <th className="text-left px-3 py-2 border-b">Téléphone</th>
                  <th className="text-left px-3 py-2 border-b">Pays</th>
                  <th className="text-left px-3 py-2 border-b">Rôle</th>
                  <th className="text-left px-3 py-2 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.phone || '—'}</td>
                    <td className="px-3 py-2">{u.country || '—'}</td>
                    <td className="px-3 py-2 uppercase">{u.role}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleEdit(u)}
                        className="text-yellow-700 hover:text-yellow-900 mr-2"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-gray-500">
              {filtered.length} résultat(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
