// frontend/src/services/projects.js
import api from './api';
import { applyLabels } from '../utils/labels';
import { mergeGeoParams, mergeGeoPayload } from './geo';

/**
 * ============================================================
 * 🚀 Service Frontend : Gestion des Projets (CRUD complet)
 * - Aligne avec le backend (regle des 1h, assignation agent, phases, documents)
 * - Upload de documents : supporte phaseId, title, kind, notes
 * - Idempotence cote assignation (le back gere deja; ici on reste neutre)
 * - On conserve 100% des fonctionnalités existantes
 * ============================================================
 */

/* ---------- Utils locaux ---------- */
function toNumberOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   🔹 PROJETS
============================================================ */

/**
 * Recuperer tous les projets selon le role de l'utilisateur
 * - le backend filtre deja selon le role (client/agent/admin)
 * @param {object} params
 */
export async function getProjects(params = {}) {
  const { data } = await api.get('/projects', { params: mergeGeoParams(params) });
  const list = data?.projects || [];
 // On precise bien la categorie 'project' pour eviter les effets de bord
  return list.map((p) => applyLabels(p, 'project'));
}

/**
 * Detail dun projet (+ labels)
 * @param {number|string} id
 */
export async function getProjectById(id) {
  const { data } = await api.get(`/projects/${id}`);
  const project = data?.project || null;
  return project ? applyLabels(project, 'project') : null;
}

/**
 * Creer un projet
 *    - Admin: peut préciser clientId et agentId
 * - Client: clientId ignore cote back, pris depuis le token
 * @param {object} form
 */
export async function createProject(form = {}) {
  const payload = mergeGeoPayload({
    title: form?.title,
    type: form?.type,
    description: form?.description || null,
    budget: toNumberOrNull(form?.budget),
    currency: form?.currency || 'XOF',

    // Admin uniquement (le backend se charge d’ignorer si non admin)
    clientId:
      form?.clientId !== undefined && form.clientId !== ''
        ? Number(form.clientId)
        : undefined,
    agentId:
      form?.agentId !== undefined && form.agentId !== ''
        ? Number(form.agentId)
        : undefined,
  });

  const { data } = await api.post('/projects', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return applyLabels(data.project, 'project');
}

/**
 * Mettre a jour un projet
 *    ⚠ IMPORTANT :
 * - On nenvoie au backend QUE les champs presents dans `form`
 *      => pas de reset involontaire du budget / description / currency.
 * @param {number|string} id
 * @param {object} form
 */
export async function updateProject(id, form = {}) {
  const payload = {};

 // Champs editables generiques
  if ('title' in form) {
    payload.title = form.title;
  }
  if ('type' in form) {
    payload.type = form.type;
  }
  if ('description' in form) {
    // On permet explicitement de vider la description
    payload.description = form.description ?? null;
  }
  if ('budget' in form) {
    payload.budget = toNumberOrNull(form.budget);
  }
  if ('currency' in form) {
    payload.currency = form.currency || 'XOF';
  }

 // Champs reserves admin (le backend tranchera selon le role reel)
  if ('status' in form) {
    payload.status = form.status;
  }
  if ('agentId' in form) {
    payload.agentId =
      form.agentId === '' || form.agentId === null || form.agentId === undefined
        ? null
        : Number(form.agentId);
  }
  if ('clientId' in form) {
 // Generalement on ne change pas le client dun projet, mais on garde la compatibilite
    payload.clientId =
      form.clientId === '' || form.clientId === null || form.clientId === undefined
        ? undefined
        : Number(form.clientId);
  }

  const { data } = await api.put(`/projects/${id}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return applyLabels(data.project, 'project');
}

/**
 * 🔹 Supprimer un projet
 * - Respecte la regle 1h cote backend (client) et droits admin
 * @param {number|string} id
 */
export async function deleteProject(id) {
  const { data } = await api.delete(`/projects/${id}`);
  return data;
}

/**
 * Assigner un agent a un projet (ADMIN uniquement)
 *    Route backend: POST /projects/assign
 * @param {number|string} projectId
 * @param {number|string|null} agentId - null pour désassigner
 */
export async function assignAgentToProject(projectId, agentId) {
  const payload = {
    projectId: Number(projectId),
    agentId:
      agentId === '' || agentId === undefined
        ? null
        : agentId === null
        ? null
        : Number(agentId),
  };

  const { data } = await api.post('/projects/assign', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

 // on retourne le projet mis a jour pour rafraichir lUI avec labels
  return applyLabels(data.project, 'project');
}

/* ============================================================
   🔹 PHASES DE PROJET
============================================================ */

/**
 * Liste des phases liees a un projet
 * @param {number|string} projectId
 */
export async function getProjectPhases(projectId) {
  const { data } = await api.get('/project-phases', {
    params: { projectId },
  });
  return data?.phases || [];
}

/**
 * Ajouter ou mettre a jour une phase
 * @param {object} phase
 * - create: { projectId, title, descriptionINFO, startDateINFO, endDateINFO }
 *   - update: { id, ...mêmes champs }
 */
export async function saveProjectPhase(phase) {
  const { id, ...rest } = phase;
  if (id) {
    const { data } = await api.put(`/project-phases/${id}`, rest, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data?.phase;
  } else {
    const { data } = await api.post('/project-phases', rest, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data?.phase;
  }
}

/**
 * 🔹 Supprimer une phase
 * @param {number|string} id
 */
export async function deleteProjectPhase(id) {
  const { data } = await api.delete(`/project-phases/${id}`);
  return data;
}

/* ============================================================
   🔹 DOCUMENTS DE PROJET
============================================================ */

/**
 * 🔹 Documents du projet
 * @param {number|string} projectId
 * @returns {Array} documents (chaque doc peut contenir: phaseTitle, uploader, kindLabel, etc.)
 */
export async function getProjectDocuments(projectId) {
  const { data } = await api.get('/project-documents', {
    params: mergeGeoParams({ projectId }),
  });
  return data?.documents || [];
}

/**
 * 🔹 Upload de documents
 * @param {number|string} projectId
 * @param {File[]} files
 * @param {string} [notes='']
 * @param {number|string|null} [phaseId]
 * @param {{ titleINFO: string, kindINFO: 'contract'|'plan'|'report'|'photo'|'other' }} [meta]
 */
export async function uploadProjectDocuments(
  projectId,
  files = [],
  notes = '',
  phaseId = null,
  meta = {}
) {
  const formData = new FormData();
  formData.append('projectId', projectId);

  if (notes) formData.append('notes', notes);
  if (phaseId !== null && phaseId !== undefined && phaseId !== '') {
    formData.append('phaseId', String(phaseId));
  }
  if (meta?.title) formData.append('title', meta.title);
  if (meta?.kind) formData.append('kind', meta.kind);

  files.forEach((f) => formData.append('files', f));

  const { data } = await api.post('/project-documents', formData);
  return data?.documents || [];
}

/**
 * 🔹 Supprimer un document
 * @param {number|string} id
 */
export async function deleteProjectDocument(id) {
  const { data } = await api.delete(`/project-documents/${id}`);
  return data;
}

/* ============================================================
   ✅ Export par défaut NOMMÉ
   — garde les exports nommés ET fournit un objet service complet
============================================================ */
const ProjectsService = {
  // Projets
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  assignAgentToProject,

  // Phases
  getProjectPhases,
  saveProjectPhase,
  deleteProjectPhase,

  // Documents
  getProjectDocuments,
  uploadProjectDocuments,
  deleteProjectDocument,
};

export default ProjectsService;
