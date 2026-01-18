// frontend/src/services/tasks.js
import api from './api';
import { applyLabels } from '../utils/labels';
import { mergeGeoParams, mergeGeoPayload } from './geo';

/**
 * ============================================================
 * 🧰 Service : Gestion des Tâches Teranga (Frontend)
 * ============================================================
 * - Compatible avec la structure backend (/api/tasks)
 * - Utilise applyLabels() pour afficher les labels FR
 * - Gère toutes les opérations : CRUD, statut, assignation
 * ============================================================
 */

/**
 * 📋 Liste toutes les tâches visibles par l’utilisateur connecté
 * (admin → toutes, agent → assignées, client → liées à ses services/propriétés)
 */
export async function getTasks() {
  const { data } = await api.get('/tasks', { params: mergeGeoParams() });
  const tasks = data?.tasks || [];
  return tasks.map((t) => applyLabels(t));
}

/**
 * 📋 Liste les tâches liées à un service spécifique
 * @param {number|string} serviceId
 */
export async function getTasksByService(serviceId) {
  if (!serviceId) return [];
  const { data } = await api.get(`/tasks/service/${serviceId}`);
  const tasks = data?.tasks || [];
  return tasks.map((t) => applyLabels(t));
}

/**
 * ➕ Créer une tâche
 * @param {object} form - Données du formulaire
 */
export async function createTask(form) {
  const payload = mergeGeoPayload({
    ...form,
    serviceId:
      form?.serviceId && form.serviceId !== ''
        ? parseInt(form.serviceId, 10)
        : null,
    assignedTo:
      form?.assignedTo && form.assignedTo !== ''
        ? parseInt(form.assignedTo, 10)
        : null,
    estimatedCost:
      form?.estimatedCost === '' || form?.estimatedCost === undefined
        ? null
        : parseFloat(form.estimatedCost),
    dueDate: form?.dueDate ? new Date(form.dueDate) : null,
  });

  const { data } = await api.post('/tasks', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return applyLabels(data.task);
}

/**
 * 🔄 Mettre à jour le statut d’une tâche
 * (agent → in_progress, completed / admin → validated)
 * @param {number} id - ID de la tâche
 * @param {string} status - Nouveau statut
 */
export async function updateTaskStatus(id, status) {
  if (!id || !status) throw new Error('ID ou statut manquant.');
  const { data } = await api.put(`/tasks/${id}/status`, { status });
  return applyLabels(data.task);
}

/**
 * 👔 Assigner une tâche à un agent (admin uniquement)
 * @param {number} taskId - ID de la tâche
 * @param {number} agentId - ID de l’agent
 */
export async function assignTaskAgent(taskId, agentId) {
  if (!taskId || !agentId) throw new Error('taskId et agentId requis.');
  const { data } = await api.put(`/tasks/${taskId}/assign`, { agentId });
  return applyLabels(data.task);
}

/**
 * 🧾 Supprimer une tâche (facultatif - si futur besoin)
 * @param {number} id - ID de la tâche
 */
export async function deleteTask(id) {
  if (!id) return;
  const { data } = await api.delete(`/tasks/${id}`);
  return data;
}

/**
 * 📦 Export global des fonctions
 */
const TasksService = {
  getTasks,
  getTasksByService,
  createTask,
  updateTaskStatus,
  assignTaskAgent,
  deleteTask,
};

export default TasksService;
