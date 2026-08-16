# Spécification de développement — Teranga v4 / Phase 0 (piliers de confiance)

Document destiné à Claude Code, dans le même esprit que `docs/DEV_SPEC_TERANGA_v3.md` : décrit CE QUI
DOIT ÊTRE CONSTRUIT, sur QUELLE BASE existante, et QUELLES RÈGLES respecter. Suite directe de
`docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` (synthèse stratégique) — ce document couvre uniquement la
**Phase 0** de la feuille de route (§11 de ce fichier) : durcissement du cœur déjà en production.

**Hors périmètre explicite de ce document** : mobilité interne, livraison, Teranga Taxi, marketplace
immobilière (leurs gates de lancement ne sont pas encore ouverts, voir roadmap), et toute refonte
UI/UX (séquence explicitement demandée : intégrations d'abord, UI/UX ensuite).

---

## 0. Contexte — état vérifié du code avant toute chose

- **Machine à états mission** : `backend/src/constants/missionStatus.js`, transitions dans
  `backend/src/services/missionStatus.service.js` — `DISPUTED` est une valeur d'ENUM, transitions
  `COMPLETED → DISPUTED → RESOLVED_REFUND|RESOLVED_REDO|RESOLVED_CLOSED` déjà définies. **Aucune donnée
  structurée de litige n'existe** (pas de motif, description, preuve client, décision) — seul le
  changement de statut est journalisé.
- **`mission_status_history`** (`backend/migrations/20260724103500-create-mission-status-history.js`) :
  `service_id`, `from_status`, `to_status`, `actor_type`, `actor_id`, `created_at`, index sur
  `[service_id, created_at]`. C'est la source fiable pour calculer un temps écoulé depuis le dernier
  changement de statut — ne pas dupliquer cette info ailleurs.
- **Infra de notification déjà en place, à réutiliser telle quelle** : `emitEvent()`
  (`backend/src/services/activity.service.js:71-147`) crée une `Activity` (audit) + une ou plusieurs
  `Notification` par destinataire (`backend/models/notification.js`,
  `backend/migrations/20260214163000-create-notifications.js`). Pas de websocket ni email dans ce
  flux — uniquement base de données, consultée via `notification.controller.js`. **Tout nouveau système
  d'alerte de ce document doit passer par `emitEvent()`, pas par un nouveau canal.**
- **Aucune infrastructure de job planifié/cron n'existe dans ce backend** (pas de `node-cron`,
  `agenda`, `bull`, aucun dossier `cron/`/`scheduler/`, rien dans `package.json`). C'est le premier
  chantier de ce type sur ce projet — voir §2.2 pour le choix technique.
- **`providers`** (`backend/migrations/20260724103200-create-providers.js`) : `average_rating`,
  `completed_missions_count`, `badge_certified` existent déjà. **Aucun compteur de litiges.**
  `badge_certified` est un booléen sans logique de calcul associée aujourd'hui.
- **`evidences`** (`backend/models/evidence.js`) : aucune colonne latitude/longitude. Le frontend a déjà
  le pattern `navigator.geolocation.getCurrentPosition()` utilisé dans
  `frontend/src/features/mission-creation/steps/LocationStep.jsx:33-42` — à réutiliser pour la capture
  de position au moment de l'upload de preuve, pas un nouveau pattern.
- **Géocodage `properties`/`projects`** : déjà livré et en production (commit `7052dd9`, 2026-07-27) —
  **ne pas re-livrer**, seulement s'appuyer dessus pour la comparaison de proximité (§5).

---

## 1. Seuils de professionnalisme par filière

### 1.1 Données (colonnes additives sur `trade_categories`)

```sql
ALTER TABLE trade_categories
  ADD COLUMN intake_threshold_minutes INT NULL,   -- délai de prise en charge attendu
  ADD COLUMN alert_threshold_minutes INT NULL;    -- délai avant alerte automatique
```

Seeder de mise à jour (pas une nouvelle table — relation 1:1 avec `trade_categories`) appliquant les
valeurs de `docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §8.1 :

| slug | intake_threshold_minutes | alert_threshold_minutes |
|---|---|---|
| `electricite` | 60 | 120 |
| `plomberie` | 90 | 180 |
| `climatisation` | 180 | 180 |
| `menage` | 1440 | 2880 |
| `peinture` | 2880 | 4320 |
| `livraison` | 25 | 45 |

Colonnes nullables : une filière sans seuil défini n'est simplement jamais vérifiée par le job (§1.2),
plutôt que de planter sur une valeur manquante.

### 1.2 Job de vérification périodique

**Premier scheduler du projet — choix technique : `node-cron`.** Tourne dans le process backend
existant (pas de nouveau service Redis/worker à opérer, cohérent avec le principe de ne pas ajouter de
complexité opérationnelle que l'équipe n'a pas encore les moyens de gérer). Nouveau fichier
`backend/src/jobs/missionThresholdCheck.job.js`, enregistré au démarrage du serveur, cadence proposée :
toutes les 15 minutes.

Logique :
1. Sélectionner les missions dont `missionStatus` est actif et non terminal (`SEARCHING_EXECUTOR`,
   `ASSIGNED`, `EN_ROUTE`, `ON_SITE`, `IN_PROGRESS`) et dont la `tradeCategory` associée a un
   `alert_threshold_minutes` défini.
2. Pour chacune, dernière ligne `mission_status_history` (déjà indexée par `service_id, created_at`) →
   temps écoulé depuis `created_at`.
3. Si dépassement du seuil ET pas déjà alertée : appeler `emitEvent()` vers le(s) master(s) du scope
   géographique de la mission (réutilise `providerScope`/geo scope existant).
4. **Idempotence** : nouvelle colonne additive `services.thresholdAlertSentAt` (DATETIME nullable) —
   posée au moment de l'alerte, réinitialisée à `NULL` à chaque transition de statut (dans
   `missionStatus.service.js`, même transaction que l'écriture `mission_status_history`) pour permettre
   une nouvelle alerte si la mission se re-bloque à une étape suivante.

---

## 2. Parcours de litige enrichi

### 2.1 Nouvelle table `mission_disputes`

```sql
CREATE TABLE mission_disputes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_id INT NOT NULL,
  opened_by INT NOT NULL,              -- FK users (client)
  reason ENUM('non_conforme','retard','comportement','autre') NOT NULL,
  description TEXT NOT NULL,
  client_evidence JSON NULL,           -- références fichiers (même stockage que evidence.controller)
  status ENUM('open','investigating','resolved') DEFAULT 'open',
  resolution ENUM('refund','redo','closed') NULL,
  resolution_notes TEXT NULL,          -- obligatoire à la résolution (contrainte applicative, pas SQL)
  handled_by INT NULL,                 -- FK users (master qui traite)
  first_contact_at DATETIME NULL,
  decided_at DATETIME NULL,
  escalated_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (opened_by) REFERENCES users(id),
  FOREIGN KEY (handled_by) REFERENCES users(id)
);
```

### 2.2 Flux

- **Ouverture** — `POST /api/v1/missions/:id/disputes` : crée la ligne `mission_disputes`, déclenche la
  transition `missionStatus` existante `COMPLETED → DISPUTED` (via `missionStatus.service.js`, ne pas
  dupliquer cette logique), puis **synchrone, pas via le job** : `emitEvent()` accusé de réception au
  client + `emitEvent()` alerte immédiate au master du scope. L'accusé de réception au client doit
  inclure le délai engagé (4h) dans le message.
- **Vérification temporisée** — même job que §1.2 (ou job dédié `disputeEscalation.job.js`, à trancher
  à l'implémentation selon lisibilité) :
  - `first_contact_at IS NULL` et > 4h depuis `created_at` → alerte renforcée au master (même canal).
  - `decided_at IS NULL` et > 24-48h → notification "mise à jour" au client (pas de résolution, juste
    ne jamais laisser le silence s'installer, cf. §8.2 du brainstorm).
  - `status != 'resolved'` et > 48h depuis `created_at` → `escalated_at` renseigné + `emitEvent()` vers
    `country_admin`/`super_admin` du pays concerné. **Seule exception actée au principe "un seul niveau
    d'alerte"** (voir brainstorm §8.2, point 8).
- **Résolution** — `PATCH /api/v1/missions/:id/disputes/:disputeId` : `resolution` +
  `resolution_notes` obligatoires (validation Joi, pas de résolution sans justification écrite) →
  déclenche la transition `missionStatus` existante `DISPUTED → RESOLVED_*` correspondante, renseigne
  `decided_at`.

### 2.3 Compteur de litiges par prestataire

Colonne additive `providers.disputes_against_count` (INT, défaut 0). Incrémentée uniquement quand
`resolution IN ('refund', 'redo')` — un litige clôturé en `'closed'` (non fondé) ne compte pas contre le
prestataire.

---

## 3. Réputation visible + badge Certifié Teranga

### 3.1 Affichage à la transition `ASSIGNED`

Le payload déjà renvoyé au client au moment de la prise en charge (endpoint de détail mission déjà
consulté pour le suivi — à identifier et enrichir, pas de nouvel endpoint) doit inclure :
`displayFirstName`, `completedMissionsCount`, `averageRating`, `badgeCertified` du prestataire assigné
(champs déjà en base, juste pas encore exposés à ce moment précis du parcours).

### 3.2 Critères du badge — logique de calcul, pas un flag manuel

Nouvelle fonction `backend/src/services/providerBadge.service.js`, recalcul déclenché de façon
synchrone à deux moments (pas un job séparé) : à la clôture d'une mission (`missionStatus →
VALIDATED/CLOSED`) et à la résolution d'un litige (§2.2) :

- `completed_missions_count >= 15` (seuil de départ, ajustable après calibration réelle)
- `disputes_against_count == 0`
- Aucun litige `status IN ('open', 'investigating')` en cours sur ce prestataire

**Le badge doit pouvoir repasser à `false` automatiquement** si les critères cessent d'être remplis —
ce n'est pas un acquis définitif.

*Limite actuelle documentée, pas un bug à corriger dans ce lot* : le respect de la garantie
post-intervention (`trade_categories.default_warranty_days`) n'est pas encore tracé de façon exploitable
(aucun mécanisme de réclamation de garantie distinct du litige général) — hors périmètre de ce document.

---

## 4. Géolocalisation des preuves + vérification de proximité

### 4.1 Données (colonnes additives sur `evidences`)

```sql
ALTER TABLE evidences
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(10,7) NULL,
  ADD COLUMN location_flag ENUM('ok','distant','unknown') NULL DEFAULT 'unknown';
```

Toutes nullables — la géolocalisation ne doit **jamais bloquer** un upload de preuve (permission
navigateur refusée, GPS indisponible, connectivité coupée sont des cas normaux sur ce terrain, pas des
exceptions à traiter comme des erreurs).

### 4.2 Capture côté frontend

Réutiliser exactement le pattern `navigator.geolocation.getCurrentPosition()` déjà présent dans
`LocationStep.jsx` (mission-creation) dans le composant d'upload de preuve — best-effort, l'échec de
géolocalisation n'empêche jamais l'envoi du fichier.

### 4.3 Comparaison de proximité (nouvelle fonction utilitaire)

`backend/src/utils/evidenceProximity.js` — distance haversine entre `evidence.latitude/longitude` et
la position connue de la ressource associée à la mission (`service.latitude/longitude`, déjà géocodé).
Seuil de tolérance proposé : **150-200m** (à calibrer — la précision GPS varie fortement selon
l'appareil et la connectivité sur ce terrain, mieux vaut un seuil large qui évite les faux positifs
qu'un seuil strict qui accuse à tort).

**Ce mécanisme ne bloque jamais rien automatiquement.** Il pose `location_flag = 'distant'` si l'écart
dépasse le seuil, `'ok'` sinon, `'unknown'` si pas de position capturée. C'est une **donnée
d'investigation** exploitée par le master lors du traitement d'un litige (§2) ou d'une vérification
ponctuelle — jamais un rejet automatique de la preuve elle-même.

---

## 5. Retrait de la filière Sécurité/gardiennage

- Migration : `UPDATE trade_categories SET is_active = false WHERE slug = 'securite-gardiennage'` —
  **désactivation, pas suppression physique** (préserve l'historique des missions déjà passées sur
  cette filière, cohérent avec le principe additif du reste du projet).
- Vérifier que les écrans listant les filières actives (`CategoryPicker.jsx`, pages admin de gestion des
  filières) filtrent déjà sur `is_active` avant de considérer ce lot terminé — à confirmer dans le code
  à l'implémentation, pas supposé ici.

---

## 6. Rôles et permissions

**Aucun nouveau rôle.** Les nouveaux endpoints (`mission_disputes`) suivent le RBAC existant : le
client crée/consulte ses propres litiges, l'admin/master agit selon le scope géographique déjà
appliqué ailleurs (`providerScope.js`) — ne pas créer un second système de permission pour ce chantier.

---

## 7. Plan de livraison suggéré

0. **Position sur carte à la création d'un bien/projet** (§10) — quasi sans risque (composant déjà
   existant, aucun changement backend requis), et améliore directement la fiabilité de la comparaison
   de proximité du lot 1 : à livrer en premier.
1. **Géolocalisation des preuves** (§4) — indépendant, aucune autre dépendance dans ce document.
2. **Seuils de professionnalisme + premier scheduler** (§1) — introduit `node-cron`, fondation
   technique dont le lot suivant a besoin.
3. **Parcours de litige enrichi** (§2) — réutilise le scheduler du lot précédent.
4. **Réputation visible + badge** (§3) — dépend du compteur de litiges créé au lot précédent.
5. **Retrait Sécurité/gardiennage** (§5) — indépendant, trivial, peut être fait à tout moment.

---

## 8. Critères d'acceptation (à décliner en tests Jest/Supertest)

- Un dépassement de seuil déclenche une notification au master dans la fenêtre du job, sans notification
  dupliquée au passage suivant tant que le statut n'a pas changé.
- Un litige ouvert génère un accusé de réception au client de façon synchrone (pas dépendant du
  passage du job).
- Un litige non traité après 48h déclenche une notification automatique à `country_admin`/`super_admin`.
- Le badge Certifié Teranga se désactive automatiquement dès qu'un litige défavorable fait tomber le
  prestataire sous les critères définis en §3.2.
- Une preuve envoyée sans permission de géolocalisation accordée par le navigateur n'est **jamais**
  rejetée ou bloquée.
- Aucune régression sur les catégories de mission existantes (électricité, plomberie, ménage, peinture,
  climatisation, livraison) ni sur les missions déjà en cours au moment du déploiement.

---

## 9. Ce qu'il ne faut surtout pas faire

- Ne pas bloquer un upload de preuve sur l'absence ou l'imprécision de géolocalisation.
- Ne pas introduire une dépendance de job lourde (Bull/Redis) pour un besoin qui tient dans `node-cron`
  — pas de nouveau service à opérer pour une équipe qui n'en a pas encore les moyens.
- Ne pas supprimer physiquement la filière Sécurité/gardiennage — désactivation uniquement.
- Ne pas construire de refonte UI/UX dans ce lot — séquence explicitement demandée : intégrations
  d'abord.
- Ne pas toucher aux catégories mobilité interne / livraison / Teranga Taxi / marketplace
  immobilière — leurs gates de lancement (roadmap, `docs/BRAINSTORM_ECOSYSTEME_TERANGA.md` §11) ne sont
  pas encore ouverts.
- Ne pas créer un second système de notification/alerte — tout passe par `emitEvent()` existant.
- Ne pas réécrire `MissionLocationMap` ni la logique de priorité lat/lng des contrôleurs `property`/
  `project` — les deux existent déjà et fonctionnent, voir §10.

---

## 10. Position sur carte à la création d'un bien/projet

### 10.1 Constat vérifié — l'essentiel existe déjà, ne pas le reconstruire

- `PropertiesPage.js` et `ProjectsPage.jsx` utilisent déjà `LocationAutocompleteInput` (recherche
  d'adresse texte avec Google Places), qui renseigne déjà `latitude`/`longitude` dans le state du
  formulaire quand un résultat est sélectionné. **Ce qui manque, c'est uniquement une carte avec un pin
  déplaçable** — pas le géocodage lui-même, déjà en place.
- Le composant `frontend/src/features/mission-creation/MissionLocationMap.jsx`, utilisé dans le
  wizard de création de mission, est **déjà générique et sans aucune dépendance métier mission** — props
  `{ latitude, longitude, onPositionChange, className }`, gère lui-même le SDK Google Maps, le clic pour
  poser un marqueur et le glissé du marqueur. Réutilisable tel quel.
- **Les contrôleurs backend `property.controller.js` et `project.controller.js` acceptent déjà des
  coordonnées explicites en priorité** sur le géocodage de l'adresse texte (vérifié : le géocodage ne se
  déclenche que si `latitude`/`longitude` sont absentes du payload, en création comme en modification).
  **Aucun changement backend n'est nécessaire pour ce lot.**

### 10.2 Ce qu'il faut réellement faire

Dans `PropertiesPage.js` et `ProjectsPage.jsx`, sous le champ `LocationAutocompleteInput` déjà présent,
ajouter `MissionLocationMap` câblé sur le même état de formulaire (`form.latitude`/`form.longitude`),
avec `onPositionChange` qui met à jour ce même état — exactement le pattern déjà utilisé dans
`LocationStep.jsx` du mission-creation (`handleMapPositionChange` → `setCoordinates`). L'autocomplete
texte reste pour la recherche rapide ; la carte permet ensuite d'ajuster précisément la position, comme
c'est déjà le cas pour les missions.

**Pourquoi cette précision compte pour ce document** : une position de bien/projet plus fiable améliore
directement la qualité de la comparaison de proximité preuve↔ressource définie en §4.3 — moins de faux
`location_flag = 'distant'` causés par une adresse mal géocodée plutôt qu'un vrai écart terrain.
