import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadGoogleMaps } from "../mission-creation/googleMapsLoader";

function hasPoint(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

export default function DispatchCandidatesMap({ mission, candidates }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const markers = [];
    let map = null;
    let renderer = null;

    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !containerRef.current) {
        if (!cancelled) setAvailable(false);
        return;
      }
      setAvailable(true);
      const pickup = {
        lat: Number(mission.pickupLatitude),
        lng: Number(mission.pickupLongitude),
      };
      map = new maps.Map(containerRef.current, {
        center: pickup,
        zoom: 13,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      const bounds = new maps.LatLngBounds();
      bounds.extend(pickup);
      markers.push(
        new maps.Marker({
          map,
          position: pickup,
          label: { text: "D", color: "#ffffff", fontWeight: "700" },
          title: mission.pickupAddress || t("mobilityDispatch.map.pickup"),
        })
      );

      if (hasPoint(mission.destinationLatitude, mission.destinationLongitude)) {
        const destination = {
          lat: Number(mission.destinationLatitude),
          lng: Number(mission.destinationLongitude),
        };
        bounds.extend(destination);
        markers.push(
          new maps.Marker({
            map,
            position: destination,
            label: { text: "A", color: "#ffffff", fontWeight: "700" },
            title: mission.destinationAddress || t("mobilityDispatch.map.destination"),
          })
        );
        renderer = new maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#2563eb", strokeOpacity: 0.75, strokeWeight: 4 },
        });
        new maps.DirectionsService().route(
          { origin: pickup, destination, travelMode: maps.TravelMode.DRIVING },
          (result, status) => {
            if (!cancelled && status === "OK") renderer?.setDirections(result);
          }
        );
      }

      candidates.forEach((candidate, index) => {
        const position = {
          lat: Number(candidate.location.latitude),
          lng: Number(candidate.location.longitude),
        };
        bounds.extend(position);
        markers.push(
          new maps.Marker({
            map,
            position,
            label: { text: String(index + 1), color: "#ffffff", fontWeight: "700" },
            title: `${candidate.provider.displayFirstName} · ${candidate.vehicle.plateNumber}`,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#7c3aed",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          })
        );
      });
      if (candidates.length || hasPoint(mission.destinationLatitude, mission.destinationLongitude)) {
        map.fitBounds(bounds, 55);
      }
    });

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      renderer?.setMap(null);
      if (map && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(map);
    };
  }, [candidates, mission, t]);

  if (available === false) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-surface-main px-5 text-center text-sm text-text-muted">
        {t("mobilityDispatch.map.unavailable")}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-main">
      <div ref={containerRef} className="h-72 w-full lg:h-[430px]" />
      {available === null ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-main text-sm text-text-muted">
          {t("mobilityDispatch.loading")}
        </div>
      ) : null}
    </div>
  );
}
