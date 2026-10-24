'use strict';

const { canAccessGeoResource, isGlobalAdmin } = require('./geoScope');

// Même politique que les routes de justificatifs : la consultation d'une tâche
// ne suffit pas à autoriser ses pièces hors du périmètre de la ressource liée.
function canAccessTaskEvidence(user, task) {
  if (!user || !task) return false;
  if (isGlobalAdmin(user)) return true;
  if (user.role === 'admin') return canAccessGeoResource(task, user);
  const related = user.role === 'agent'
    ? task.assignedTo === user.id || task.service?.agentId === user.id
    : user.role === 'client' && (task.creatorId === user.id || task.service?.clientId === user.id || task.property?.ownerId === user.id);
  return Boolean(related && canAccessGeoResource(task.service || task.property || task, user));
}

function taskCapabilities(task, user) {
  const scoped = user?.role === 'client' || canAccessGeoResource(task, user);
  const admin = user?.role === 'admin' && scoped;
  const executor = user?.role === 'agent' && task.assignedTo === user.id && scoped;
  return {
    canStart: Boolean((admin || executor) && task.status === 'created'),
    canComplete: Boolean((admin || executor) && task.status === 'in_progress'),
    canValidate: Boolean(admin && task.status === 'completed'),
    canAssign: Boolean(admin && task.status === 'created'),
    canAccessEvidence: canAccessTaskEvidence(user, task),
  };
}

module.exports = { canAccessTaskEvidence, taskCapabilities };
