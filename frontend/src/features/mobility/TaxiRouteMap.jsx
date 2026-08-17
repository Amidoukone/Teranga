import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadGoogleMaps } from "../mission-creation/googleMapsLoader";

const DEFAULT_CENTER = { lat: 12.6392, lng: -8.0029 };

function isCoordinatePair(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

function toLatLng(value) {
  return { lat: Number(value.latitude), lng: Number(value.longitude) };
}

function clearGoogleListeners(refs) {
  refs.forEach((ref) => {
    const instance = ref.current;
    if (instance && window.google?.maps?.event) {
      window.google.maps.event.clearInstanceListeners(instance);
    }
  });
}

/**
 * Carte Taxi unique : départ + destination + itinéraire Google best-effort. Le prix reste calculé
 * par le backend ; DirectionsRenderer sert uniquement à rendre le parcours compréhensible.
 */
export default function TaxiRouteMap({
  pickup,
  destination,
  activePoint = "destination",
  onPickupChange,
  onDestinationChange,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsRequestRef = useRef(0);
  const activePointRef = useRef(activePoint);
  const onPickupChangeRef = useRef(onPickupChange);
  const onDestinationChangeRef = useRef(onDestinationChange);
  const [mapsAvailable, setMapsAvailable] = useState(null);

  activePointRef.current = activePoint;
  onPickupChangeRef.current = onPickupChange;
  onDestinationChangeRef.current = onDestinationChange;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps || !containerRef.current) {
        if (!cancelled) setMapsAvailable(false);
        return;
      }

      setMapsAvailable(true);
      const center = isCoordinatePair(pickup)
        ? toLatLng(pickup)
        : isCoordinatePair(destination)
        ? toLatLng(destination)
        : DEFAULT_CENTER;

      mapRef.current = new maps.Map(containerRef.current, {
        center,
        zoom: isCoordinatePair(pickup) || isCoordinatePair(destination) ? 15 : 12,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      directionsRendererRef.current = new maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: { strokeColor: "#2563eb", strokeOpacity: 0.9, strokeWeight: 5 },
      });

      mapRef.current.addListener("click", (event) => {
        const coordinates = {
          latitude: event.latLng.lat(),
          longitude: event.latLng.lng(),
        };
        if (activePointRef.current === "pickup") onPickupChangeRef.current?.(coordinates);
        else onDestinationChangeRef.current?.(coordinates);
      });
    });

    return () => {
      cancelled = true;
      directionsRequestRef.current += 1;
      clearGoogleListeners([
        pickupMarkerRef,
        destinationMarkerRef,
        directionsRendererRef,
        mapRef,
      ]);
    };
    // La carte est créée une seule fois ; les positions sont synchronisées dans l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    const syncMarker = (ref, value, label, color, onChange) => {
      if (!isCoordinatePair(value)) {
        ref.current?.setMap(null);
        ref.current = null;
        return;
      }
      const position = toLatLng(value);
      if (!ref.current) {
        ref.current = new maps.Marker({
          map,
          position,
          draggable: true,
          label: { text: label, color: "#ffffff", fontWeight: "700" },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        ref.current.addListener("dragend", () => {
          const next = ref.current?.getPosition();
          if (next) onChange?.({ latitude: next.lat(), longitude: next.lng() });
        });
      } else {
        ref.current.setMap(map);
        ref.current.setPosition(position);
      }
    };

    syncMarker(pickupMarkerRef, pickup, "D", "#16a34a", onPickupChange);
    syncMarker(destinationMarkerRef, destination, "A", "#dc2626", onDestinationChange);

    const hasPickup = isCoordinatePair(pickup);
    const hasDestination = isCoordinatePair(destination);
    if (hasPickup && hasDestination) {
      const requestId = directionsRequestRef.current + 1;
      directionsRequestRef.current = requestId;
      const service = new maps.DirectionsService();
      service.route(
        {
          origin: toLatLng(pickup),
          destination: toLatLng(destination),
          travelMode: maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (directionsRequestRef.current !== requestId) return;
          if (status === "OK" && result) {
            directionsRendererRef.current?.setDirections(result);
            return;
          }
          directionsRendererRef.current?.set("directions", null);
          const bounds = new maps.LatLngBounds();
          bounds.extend(toLatLng(pickup));
          bounds.extend(toLatLng(destination));
          map.fitBounds(bounds, 60);
        }
      );
    } else {
      directionsRequestRef.current += 1;
      directionsRendererRef.current?.set("directions", null);
      const position = hasPickup ? toLatLng(pickup) : hasDestination ? toLatLng(destination) : null;
      if (position) {
        map.panTo(position);
        map.setZoom(15);
      }
    }
  }, [destination, onDestinationChange, onPickupChange, pickup]);

  if (mapsAvailable === false) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-border bg-surface-main px-6 text-center text-sm text-text-muted">
        {t("mobilityBooking.mapUnavailable")}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-main">
      <div ref={containerRef} className="h-80 w-full sm:h-[420px]" />
      {mapsAvailable === null ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-main text-sm text-text-muted">
          {t("mobilityBooking.loadingMap")}
        </div>
      ) : null}
    </div>
  );
}
