import React from "react";
import { render, waitFor } from "@testing-library/react";

import MissionLocationMap from "./MissionLocationMap";
import { loadGoogleMaps } from "./googleMapsLoader";

jest.mock("./googleMapsLoader", () => ({ loadGoogleMaps: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

test("la carte se centre sur la région du pays sélectionné sans poser de repère", async () => {
  const viewport = {};
  const map = { addListener: jest.fn(), fitBounds: jest.fn(), panTo: jest.fn() };
  const findPlaceFromQuery = jest.fn((_request, callback) => {
    callback([{ geometry: { viewport } }], "OK");
  });
  const maps = {
    Map: jest.fn(() => map),
    places: {
      PlacesService: jest.fn(() => ({ findPlaceFromQuery })),
      PlacesServiceStatus: { OK: "OK" },
    },
    event: { clearInstanceListeners: jest.fn() },
  };
  window.google = { maps };
  loadGoogleMaps.mockResolvedValue(maps);

  const { unmount } = render(
    <MissionLocationMap
      countryName="Côte d'Ivoire"
      regionName="Abidjan"
      onPositionChange={jest.fn()}
    />
  );

  await waitFor(() => expect(findPlaceFromQuery).toHaveBeenCalledWith(
    { query: "Abidjan, Côte d'Ivoire", fields: ["geometry"] },
    expect.any(Function)
  ));
  expect(map.fitBounds).toHaveBeenCalledWith(viewport);
  unmount();
  delete window.google;
});
