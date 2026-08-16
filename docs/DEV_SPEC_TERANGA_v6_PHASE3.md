# Spécification de développement — Teranga v6 / Phase 3 (livraison client)

Document destiné à Claude Code, même esprit que les DEV_SPEC précédents. Suite de
`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §4 (Cas 2) et §11 (Phase 3). Réutilise le vivier
mobilité + dispatch construits en Phase 2 — c'est la **première fonctionnalité client-facing**
issue de ce chantier (Mobilité/Phase 2 était strictement interne).

**Hors périmètre explicite** : Teranga Taxi (Phase 4). Pas de convergence avec la marketplace
produits dans ce lot (lien `orderId` optionnel resté non construit, comme prévu).

---

## 0. Contexte — état vérifié avant toute chose

- **Filière "livraison" déjà seedée et déjà sélectionnable** dans le wizard de création de
  mission — `CategoryPicker.jsx` est 100% data-driven, aucun changement nécessaire pour la faire
  apparaître.
- **Le wizard ne capture qu'UN SEUL lieu aujourd'hui** (`MissionCreationWizard.jsx` state
  `address`/`coordinates`), aucune notion retrait/dépose. `mission.controller.js exports.create`
  ne lit et n'insère que `address`/`latitude`/`longitude` — les colonnes
  `pickupAddress`/`pickupLatitude`/`pickupLongitude` (posées en Phase 2 Lot 4) ne sont utilisées
  que par `exports.requestLogistics` (sous-mission interne), jamais par la création de mission
  normale.
- **Le devis est un forfait fixe** (`priceEstimate.service.js`), pas de calcul de distance —
  `pricePerKm` existe sur `MissionPricingRule` mais n'est jamais combiné à une distance
  calculée nulle part dans le code.
- **La fenêtre d'acceptation** (`mission.controller.js:529`, Phase 2 Lot 5) ne vérifie
  aujourd'hui que `tradeCategory?.slug === 'mobilite'` — la filière livraison n'en bénéficie pas
  encore alors que le dispatch est censé être partagé entre les deux filières.
- **Le suivi (`track`) n'affiche qu'un seul point** (destination) sur la carte —
  `MissionTrackingMap` n'accepte que position courante + destination, pas de 3ᵉ point.

---

## 1. Capture retrait + dépose à la création

### 1.1 Backend

`createMissionSchema` : ajouter `pickupAddress`/`pickupLatitude`/`pickupLongitude`, tous
optionnels au niveau Joi (structure seulement) — la vraie règle "obligatoire si filière
livraison" est une règle métier vérifiée dans le contrôleur, pas dans le schéma (même principe
que la géolocalisation obligatoire déjà appliquée ailleurs dans `exports.create`).

`mission.controller.js exports.create` : après résolution de `tradeCategory`, si
`tradeCategory.slug === 'livraison'` :
- Retrait obligatoire (coordonnées fournies, ou géocodage serveur de `pickupAddress` si adresse
  seule — même logique déjà existante pour la dépose).
- 400 explicite si aucun retrait fourni pour cette filière.
- Insérer `pickupAddress`/`pickupLatitude`/`pickupLongitude` dans `Service.create()`.

### 1.2 Frontend

Pas de nouvelle étape de wizard (le wizard reste à 4 étapes fixes, pas de réorganisation).
`LocationStep.jsx` : quand la filière sélectionnée est "livraison", afficher un **second** bloc
adresse+carte pour le retrait, au-dessus du bloc dépose existant (même
`LocationAutocompleteInput`/`MissionLocationMap`, dupliqués avec un état `pickupAddress`/
`pickupCoordinates` distinct dans `MissionCreationWizard.jsx`).

---

## 2. Tarification à la distance (amélioration ciblée, pas juste un forfait)

`priceEstimate.service.js` : quand retrait ET dépose sont connus (coordonnées des deux points) ET
que la règle de tarification résolue a un `pricePerKm` renseigné, ajouter
`pricePerKm * distanceKm` au `basePrice`. Distance calculée en **haversine local** (réutiliser
`backend/src/utils/evidenceProximity.js` `haversineDistanceMeters`, déjà écrit en Phase 0 — pas
d'appel Distance Matrix payant, cohérent avec la règle "jamais d'appel Distance Matrix hors
matching/recalcul explicite", section 8 du DEV_SPEC v3). Si `pricePerKm` absent de la règle :
comportement inchangé (forfait fixe), aucune régression pour les autres filières.

---

## 3. Dispatch partagé Mobilité + Livraison

`mission.controller.js exports.assign` : élargir la condition de fenêtre d'acceptation à
`['mobilite', 'livraison'].includes(tradeCategory?.slug)` — le dispatch (disponibilité
déclarative, fenêtre 90s, job de timeout) est déjà générique, seule cette condition le limitait
artificiellement à Mobilité.

---

## 4. Suivi client — afficher le retrait

`track` : exposer `pickupAddress`/`pickupLatitude`/`pickupLongitude` dans la réponse (déjà fait
pour `parentServiceId`/`acceptanceDeadlineAt` en Phase 2, même principe). Côté
`MissionTrackingPage.js` : afficher l'adresse de retrait en texte sous la carte (comme l'adresse
de dépose déjà affichée) — pas de 3ᵉ marqueur sur `MissionTrackingMap` dans ce lot (composant
non modifié, scope volontairement limité).

---

## 5. Réconciliation cash à la remise

Nouvelle colonne additive `services.collectedAmount` (DECIMAL nullable). À la transition
`COMPLETED` déclenchée par l'exécutant d'une mission filière livraison, le body peut inclure
`collectedAmount` — si fourni et différent de `service.budget` (au-delà d'une tolérance de
1 unité pour l'arrondi), notifier le master (même canal `emitEvent`, pas de blocage de la
transition). Champ optionnel : ne s'applique qu'aux missions livraison, n'affecte aucune autre
filière.

---

## 6. Rôles et permissions

Aucun changement — client crée (comme toute mission), dispatch/exécution suivent exactement le
même modèle que Phase 2.

---

## 7. Plan de livraison suggéré

1. **Capture retrait + dépose** (§1) — backend puis frontend, prérequis de tout le reste.
2. **Tarification à la distance** (§2) — indépendant, peut être testé isolément avec des
   coordonnées fictives.
3. **Dispatch partagé** (§3) — modification d'une ligne, à tester avec une mission livraison de
   bout en bout (affectation → acceptation/refus/timeout, déjà couvert par les tests Phase 2).
4. **Suivi retrait** (§4) — cosmétique, faible risque.
5. **Réconciliation cash** (§5) — dépend de rien d'autre, testable isolément.

---

## 8. Ce qu'il ne faut surtout pas faire

- Ne pas appeler Google Distance Matrix pour le devis — haversine local uniquement (§2).
- Ne pas construire la convergence marketplace (lien `orderId`) — non demandée, reste hors
  périmètre.
- Ne pas modifier `MissionTrackingMap.jsx` pour un 3ᵉ marqueur dans ce lot — texte suffit (§4).
- Ne pas dupliquer le mécanisme de dispatch — élargir la condition existante (§3), pas un second
  système.
