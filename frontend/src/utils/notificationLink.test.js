import { resolveNotificationLink } from "./notificationLink";

describe("resolveNotificationLink", () => {
  test('step and evidence updates use the permission-aware service entry with an exact step reference', () => {
    expect(resolveNotificationLink({ entityType: 'task', entityId: 27, metadata: { serviceId: 14 } }, 'agent')).toBe('/services/14/tasks?etape=27#steps');
    expect(resolveNotificationLink({ entityType: 'evidence', entityId: 72, metadata: { serviceId: 14, taskId: 27 } }, 'client')).toBe('/services/14/tasks?etape=27&pieces=1#steps');
    expect(resolveNotificationLink({ entityType: 'evidence', entityId: 72, metadata: { taskId: 27 } }, 'client')).toBe('/tasks/27/evidences');
  });
  test('opens the exact coordination request in the single operations centre', () => {
    expect(resolveNotificationLink({ entityType: 'service', entityId: 48, metadata: { coordinationState: 'escalated' } }, 'admin')).toBe('/operations?vue=coordonner&type=service&demande=48');
    expect(resolveNotificationLink({ entityType: 'service', entityId: 48, metadata: { coordinationState: 'escalated' } }, 'client')).toBe('/services/48');
  });
  const mobilityNotification = {
    entityType: "service",
    entityId: 81,
    metadata: {
      serviceId: 81,
      missionStatus: "CREATED",
      requestedVehicleType: "motorcycle",
    },
  };

  test("envoie un admin directement vers le dispatch de la course", () => {
    expect(resolveNotificationLink(mobilityNotification, "admin")).toBe(
      "/admin/taxi-dispatch?missionId=81"
    );
  });

  test("conserve le suivi pour le client et le chauffeur", () => {
    expect(resolveNotificationLink(mobilityNotification, "client")).toBe(
      "/courses/81"
    );
    expect(resolveNotificationLink(mobilityNotification, "provider")).toBe(
      "/courses/81"
    );
  });

  test("ne dirige jamais un admin vers le suivi interdit d'une autre filiere", () => {
    expect(
      resolveNotificationLink(
        {
          entityType: "service",
          entityId: 90,
          metadata: { serviceId: 90, missionStatus: "CREATED" },
        },
        "admin"
      )
    ).toBe("/admin/services?demande=90");
  });

  test('agent supervision opens the same authorized route from an information and a work list', () => {
    expect(resolveNotificationLink(mobilityNotification, 'agent')).toBe('/missions/81/track');
  });

  test.each([['client', '/livraisons/90'], ['provider', '/livraisons/90'], ['admin', '/admin/livraisons?demande=90']])('delivery information opens the correct %s workspace', (role, path) => {
    expect(resolveNotificationLink({ entityType: 'service', entityId: 90, metadata: { missionStatus: 'ASSIGNED', packageType: 'bulky' } }, role)).toBe(path);
  });

  test('a property-only task information opens its exact intervention', () => {
    expect(resolveNotificationLink({ entityType: 'task', entityId: 29 }, 'agent')).toBe('/tasks/29');
  });
});
