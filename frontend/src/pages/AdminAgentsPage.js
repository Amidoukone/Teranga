import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

// Petite validation email basique
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminAgentsPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
  });

  const [errors, setErrors] = useState({});
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_admin_agents_showForm');
    return saved === null ? true : saved === '1';
  });

  const [filters, setFilters] = useState({
    q: '',
    country: '',
    onlyPhone: false,
    sort: '-createdAt',
  });

  // --- Validation ---
  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Prénom requis';
    if (!form.lastName.trim()) e.lastName = 'Nom requis';

    const email = form.email.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) e.email = 'Email invalide';

    if (!form.password || String(form.password).length < 6) {
      e.password = 'Mot de passe requis (6 caractères min.)';
    }

    const country = (form.country || '').trim().toUpperCase();
    if (!country || country.length !== 2) {
      e.country = 'Pays requis au format ISO2 (ex: ML, FR)';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(field, value) {
    if (field === 'country') {
      const v = (value || '').toUpperCase().slice(0, 2);
      setForm((prev) => ({ ...prev, country: v }));
      if (errors.country) setErrors((prev) => ({ ...prev, country: undefined }));
      return;
    }

    if (field === 'email') {
      const v = (value || '').toLowerCase();
      setForm((prev) => ({ ...prev, email: v }));
      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // --- Chargement des agents ---
  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const { data } = await api.get('/users?role=agent');
      setAgents(data.users || []);
    } catch (err) {
      console.error('❌ Erreur chargement agents:', err);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    localStorage.setItem('teranga_admin_agents_showForm', showForm ? '1' : '0');
  }, [showForm]);

  // --- Filtrage et tri ---
  useEffect(() => {
    let arr = [...agents];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((a) =>
        [a.firstName, a.lastName, a.email, a.phone, a.country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.country.trim()) {
      const c = filters.country.trim().toUpperCase();
      arr = arr.filter((a) => (a.country || '').toUpperCase() === c);
    }

    if (filters.onlyPhone) {
      arr = arr.filter((a) => !!a.phone);
    }

    const by = filters.sort || '-createdAt';
    arr.sort((a, b) => {
      const sign = by.startsWith('-') ? -1 : 1;
      const key = by.replace(/^-/, '');
      let va, vb;

      if (key === 'createdAt') {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else {
        va = (a[key] || '').toString().toLowerCase();
        vb = (b[key] || '').toString().toLowerCase();
      }

      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    setFiltered(arr);
  }, [agents, filters]);

  // --- Soumission du formulaire ---
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post('/users/agents', {
        email: form.email.trim().toLowerCase(),
        password: String(form.password),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country.trim().toUpperCase(),
      });

      alert('✅ Agent créé avec succès');
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        country: '',
      });
      setErrors({});
      await loadAgents();
    } catch (err) {
      console.error('❌ Erreur création agent:', err);
      const msg =
        err?.response?.data?.error || 'Erreur lors de la création de l’agent';
      alert(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* === En-tête === */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">👤 Gestion des Agents</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
            >
              {showForm ? '➖ Masquer le formulaire' : '➕ Ajouter un agent'}
            </button>

            <button
              onClick={loadAgents}
              disabled={loadingAgents}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition ${
                loadingAgents
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loadingAgents ? 'Chargement…' : '🔄 Rafraîchir'}
            </button>
          </div>
        </div>

        {/* === Filtres === */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Recherche
              </label>
              <input
                placeholder="Nom, email, téléphone…"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Pays (ISO2)
              </label>
              <input
                placeholder="Ex: SN, ML, FR"
                value={filters.country}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.onlyPhone}
                  onChange={(e) =>
                    setFilters({ ...filters, onlyPhone: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                Avec téléphone
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tri
              </label>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="-createdAt">Plus récents</option>
                <option value="createdAt">Plus anciens</option>
                <option value="firstName">Nom A→Z</option>
                <option value="-firstName">Nom Z→A</option>
                <option value="email">Email A→Z</option>
                <option value="-email">Email Z→A</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {filtered.length} agent(s) affiché(s)
            </div>
            <button
              onClick={() =>
                setFilters({ q: '', country: '', onlyPhone: false, sort: '-createdAt' })
              }
              className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* === Formulaire création === */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8"
          >
            <div>
              <input
                placeholder="Prénom *"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
              {errors.firstName && (
                <div className="text-red-600 text-xs mt-1">{errors.firstName}</div>
              )}
            </div>

            <div>
              <input
                placeholder="Nom *"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
              {errors.lastName && (
                <div className="text-red-600 text-xs mt-1">{errors.lastName}</div>
              )}
            </div>

            <div>
              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && (
                <div className="text-red-600 text-xs mt-1">{errors.email}</div>
              )}
            </div>

            <div>
              <input
                type="password"
                placeholder="Mot de passe (≥ 6) *"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && (
                <div className="text-red-600 text-xs mt-1">{errors.password}</div>
              )}
            </div>

            <input
              placeholder="Téléphone"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
            />

            <div>
              <input
                placeholder="Pays (ISO2, ex: ML, FR) *"
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                maxLength={2}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
              {errors.country && (
                <div className="text-red-600 text-xs mt-1">{errors.country}</div>
              )}
            </div>

            <div className="md:col-span-2 text-right">
              <button
                type="submit"
                disabled={loading}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
                  loading
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {loading ? 'Création...' : 'Créer Agent'}
              </button>
            </div>
          </form>
        )}

        {/* === Liste des agents === */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📋 Liste des agents existants
        </h2>

        {loadingAgents ? (
          <p className="text-gray-500 italic text-center py-6">
            Chargement des agents…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucun agent trouvé.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2 border-b">Nom</th>
                  <th className="text-left px-3 py-2 border-b">Email</th>
                  <th className="text-left px-3 py-2 border-b">Téléphone</th>
                  <th className="text-left px-3 py-2 border-b">Pays</th>
                  <th className="text-left px-3 py-2 border-b">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {[a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-3 py-2">{a.email}</td>
                    <td className="px-3 py-2">{a.phone || '—'}</td>
                    <td className="px-3 py-2">{a.country || '—'}</td>
                    <td className="px-3 py-2">
                      {new Date(a.createdAt).toLocaleDateString()}
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
