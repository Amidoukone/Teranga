import { useEffect, useRef } from "react";

import { loadGoogleMaps } from "./googleMapsLoader";

/**
 * Champ adresse avec Places Autocomplete (docs/DEV_SPEC_TERANGA_v3.md
 * section 4.1/4.3). Reste un simple `<input>` texte contrôlé tant que le SDK
 * Google Maps n'est pas chargé (pas de clé configurée, offline, échec réseau)
 * — dégradation gracieuse, pas de blocage du formulaire (section 4.4).
 *
 * `onPlaceSelected` n'est appelé que lorsqu'une suggestion est choisie et
 * résout des coordonnées ; une adresse tapée librement sans sélection reste
 * un simple texte, géocodé côté serveur à la soumission (voir
 * missionRequest.controller.js).
 */
export default function LocationAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  className,
  placeholder,
  required,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((maps) => {
      if (cancelled || !maps?.places || !inputRef.current) return;

      const autocomplete = new maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;
        if (!location) return;

        onPlaceSelectedRef.current?.({
          address: place.formatted_address || inputRef.current.value,
          latitude: location.lat(),
          longitude: location.lng(),
        });
      });

      autocompleteRef.current = autocomplete;
    });

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      required={required}
    />
  );
}
