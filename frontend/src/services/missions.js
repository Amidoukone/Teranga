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
 * GET /api/v1/missions/reverse-geocode — coordonnées -> adresse lisible (bouton "Utiliser ma
 * position actuelle" de l'étape Lieu). Passe par le backend (clé serveur) : la clé navigateur
 * est restreinte à Maps JavaScript/Places, jamais Geocoding. Retourne `null` en best-effort.
 */
export async function reverseGeocodeLocation({ latitude, longitude }) {
  try {
    const { data } = await api.get('/v1/missions/reverse-geocode', {
      params: { latitude, longitude },
    });
    return data?.address || null;
  } catch (_err) {
    return null;
  }
}

/**
 * POST /api/v1/missions — crée la mission guidée.
 */
export async function createMission(payload) {
  const { data } = await api.post('/v1/missions', payload);
  return data;
}

/**
 * POST /api/v1/missions/phone-order — canal opérateur téléphone (docs/DEV_SPEC_TERANGA_v7_PHASE4.md
 * §3), admin/master uniquement. Saisit une course/mission au nom d'un appelant sans app.
 */
export async function createPhoneOrder(payload) {
  const { data } = await api.post('/v1/missions/phone-order', payload);
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
export async function updateMissionStatus(missionId, toStatus, extra = {}) {
  const { data } = await api.patch(`/v1/missions/${missionId}/status`, { toStatus, ...extra });
  return data;
}

/**
 * GET /api/v1/missions/disputes — admin/master, scope géographique. Sans paramètre : file de
 * traitement (open/investigating) ; `status` explicite pour l'historique.
 */
export async function listMissionDisputes(params = {}) {
  const { data } = await api.get('/v1/missions/disputes', { params });
  return data?.disputes || [];
}

/**
 * POST /api/v1/missions/:id/logistics-request — un exécutant (agent/prestataire) en mission
 * active demande un déplacement interne (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4.2).
 */
export async function requestMissionLogistics(missionId, { latitude, longitude, address } = {}) {
  const { data } = await api.post(`/v1/missions/${missionId}/logistics-request`, {
    latitude,
    longitude,
    address,
  });
  return data?.mission;
}

/**
 * POST /api/v1/missions/:id/accept — le prestataire assigné confirme dans la fenêtre
 * d'acceptation (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2).
 */
export async function acceptMission(missionId) {
  const { data } = await api.post(`/v1/missions/${missionId}/accept`);
  return data?.mission;
}

/**
 * POST /api/v1/missions/:id/decline — le prestataire assigné refuse ; retour à
 * SEARCHING_EXECUTOR (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2).
 */
export async function declineMission(missionId) {
  const { data } = await api.post(`/v1/missions/${missionId}/decline`);
  return data?.mission;
}

/**
 * POST /api/v1/missions/:id/disputes — ouverture d'un litige par le client propriétaire,
 * uniquement depuis une mission COMPLETED (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2).
 */
export async function createMissionDispute(missionId, { reason, description }) {
  const { data } = await api.post(`/v1/missions/${missionId}/disputes`, { reason, description });
  return data;
}

/**
 * PATCH /api/v1/missions/:id/disputes/:disputeId — admin/master : soit `{ status: 'investigating' }`
 * (marque le premier contact), soit `{ resolution, resolutionNotes }` (résout).
 */
export async function updateMissionDispute(missionId, disputeId, payload) {
  const { data } = await api.patch(`/v1/missions/${missionId}/disputes/${disputeId}`, payload);
  return data;
}

/**
 * POST /api/v1/missions/:id/assign — assignation/réassignation/désassignation (admin), section
 * 4.2 + superviseur agent. `providerId`/`agentId` indépendants : omis = inchangé, `null` =
 * désassigner, nombre = assigner/réassigner. Pas de short-list/auto-matching ici (Lot 4).
 */
export async function updateMissionAssignment(missionId, { providerId, agentId } = {}) {
  const payload = {};
  if (providerId !== undefined) payload.providerId = providerId;
  if (agentId !== undefined) payload.agentId = agentId;
  const { data } = await api.post(`/v1/missions/${missionId}/assign`, payload);
  return data;
}

/**
 * GET /api/v1/missions/mine — missions filière assignées au compte connecté (agent superviseur ou
 * exécutant, provider exécutant). Les missions classiques agent restent sur getAgentServices().
 */
export async function getMyMissions(params = {}) {
  const { data } = await api.get('/v1/missions/mine', { params });
  return data;
}
