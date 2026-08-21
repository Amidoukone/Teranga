// frontend/src/utils/notificationLink.js
// Résout la route de destination d'un clic sur une notification/activité — logique partagée
// entre NotificationsPage.jsx et ActivityCenterPage.jsx (auparavant dupliquée à l'identique
// dans les deux fichiers).
export function resolveNotificationLink(n, currentUserRole) {
  if (!n) return '/dashboard';

  if (n.entityType === 'order') return n.entityId ? `/orders/${n.entityId}` : '/orders';
  if (n.entityType === 'project') return n.entityId ? `/projects/${n.entityId}` : '/projects';

  if (n.entityType === 'task') {
    const serviceId = n?.metadata?.serviceId;
    if (serviceId) return `/services/${serviceId}/tasks`;
    return '/tasks';
  }

  if (n.entityType === 'service') {
    const serviceId = n?.metadata?.serviceId || n?.entityId;
    if (!serviceId) return currentUserRole === 'agent' ? '/agent/services' : '/services';
    // Mission filière (executionType='provider', missionStatus renseigné) : ouvre le suivi
    // dédié. Service classique : ouvre le service lui-même — pas directement ses tâches, un
    // service n'en a pas forcément, l'utilisateur y navigue ensuite s'il le souhaite.
    if (n?.metadata?.missionStatus) {
      // L'ecran /missions/:id/track est reserve au client et a l'executant. Un admin qui y
      // arrivait depuis une notification recevait donc un 403. Pour une course Mobilite, le clic
      // ouvre directement le dispatch ; pour les anciennes notifications ou les autres filieres,
      // il revient vers la gestion admin des services.
      if (currentUserRole === 'admin') {
        if (n?.metadata?.requestedVehicleType) {
          return `/admin/taxi-dispatch?missionId=${serviceId}`;
        }
        return '/admin/services';
      }
      return `/missions/${serviceId}/track`;
    }
    return `/services/${serviceId}`;
  }

  if (n.entityType === 'evidence') {
    const taskId = n?.metadata?.taskId;
    const orderId = n?.metadata?.orderId;
    if (taskId) return `/tasks/${taskId}/evidences`;
    if (orderId) return `/orders/${orderId}`;
  }

  return '/dashboard';
}
