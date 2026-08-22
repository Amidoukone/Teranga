import { resolveNotificationLink } from "./notificationLink";

describe("resolveNotificationLink", () => {
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
    ).toBe("/admin/services");
  });
});
