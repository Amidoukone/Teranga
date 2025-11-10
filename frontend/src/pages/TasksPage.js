// frontend/src/pages/TasksPage.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { me } from '../services/auth';
import { getMyServices } from '../services/services';
import {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  applyLabels,
} from '../utils/labels';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(() => {
    const saved = localStorage.getItem('teranga_tasks_showForm');
    return saved === null ? true : saved === '1';
  });

  const navigate = useNavigate();

  const [form, setForm] = useState({
    serviceId: '',
    title: '',
    type: 'other',
    description: '',
    priority: 'normal',
    dueDate: '',
    estimatedCost: '',
    assignedTo: '',
  });

  const [filters, setFilters] = useState({
    q: '',
    type: '',
    status: '',
    priority: '',
    service: '',
    agent: '',
  });

  const authHeader = useMemo(() => {
    const token =
      localStorage.getItem('token') || localStorage.getItem('teranga_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* =========================================================
     🔁 Charger toutes les tâches
  ========================================================= */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tasks', { headers: authHeader });
      const enriched = (data.tasks || []).map((t) => ({
        ...t,
        ...(t.statusLabel ? {} : applyLabels(t)),
      }));
      setTasks(enriched);
    } catch (err) {
      console.error('❌ Erreur chargement tâches:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  /* =========================================================
     🔁 Initialisation
  ========================================================= */
  useEffect(() => {
    async function init() {
      const u = await me();
      setUser(u.user);

      if (u.user.role === 'client') {
        const servs = await getMyServices();
        setServices(servs || []);
      } else if (u.user.role === 'admin') {
        try {
          const [{ data: allServices }, { data: agentsRes }] = await Promise.all([
            api.get('/services', { headers: authHeader }),
            api.get('/users', { params: { role: 'agent' }, headers: authHeader }),
          ]);
          const enrichedServices = (allServices?.services || []).map((s) => ({
            ...s,
            ...(s.typeLabel ? {} : applyLabels(s)),
          }));
          setServices(enrichedServices);
          setAgents(agentsRes?.users || []);
        } catch (err) {
          console.error('❌ Erreur chargement services/agents (admin):', err);
        }
      }

      await loadTasks();
    }
    init();
  }, [loadTasks, authHeader]);

  useEffect(() => {
    localStorage.setItem('teranga_tasks_showForm', showForm ? '1' : '0');
  }, [showForm]);

  /* =========================================================
     ➕ Création
  ========================================================= */
  async function createTask(e) {
    e.preventDefault();
    try {
      const payload = {
        serviceId: form.serviceId ? parseInt(form.serviceId, 10) : null,
        title: form.title.trim(),
        type: form.type,
        description: form.description?.trim() || null,
        priority: form.priority || 'normal',
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        estimatedCost:
          form.estimatedCost === '' ? null : parseFloat(form.estimatedCost),
        assignedTo: form.assignedTo ? parseInt(form.assignedTo, 10) : null,
      };

      await api.post('/tasks', payload, { headers: authHeader });

      alert('✅ Tâche créée avec succès');
      setForm({
        serviceId: '',
        title: '',
        type: 'other',
        description: '',
        priority: 'normal',
        dueDate: '',
        estimatedCost: '',
        assignedTo: '',
      });

      await loadTasks();
    } catch (err) {
      console.error('❌ Erreur création tâche:', err);
      alert('Erreur lors de la création de la tâche ❌');
    }
  }

  /* =========================================================
     🔄 Statuts / Assignation
  ========================================================= */
  async function updateStatus(id, status) {
    try {
      await api.put(`/tasks/${id}/status`, { status }, { headers: authHeader });
      await loadTasks();
    } catch (err) {
      console.error('❌ Erreur maj statut:', err);
      alert("Erreur lors de la mise à jour du statut ❌");
    }
  }

  async function updateAssignment(taskId, agentId) {
    if (!agentId) return;
    try {
      await api.put(
        `/tasks/${taskId}/assign`,
        { agentId },
        { headers: authHeader }
      );
      alert('✅ Tâche assignée avec succès.');
      await loadTasks();
    } catch (err) {
      console.error('❌ Erreur assignation tâche:', err);
      alert("Erreur lors de l'assignation de la tâche.");
    }
  }

  function displayUser(u) {
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  /* =========================================================
     🔍 Filtrage local
  ========================================================= */
  useEffect(() => {
    let arr = [...tasks];

    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter((t) =>
        [
          t.title,
          t.description,
          t.typeLabel,
          t.priorityLabel,
          t.statusLabel,
          t.service?.title,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (filters.type) arr = arr.filter((t) => t.type === filters.type);
    if (filters.status) arr = arr.filter((t) => t.status === filters.status);
    if (filters.priority) arr = arr.filter((t) => t.priority === filters.priority);
    if (filters.service)
      arr = arr.filter((t) => t.service?.id === parseInt(filters.service, 10));
    if (filters.agent)
      arr = arr.filter((t) => t.assignee?.id === parseInt(filters.agent, 10));

    setFiltered(arr);
  }, [filters, tasks]);

  /* =========================================================
     🧭 UI
  ========================================================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        <Header
          showForm={showForm}
          setShowForm={setShowForm}
          loadTasks={loadTasks}
          loading={loading}
        />

        <TaskFilters
          filters={filters}
          setFilters={setFilters}
          services={services}
          agents={agents}
          user={user}
          filteredCount={filtered.length}
        />

        {showForm && (user?.role === 'client' || user?.role === 'admin') && (
          <TaskForm
            form={form}
            setForm={setForm}
            services={services}
            agents={agents}
            user={user}
            createTask={createTask}
          />
        )}

        <TaskList
          tasks={filtered}
          user={user}
          updateStatus={updateStatus}
          updateAssignment={updateAssignment}
          navigate={navigate}
          displayUser={displayUser}
          agents={agents}
        />
      </div>
    </div>
  );
}

/* ============================================================
   🧩 SOUS-COMPOSANTS (inchangés et fonctionnels)
============================================================ */
function Header({ showForm, setShowForm, loadTasks, loading }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📋 Gestion des Tâches</h1>
        <p className="text-sm text-gray-500">Créez, assignez et suivez vos tâches.</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-slate-800 text-white hover:bg-slate-900 transition"
        >
          {showForm ? '➖ Masquer le formulaire' : '➕ Nouvelle tâche'}
        </button>
        <button
          onClick={loadTasks}
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
  );
}


function TaskFilters({ filters, setFilters, services, agents, user, filteredCount }) {
  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <input
          placeholder="🔎 Rechercher une tâche"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 col-span-2"
        />

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Type (tous)</option>
          {Object.entries(TASK_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Statut (tous)</option>
          {Object.entries(TASK_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Priorité (toutes)</option>
          {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.service}
          onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Service (tous)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.typeLabel || s.type}
            </option>
          ))}
        </select>

        {user?.role === 'admin' && (
          <select
            value={filters.agent}
            onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Agent (tous)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">{filteredCount} tâche(s)</div>
        <button
          onClick={() =>
            setFilters({
              q: '',
              type: '',
              status: '',
              priority: '',
              service: '',
              agent: '',
            })
          }
          className="text-xs px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 font-medium transition"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

function TaskForm({ form, setForm, services, agents, user, createTask }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">➕ Créer une tâche</h2>
      <form
        onSubmit={createTask}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
      >
        <select
          value={form.serviceId}
          onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Choisir un service —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.typeLabel || s.type})
            </option>
          ))}
        </select>

        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(TASK_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          placeholder="Titre de la tâche *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(TASK_PRIORITIES).map(([key, label]) => (
            <option key={key} value={key}>
              Priorité : {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="number"
          step="0.01"
          placeholder="Coût estimé"
          value={form.estimatedCost}
          onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />

        {user?.role === 'admin' && (
          <select
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Assigné à (optionnel) —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName || a.lastName
                  ? `${a.firstName || ''} ${a.lastName || ''}`.trim()
                  : a.email}
              </option>
            ))}
          </select>
        )}

        <div className="col-span-2 text-right">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition"
          >
            Créer tâche
          </button>
        </div>
      </form>
    </div>
  );
}

function TaskList({ tasks, user, updateStatus, updateAssignment, navigate, displayUser, agents }) {
  return (
    <div className="grid gap-5">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{t.description || 'Aucune description'}</p>
            </div>
            <div
              className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold ${
                t.status === 'created'
                  ? 'bg-gray-100 text-gray-700'
                  : t.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : t.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {t.statusLabel || TASK_STATUSES[t.status] || t.status}
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <p>
              <strong>Type :</strong> {t.typeLabel || TASK_TYPES[t.type] || t.type}
            </p>
            <p>
              <strong>Priorité :</strong> {t.priorityLabel || TASK_PRIORITIES[t.priority] || t.priority}
            </p>
            <p>
              <strong>Service :</strong> {t.service?.title || t.serviceId}
            </p>
            <p>
              <strong>Assigné à :</strong> {displayUser(t.assignee)}
            </p>
          </div>

          {/* 🧭 Actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`/tasks/${t.id}/evidences`)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              📎 Voir preuves
            </button>

            {user?.role === 'admin' && !t.assignee && t.status === 'created' && (
              <select
                onChange={(e) => updateAssignment(t.id, e.target.value)}
                defaultValue=""
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Assigner à un agent —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </select>
            )}

            {user?.role === 'agent' && t.status === 'created' && (
              <button
                onClick={() => updateStatus(t.id, 'in_progress')}
                className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 transition"
              >
                ▶️ Démarrer
              </button>
            )}
            {user?.role === 'agent' && t.status === 'in_progress' && (
              <button
                onClick={() => updateStatus(t.id, 'completed')}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
              >
                ✅ Terminer
              </button>
            )}
            {user?.role === 'admin' && t.status === 'completed' && (
              <button
                onClick={() => updateStatus(t.id, 'validated')}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
              >
                ✔️ Valider
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
