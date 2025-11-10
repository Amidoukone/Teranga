// frontend/src/pages/ServiceTransactionsPage.js
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { me } from '../services/auth';
import { getTransactions, createTransaction } from '../services/transactions';
import api from '../services/api';

export default function ServiceTransactionsPage() {
  const { id } = useParams(); // serviceId
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    description: '',
    taskId: '',
    proofFile: null,
  });

  // 🔐 En-têtes d'auth stables (évite de recréer une fonction dans les deps)
  const authHeaders = useMemo(() => {
    const token =
      localStorage.getItem('teranga_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // 🔁 Charge les transactions du service (stable pour useEffect)
  const fetchTransactions = useCallback(async () => {
    try {
      const data = await getTransactions({ serviceId: id });
      setTransactions(data);
    } catch (err) {
      console.error('❌ Erreur fetchTransactions:', err);
      setTransactions([]);
    }
  }, [id]);

  // 🔁 Charge les tâches liées au service (stable pour useEffect)
  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/service/${id}`, {
        headers: authHeaders,
      });
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('❌ Erreur fetchTasks:', err);
      setTasks([]);
    }
  }, [id, authHeaders]);

  // 🚪 Initialisation + redirection si non auth
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const u = await me();
        if (!active) return;
        setUser(u.user);
        await Promise.all([fetchTransactions(), fetchTasks()]);
      } catch (err) {
        console.error('❌ Erreur init service transactions:', err);
        localStorage.removeItem('teranga_token');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [fetchTransactions, fetchTasks]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        serviceId: parseInt(id, 10),
        taskId: form.taskId ? parseInt(form.taskId, 10) : undefined,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description || undefined,
        proofFile: form.proofFile || null,
      };
      await createTransaction(payload);
      alert('✅ Transaction ajoutée');
      setForm({
        type: 'expense',
        amount: '',
        description: '',
        taskId: '',
        proofFile: null,
      });
      await fetchTransactions(); // ✅ rechargement propre
    } catch (err) {
      console.error('❌ Erreur ajout transaction:', err);
      alert("Erreur lors de l'ajout de la transaction");
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">
          Chargement des transactions…
        </p>
      </div>
    );

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-500 text-lg font-semibold">
          Utilisateur non authentifié.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 px-4 py-10">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
        {/* 🧭 En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            💼 Transactions du service #{id}
          </h1>

          <button
            onClick={() => navigate(`/services/${id}/tasks`)}
            className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition"
          >
            📋 Voir les tâches
          </button>
        </div>

        {/* ➕ Formulaire de création */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            ➕ Ajouter une transaction
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200"
          >
            {/* Type de transaction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de transaction
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="revenue">Revenu</option>
                <option value="expense">Dépense</option>
                <option value="commission">Commission</option>
                <option value="adjustment">Ajustement</option>
              </select>
            </div>

            {/* Montant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant (FCFA)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 15000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lier à une tâche */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lier à une tâche (optionnel)
              </label>
              <select
                value={form.taskId}
                onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucune tâche —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || `Tâche #${t.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                placeholder="Description ou détails de la transaction"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pièce jointe */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pièce justificative (JPG, PNG, PDF)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) =>
                  setForm({ ...form, proofFile: e.target.files?.[0] || null })
                }
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Bouton */}
            <div className="col-span-2 text-right">
              <button
                type="submit"
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition ${
                  loading
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {loading ? 'Ajout…' : 'Ajouter la transaction'}
              </button>
            </div>
          </form>
        </div>

        {/* 📜 Historique */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📜 Historique des transactions
        </h2>

        {transactions.length === 0 ? (
          <p className="text-gray-500 italic text-center py-6">
            Aucune transaction enregistrée pour ce service.
          </p>
        ) : (
          <div className="grid gap-6">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t.type.toUpperCase()} — {t.amount} {t.currency}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {t.description || 'Aucune description'}
                    </p>
                  </div>

                  <div className="mt-2 sm:mt-0 text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-700">
                  {t.task && (
                    <p>
                      🔧 <strong>Tâche :</strong> {t.task.title} (ID {t.task.id})
                    </p>
                  )}
                  {t.proofFile?.path && (
                    <p className="mt-1">
                      📎{' '}
                      <a
                        href={`http://localhost:5000${t.proofFile.path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Voir la pièce jointe
                      </a>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Enregistré par <strong>{t.user?.email}</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
