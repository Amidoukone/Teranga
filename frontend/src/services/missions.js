// frontend/src/services/missions.js
import api from './api';

// Création de mission guidée, utilisateur authentifié (docs/DEV_SPEC_TERANGA_v3.md section 4.1).
// ⚠️ Comme missionRequests.js : ces routes sont v1-only (section 0.5), l'instance `api` cible
// /api (legacy) par défaut — préfixe explicite /v1 nécessaire.

const UPLOAD_TIMEOUT_MS = Number(process.env.REACT_APP_UPLOAD_TIMEOUT_MS) || 120000;

/**
 * POST /api/v1/missions/estimate — aucune écriture, calcul d'estimation pour l'étape 4.
 */
export async function estimateMission(payload) {
  const { data } = await api.post('/v1/missions/estimate', payload);
  return data?.estimate;
}

/**
 * POST /api/v1/missions — crée la mission guidée.
 */
export async function createMission(payload) {
  const { data } = await api.post('/v1/missions', payload);
  return data;
}

/**
 * POST /api/v1/missions/:id/attachments — photo + note vocale optionnelles, endpoint séparé de
 * la création (la mission ne doit jamais être bloquée par un échec d'upload média).
 */
export async function uploadMissionAttachments(missionId, { photo, voiceNote } = {}) {
  if (!missionId) throw new Error('missionId requis pour uploadMissionAttachments');
  if (!photo && !voiceNote) return null;

  const formData = new FormData();
  if (photo) formData.append('photo', photo);
  if (voiceNote) formData.append('voiceNote', voiceNote);

  const { data } = await api.post(`/v1/missions/${missionId}/attachments`, formData, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

/**
 * GET /api/v1/missions/:id/track — suivi en direct (docs/DEV_SPEC_TERANGA_v3.md section 4.2),
 * consommé par polling depuis MissionTrackingPage.
 */
export async function getMissionTrack(missionId) {
  const { data } = await api.get(`/v1/missions/${missionId}/track`);
  return data;
}

/**
 * PATCH /api/v1/missions/:id/status — transition de statut (section 2). Utilisé côté client pour
 * valider ("VALIDATED") ou annuler ("CANCELLED_BY_CLIENT") sa mission.
 */
export async function updateMissionStatus(missionId, toStatus) {
  const { data } = await api.patch(`/v1/missions/${missionId}/status`, { toStatus });
  return data;
}

/**
 * POST /api/v1/missions/:id/assign — assignation manuelle d'un prestataire (admin), section 4.2.
 * Pas de short-list/auto-matching ici (Lot 4).
 */
export async function assignMissionProvider(missionId, providerId) {
  const { data } = await api.post(`/v1/missions/${missionId}/assign`, { providerId });
  return data;
}
