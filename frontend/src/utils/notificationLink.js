// frontend/src/utils/notificationLink.js
// Ouvre le dossier concerné depuis le suivi du centre des opérations.
import { getRequestDetailPath } from './requestLifecycle';
const reference = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? String(Number(value)) : null;
function stepEntry(serviceId, taskId, evidence = false) {
  const parent = reference(serviceId), step = reference(taskId);
  return parent && step ? `/services/${parent}/tasks?etape=${step}${evidence ? '&pieces=1' : ''}#steps` : null;
}
export function resolveNotificationLink(n, currentUserRole) {
  if (!n) return '/operations';

  if (n.entityType === 'order') return n.entityId ? `/orders/${n.entityId}` : '/orders';
  if (n.entityType === 'project') return n.entityId ? `/projects/${n.entityId}` : '/projects';

  if (n.entityType === 'task') {
    const serviceId = n?.metadata?.serviceId;
    if (serviceId) return stepEntry(serviceId, n.entityId) || `/services/${serviceId}/tasks`;
    return reference(n.entityId) ? `/tasks/${reference(n.entityId)}` : '/tasks';
  }

  if (n.entityType === 'service') {
    const serviceId = n?.metadata?.serviceId || n?.entityId;
    if (n?.metadata?.coordinationState && currentUserRole === 'admin') return `/operations?vue=coordonner&type=service${serviceId ? `&demande=${encodeURIComponent(serviceId)}` : ''}`;
    if (!serviceId) return currentUserRole === 'agent' ? '/agent/services' : '/services';
    // Mission filière (executionType='provider', missionStatus renseigné) : ouvre le suivi
    // dédié. Service classique : ouvre le service lui-même — pas directement ses tâches, un
    // service n'en a pas forcément, l'utilisateur y navigue ensuite s'il le souhaite.
    if (n?.metadata?.missionStatus) {
      const metadata = n.metadata;
      const slug = metadata.tradeCategorySlug || metadata.tradeCategory?.slug ||
        (metadata.packageType ? 'livraison' : metadata.requestedVehicleType ? 'mobilite' : undefined);
      return getRequestDetailPath({ id: serviceId, missionStatus: metadata.missionStatus,
        requestedVehicleType: metadata.requestedVehicleType, tradeCategory: { slug } }, undefined, currentUserRole);
    }
    return `/services/${serviceId}`;
  }

  if (n.entityType === 'evidence') {
    const taskId = n?.metadata?.taskId;
    const orderId = n?.metadata?.orderId;
    if (taskId) return stepEntry(n.metadata?.serviceId, taskId, true) || `/tasks/${taskId}/evidences`;
    if (orderId) return `/orders/${orderId}`;
    if (n?.metadata?.projectId) return `/projects/${n.metadata.projectId}`;
    if (n?.metadata?.serviceId) return `/services/${n.metadata.serviceId}`;
  }

  return '/operations';
}
