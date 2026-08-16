# Spécification de développement — Teranga v7 / Phase 4 (Teranga Taxi)

Document destiné à Claude Code, même esprit que les DEV_SPEC précédents. Suite de
`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §4 (Cas 3) et §11 (Phase 4). Réutilise le vivier
chauffeurs, le dispatch et la tarification à la distance construits en Phase 2/3.

**Rappel du gate d'entrée (roadmap §11)** : le lancement PUBLIC de Teranga Taxi est
conditionné à une conformité transport spécifique (arrêté 067/M-DB) et à une densité de
chauffeurs suffisante — décision commerciale/réglementaire, pas technique. Ce chantier livre
la **capacité technique**, pas l'activation publique : rien n'empêche de merger ce code et de
ne l'exposer qu'une fois le feu vert obtenu (la filière "Mobilité" reste désactivable via
`trade_categories.isActive`, déjà le mécanisme existant).

**Hors périmètre explicite** :
- Photo du chauffeur — aucune infrastructure d'upload de photo de profil prestataire
  n'existe aujourd'hui (`Provider` n'a pas de colonne photo). Ajouter cette fonctionnalité
  serait un chantier à part entière, pas une extension mineure. La plaque et la note
  suffisent pour l'identification véhicule à ce stade.
- Nouveau rôle "opérateur" — non demandé, reste porté par `role='admin'` (global ou
  scopé pays/région, donc y compris les masters), cohérent avec `/:id/assign` déjà
  restreint à `requireRoles('admin')`.
- SMS/USSD — toujours hors périmètre (§5 du brainstorm), le canal téléphone reste un humain
  (opérateur) qui saisit la course, pas une intégration télécom.

---

## 0. Contexte — état vérifié avant toute chose

- **Rien n'empêche déjà un client de commander une mission filière "Mobilité"** aujourd'hui —
  `trade_categories` "Mobilité" est `isActive: true` depuis la Phase 2, et
  `mission.controller.js exports.create` n'a aucune garde qui la réserverait à l'usage
  interne. Le seul frein était fonctionnel : le wizard ne capture qu'un seul point
  (destination), donc une course commandée aujourd'hui n'aurait pas de point de départ —
  inutilisable en pratique pour un chauffeur.
- **Le retrait obligatoire existe déjà, mais seulement pour `slug === 'livraison'`**
  (`mission.controller.js` ligne ~273, Phase 3 Lot 1) — Teranga Taxi a besoin exactement du
  même mécanisme (point de départ obligatoire), juste étendu à `'mobilite'`.
- **Le dispatch (fenêtre d'acceptation 90s) est déjà partagé Mobilité + Livraison** depuis la
  Phase 3 Lot 3 (`['mobilite', 'livraison'].includes(tradeCategory?.slug)`) — rien à changer.
- **La tarification à la distance (Phase 3 Lot 2) est déjà générique** — fonctionne pour
  n'importe quelle filière dès qu'une règle `MissionPricingRule` a `pricePerKm` renseigné et
  que retrait+dépose sont connus. Il suffira de semer une règle pour "Mobilité" si aucune
  n'existe déjà.
- **`Provider.toPublicDTO()` n'expose jamais `plateNumber`** (Phase 2 : anonymisation stricte,
  légitime pour un déplacement interne où l'identité du chauffeur importe peu au client final,
  qui de toute façon ne voyait pas cette sous-mission). Pour Teranga Taxi, le client attend
  physiquement un véhicule identifiable — la plaque doit être visible, mais **seulement pour
  une mission filière Mobilité**, jamais ailleurs (pas de changement de comportement pour les
  missions métier/livraison).
- **Le point d'entrée invité (`missionRequest.controller.js`) pose les cookies d'auth du
  compte client trouvé/créé dans la réponse** — le réutiliser tel quel depuis le navigateur
  d'un opérateur écraserait la session de l'opérateur par celle du client appelant. Ce n'est
  pas réutilisable tel quel malgré la formulation du brainstorm ("probablement en réutilisant
  le point d'entrée technique existant") — voir §3 pour la solution retenue.

---

## 1. Course directe filière Mobilité (Cas 3)

### 1.1 Backend

`mission.controller.js exports.create` : élargir la condition de retrait obligatoire de
`tradeCategory?.slug === 'livraison'` à `['livraison', 'mobilite'].includes(tradeCategory?.slug)`
— même bloc, même géocodage, même message d'erreur générique (déjà correct pour les deux cas).

### 1.2 Frontend

`LocationStep.jsx`/`MissionCreationWizard.jsx` : le calcul `isDelivery` (Phase 3 Lot 1) devient
`requiresPickup`, vrai pour `slug === 'livraison'` OU `slug === 'mobilite'`. Le libellé du bloc
retrait doit changer selon la filière (un colis se "retire", un passager "monte") :
- Livraison : "Point de retrait" / "Point de dépose" (inchangé).
- Mobilité : "Point de départ" / "Destination".

Même règle pour `ConfirmStep.jsx` et `MissionTrackingPage.js` (labels déjà factorisés en clés
i18n `missionCreation.location.pickupTitle`/`dropoffTitle` et
`missionTracking.pickupLabel`/`dropoffLabel` — dupliquer en variante Mobilité plutôt que
détourner le sens des clés existantes).

---

## 2. Réputation visible enrichie (plaque)

`Provider.toPublicDTO()` : ajouter un paramètre optionnel `{ includePlate = false }` — quand
`true`, ajoute `plateNumber` au DTO. Défaut `false` partout (aucune régression ailleurs).

`mission.controller.js exports.track` : passer `includePlate: tradeCategorySlug === 'mobilite'`
lors de l'appel à `provider.toPublicDTO()`.

`MissionTrackingPage.js` : afficher la plaque à côté du nom du chauffeur quand
`track.provider?.plateNumber` est présent.

---

## 3. Canal téléphone / opérateur

Pas de réutilisation directe de `missionRequest.controller.js` (contamination de session, voir
§0). Nouveau point d'entrée **authentifié**, réservé à `role='admin'` (global ou master
scopé) :

### 3.1 Backend

`POST /api/v1/missions/phone-order`, `auth` + `requireRoles('admin')`. Réutilise la logique
"trouver ou créer le client par téléphone" de `missionRequest.controller.js` (même primitives
`normalizePhone`/`isValidPhone`/`resolveGeoScope`/`countryHasActiveMaster`), MAIS :
- Ne pose **aucun cookie d'auth** dans la réponse (l'appelant de l'endpoint est l'opérateur,
  pas le client — poser les cookies du client écraserait la session de l'opérateur).
- Si le compte client existe déjà, **pas de vérification de PIN** (l'opérateur n'a pas le PIN
  du client au téléphone) — l'autorisation vient du rôle admin de l'appelant, pas d'un secret
  client. Différence assumée avec le flux invité homepage (qui, lui, doit vérifier le PIN car
  n'importe qui peut l'appeler).
- Capture retrait + dépose comme `exports.create` (§1.1), obligatoire pour la filière
  choisie (mobilité ou livraison — l'opérateur peut aussi enregistrer une livraison
  téléphonique, même mécanisme).
- Calcule l'estimation (`estimateMission`) pour renseigner `budget`, comme `exports.create`.
- Retourne la mission créée (`missionStatus: 'CREATED'`), directement exploitable pour
  affectation (l'opérateur enchaîne sur `/:id/assign` depuis la même vue).

### 3.2 Frontend

Nouvelle page admin `AdminPhoneOrderPage.jsx` (route `/admin/phone-orders`, lien depuis la
navigation admin existante) : formulaire simple (téléphone, prénom, filière, point de
départ/retrait, destination) réutilisant `LocationAutocompleteInput`/`MissionLocationMap`
(mêmes composants que le wizard client). Après création, redirige vers
`AdminServicesPage.js`/la vue d'affectation existante — pas de nouvelle UI de dispatch, celle
de la Phase 2 Lot 5 suffit déjà.

---

## 4. Rôles et permissions

- `POST /missions/phone-order` : `admin` uniquement (global ou master scopé), même
  restriction que `/:id/assign`.
- Aucun autre changement de permission — un client qui commande "Mobilité" directement suit
  exactement le même chemin (création → dispatch → suivi) qu'un client qui commande
  "Livraison" depuis la Phase 3.

---

## 5. Plan de livraison suggéré

1. **Course directe Mobilité** (§1) — prérequis, réutilise entièrement Phase 3 Lot 1.
2. **Plaque visible** (§2) — indépendant, faible risque.
3. **Canal opérateur** (§3) — dépend de rien d'autre, le plus gros morceau (nouvel endpoint +
   nouvelle page admin).

---

## 6. Ce qu'il ne faut surtout pas faire

- Ne pas réutiliser `missionRequest.controller.js` tel quel pour le canal opérateur (§0/§3) —
  contamination de session.
- Ne pas exposer `plateNumber` pour les autres filières (§2) — anonymisation stricte
  inchangée partout ailleurs.
- Ne pas construire de photo de profil chauffeur — hors périmètre explicite (voir en-tête).
- Ne pas activer publiquement la filière Mobilité pour les clients tant que le gate
  réglementaire (arrêté 067/M-DB) n'est pas validé côté métier — ce chantier livre la
  capacité, l'activation reste une décision business (`trade_categories.isActive` /
  ouverture progressive par pays).
