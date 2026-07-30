import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadGoogleMaps } from "./googleMapsLoader";

// Centre par défaut : Bamako (marché domestique de Teranga) — utilisé uniquement tant
// qu'aucune position n'est encore choisie.
const DEFAULT_CENTER = { lat: 12.6392, lng: -8.0029 };
const DEFAULT_ZOOM = 13;
const SELECTED_ZOOM = 16;

/**
 * Carte avec dépose d'épingle (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 2). Un clic sur
 * la carte (ou un glissé du marqueur) pose directement les coordonnées — pas de géocodage
 * inverse nécessaire, l'adresse reste gérée par LocationAutocompleteInput à côté. Dégradation
 * gracieuse si le SDK Google Maps n'est pas chargé (pas de clé, offline) : message explicite
 * plutôt qu'un cadre vide, le champ adresse au-dessus reste utilisable seul (section 4.4).
 */
export default function MissionLocationMap({ latitude, longitude, onPositionChange, className }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  // Le SDK Google Maps se charge de façon asynchrone (loadGoogleMaps()) ; si la position
  // change (ex. géolocalisation) avant que ce chargement se termine, l'effet d'initialisation
  // ci-dessous ne doit pas utiliser les valeurs `latitude`/`longitude` figées au tout premier
  // rendu (fermeture de useEffect à deps []) mais bien les valeurs les plus récentes au moment
  // où la carte est réellement créée — sinon la carte s'initialise sur Bamako par défaut, sans
  // repère, alors que la position a bien été obtenue.
  const positionRef = useRef({ latitude, longitude });
  positionRef.current = { latitude, longitude };
  const [mapsAvailable, setMapsAvailable] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((maps) => {
      if (cancelled) return;
      if (!maps || !containerRef.current) {
        setMapsAvailable(false);
        return;
      }
      setMapsAvailable(true);

      const { latitude: initialLatitude, longitude: initialLongitude } = positionRef.current;
      const hasPosition = Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude);
      const center = hasPosition ? { lat: initialLatitude, lng: initialLongitude } : DEFAULT_CENTER;

      const map = new maps.Map(containerRef.current, {
        center,
        zoom: hasPosition ? SELECTED_ZOOM : DEFAULT_ZOOM,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;

      const placeMarker = (position) => {
        if (markerRef.current) {
          markerRef.current.setPosition(position);
          return;
        }
        markerRef.current = new maps.Marker({ position, map, draggable: true });
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current.getPosition();
          onPositionChangeRef.current?.({ latitude: pos.lat(), longitude: pos.lng() });
        });
      };

      if (hasPosition) placeMarker(center);

      map.addListener("click", (event) => {
        const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        placeMarker(position);
        onPositionChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
      });
    });

    return () => {
      cancelled = true;
      if (markerRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(markerRef.current);
      }
      if (mapRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mapRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre/déplace le marqueur si la position change depuis l'extérieur (ex. sélection
  // Places Autocomplete ou choix d'un lieu enregistré) sans re-créer toute la carte.
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const position = { lat: latitude, lng: longitude };
    mapRef.current.panTo(position);
    mapRef.current.setZoom(SELECTED_ZOOM);

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new window.google.maps.Marker({
        position,
        map: mapRef.current,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current.getPosition();
        onPositionChangeRef.current?.({ latitude: pos.lat(), longitude: pos.lng() });
      });
    }
  }, [latitude, longitude]);

  if (mapsAvailable === false) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-border bg-surface-main px-4 py-8 text-center text-sm text-text-muted ${className || ""}`}>
        {t("missionCreation.location.mapUnavailable")}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-64 w-full overflow-hidden rounded-2xl border border-border ${className || ""}`}
    />
  );
}
