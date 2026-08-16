# Spécification de développement — Teranga v5 / Phase 2 (mobilité interne)

Document destiné à Claude Code, même esprit que `DEV_SPEC_TERANGA_v4_PHASE0.md`. Suite de
`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §4 (Cas 1) et §6 (dispatch) — Phase 2 de la feuille de
route (§11) : le vivier "mobilité" et le mécanisme de dispatch sont construits et testés en usage
**interne uniquement** (déplacer un agent/prestataire vers un lieu de mission), invisibles du
client, avant toute exposition publique (Teranga Taxi = Phase 4).

**Hors périmètre explicite** : Teranga Taxi (commande client), Livraison client, tout ce qui
expose le vivier mobilité au public. Ce document ne couvre que la logistique interne.

---

## 0. Contexte — état vérifié avant toute chose

- **Filière "Mobilité" absente de `trade_categories`** — contrairement à "Livraison / Courses"
  (déjà seedée au Lot 1, jamais utilisée). Seules actives aujourd'hui : plomberie, électricité,
  climatisation, ménage, peinture, livraison.
- **`providers`** a déjà `hasLiabilityInsurance`/`insuranceExpiresAt`/`badgeCertified`/
  `disputesAgainstCount` — **aucun champ plaque d'immatriculation, carte de circulation, ou
  disponibilité déclarative**.
- **`services`** ne porte qu'une seule adresse (`address`/`latitude`/`longitude`, la destination).
  Aucune notion de retrait/dépose à deux points, aucune notion de mission "enfant" rattachée à une
  mission "parent".
- **`mission.controller.js` exports.assign`** : l'assignation d'un prestataire passe directement
  à `ASSIGNED` sans étape de confirmation — pas de fenêtre d'acceptation, pas de timeout, pas de
  fallback vers un autre exécutant. C'est la brique que ce document ajoute.
- **Scheduler existant** (`node-cron`, Lot 2 Phase 0) : `missionThresholdCheck.job.js` et
  `disputeEscalation.job.js` tournent déjà toutes les 15 min — même mécanisme réutilisé ici, pas
  de nouvelle dépendance.

---

## 1. Filière "Mobilité"

Seeder additif, même motif que `20260725150000-seed-livraison-trade-category.js` :
`{ name: 'Mobilité', slug: 'mobilite', requires_company: false, default_warranty_days: 0 }`. Pas
de seuils de professionnalisme par défaut dans ce lot (le tableau `docs/DEV_SPEC_TERANGA_v4_PHASE0.md`
§1.1 proposait 5 min/5-7 min pour "Teranga Taxi" — hors périmètre ici, seedé `NULL` volontairement ;
à fixer au moment de la Phase 4).

---

## 2. Checklist d'onboarding chauffeur

### 2.1 Colonnes additives sur `providers`

```sql
ALTER TABLE providers
  ADD COLUMN plate_number VARCHAR(20) NULL,
  ADD COLUMN circulation_card_number VARCHAR(50) NULL,
  ADD COLUMN circulation_card_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

Conformité arrêté municipal Bamako n°067/M-DB (`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §2) :
plaque + carte de circulation obligatoires. `hasLiabilityInsurance`/`insuranceExpiresAt` déjà
existants couvrent l'assurance — pas de nouvelle colonne nécessaire pour ce volet.

### 2.2 Où c'est renseigné

Formulaire `AdminProvidersPage.jsx` existant (Lot 1) — ajouter les trois champs uniquement
lorsque la filière sélectionnée inclut "Mobilité" (cohérent avec `requires_company` déjà
conditionnel par filière dans ce même formulaire). Pas de nouvelle page.

### 2.3 Contrainte de passage à `active`

Un prestataire couvrant la filière Mobilité ne doit pas pouvoir passer au statut `active`
(`providerStatus.js`, machine à états existante) sans `plate_number` ET
`circulation_card_verified = true` ET `has_liability_insurance = true`. Vérification ajoutée dans
`provider.controller.js` (transition de statut), pas une contrainte SQL — un prestataire couvrant
d'autres filières uniquement n'est pas concerné.

---

## 3. Disponibilité déclarative + vue "chauffeurs disponibles par zone"

### 3.1 Colonne additive sur `providers`

```sql
ALTER TABLE providers
  ADD COLUMN availability_status ENUM('available','busy','offline') NOT NULL DEFAULT 'offline';
```

Pas de position GPS continue (décision actée, Phase 0) — une simple présence déclarée,
volontairement grossière.

### 3.2 Endpoint chauffeur

`PATCH /api/v1/providers/me/availability` — body `{ availabilityStatus }`, réservé au prestataire
authentifié pour **son propre** enregistrement (`findProviderForUser`, déjà utilisé ailleurs dans
`mission.controller.js`). Un prestataire non scopé sur la filière Mobilité peut aussi s'en servir
sans dommage (champ inoffensif pour les autres filières) — pas de restriction filière ici, pour ne
pas complexifier inutilement.

### 3.3 Vue admin/master

`GET /api/v1/providers/available` — scope géographique (même pattern que `listForAdmin` ailleurs),
filtré `availabilityStatus='available'`, `status='active'`, filière Mobilité. Utilisée par la vue
de dispatch (§5).

---

## 4. Sous-mission "mobilité interne" (Cas 1)

### 4.1 Colonnes additives sur `services`

```sql
ALTER TABLE services
  ADD COLUMN parentServiceId INT UNSIGNED NULL,   -- mission mère (association logique, pas de FK physique — cohérent avec providerId/tradeCategoryId déjà sur cette table)
  ADD COLUMN pickupAddress VARCHAR(255) NULL,
  ADD COLUMN pickupLatitude DECIMAL(10,7) NULL,
  ADD COLUMN pickupLongitude DECIMAL(10,7) NULL;
```

`address`/`latitude`/`longitude` existants restent la **dépose** — cohérent avec la décision déjà
actée pour la livraison (`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §4, Cas 2).

### 4.2 Déclenchement

Un exécutant (agent ou prestataire) assigné à une mission active signale un besoin de transport —
nouveau bouton sur `MissionTrackingPage.js` (visible uniquement `isExecutor === true`, statuts
`ASSIGNED`/`EN_ROUTE`), qui capture sa position actuelle (`navigator.geolocation`, même pattern que
`LocationStep.jsx`) et appelle `POST /api/v1/missions/:id/logistics-request`.

Le contrôleur (`mission.controller.js`, nouvelle fonction `requestLogistics`) :
1. Vérifie que l'appelant est bien l'exécutant de la mission (agent superviseur exclu, même
   logique que `updateStatus`).
2. Crée une mission enfant : `parentServiceId = mission mère`, `tradeCategoryId` = Mobilité,
   `executionType = 'provider'`, `pickupLatitude/pickupLongitude` = position transmise,
   `latitude/longitude` = ceux de la mission mère (dépose), `missionStatus = 'SEARCHING_EXECUTOR'`,
   `clientId` = client de la mission mère (association technique requise par le schéma, **jamais
   notifié** pour cette sous-mission).
3. N'envoie **aucune notification au client** — c'est une mécanique interne, invisible.

### 4.3 Clôture

À la confirmation de dépose par l'exécutant transporté (`POST /api/v1/missions/:id/status` avec
`toStatus: COMPLETED` puis auto-`VALIDATED`, pas de preuve photo requise pour cette catégorie —
`EXECUTOR_TRIGGERABLE` déjà permissif, juste vérifier que la catégorie Mobilité ne déclenche pas
l'exigence de preuve ailleurs dans le code), la sous-mission se termine ; la mission mère continue
son propre cycle sans aucune dépendance technique entre les deux au-delà de `parentServiceId`
(traçabilité/statistiques seulement).

### 4.4 Fallback explicite

Si `NO_EXECUTOR_FOUND` sur la sous-mission (timeout dispatch, §5) : notifier l'exécutant qu'aucun
chauffeur n'est disponible, **ne jamais bloquer la mission mère** — elle continue son cours normal,
l'exécutant se débrouille par ses propres moyens (décision déjà actée).

---

## 5. Dispatch : affectation rapide + fenêtre d'acceptation

### 5.1 Vue de dispatch (admin/master/opérateur)

Écran listant les missions filière Mobilité en `SEARCHING_EXECUTOR` dans le scope de
l'admin/master, avec en regard la liste des chauffeurs disponibles (§3.3) de la même zone —
affectation en un clic (réutilise `POST /:id/assign` existant, pas de nouvel endpoint
d'affectation).

### 5.2 Fenêtre d'acceptation — extension du modèle, pas de nouveau statut

Nouvelle colonne additive `services.acceptanceDeadlineAt` (DATETIME nullable). Posée par
`exports.assign` au moment où `providerId` est renseigné **et** que la mission est de filière
Mobilité (autres filières : comportement inchangé, colonne reste `NULL`) : `now() + 90 secondes`.

- `POST /api/v1/missions/:id/accept` (prestataire assigné) : `acceptanceDeadlineAt = NULL`,
  mission continue normalement (`EN_ROUTE` déclenché ensuite par l'exécutant comme aujourd'hui).
- `POST /api/v1/missions/:id/decline` (prestataire assigné) : retour à `SEARCHING_EXECUTOR`,
  `providerId = NULL`, `acceptanceDeadlineAt = NULL`, notifie le master (même canal que le reste).

### 5.3 Job de timeout — même scheduler, nouveau job dédié

`backend/src/jobs/logisticsAcceptance.job.js` (même cadence 15 min, ou plus courte — **à trancher
avec toi**, une fenêtre de 90s vérifiée seulement toutes les 15 min est en pratique un timeout de
~15 min, pas 90s ; proposer un intervalle dédié plus court, ex. 1 min, pour ce job précis) : missions
avec `acceptanceDeadlineAt` dépassé → même traitement que `decline` ci-dessus (retour
`SEARCHING_EXECUTOR`), notification master.

---

## 6. Rôles et permissions

Aucun nouveau rôle. `PATCH .../availability` et `POST .../accept|decline` réservés au prestataire
concerné (vérification `findProviderForUser` + comparaison à `service.providerId`, même garde que
`updateStatus`/`pingLocation` déjà en place).

---

## 7. Plan de livraison suggéré

1. **Filière Mobilité** (§1) — trivial, seeder seul.
2. **Checklist onboarding chauffeur** (§2) — colonnes + formulaire admin + contrainte de passage
   `active`.
3. **Disponibilité déclarative + vue chauffeurs disponibles** (§3) — indépendant du reste, peut
   être testé seul (toggle + liste) avant que la moindre sous-mission existe.
4. **Sous-mission mobilité interne** (§4) — dépend de 1 et 2.
5. **Fenêtre d'acceptation + job de timeout** (§5) — dépend de 3 et 4 ; c'est la brique la plus
   neuve, à tester en isolation (comme les jobs de la Phase 0) avant intégration complète.

---

## 8. Ce qu'il ne faut surtout pas faire

- Ne pas exposer le vivier mobilité à un client ou une commande — Phase 2 est strictement interne.
- Ne pas ajouter de tracking GPS continu (décision déjà actée) — disponibilité déclarative
  uniquement.
- Ne pas toucher `services.address/latitude/longitude` en place — rester additif
  (`pickupAddress/pickupLatitude/pickupLongitude`).
- Ne pas construire l'auto-matching (Distance Matrix) — affectation manuelle admin/master comme
  partout ailleurs dans ce projet jusqu'ici.
- Ne pas dupliquer un système de notification — tout passe par `emitEvent()` existant.

---

## 9. Deux points à trancher avec toi avant/pendant l'implémentation

1. **Fréquence du job de timeout d'acceptation** (§5.3) — 90s de fenêtre mérite une vérification
   plus fréquente que 15 min (sinon un chauffeur qui n'accepte pas bloque la mission ~15 min avant
   réaction). Je proposerai 1 minute pour ce job spécifique, distinct des jobs Phase 0 — confirme
   si ça te va.
2. **Un prestataire "Mobilité" doit-il être exclusivement dédié à cette filière**, ou peut-il aussi
   couvrir plomberie/électricité en parallèle ? Le schéma `provider_trade_categories` le permet
   déjà techniquement (many-to-many) — je pars du principe que oui, sauf avis contraire.
