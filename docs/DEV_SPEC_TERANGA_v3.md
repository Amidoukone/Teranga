# Spécification de développement — Teranga v3.0 / v3.1
**Teranga App (UX temps réel + Google Maps) & Teranga Pro (réseau de prestataires qualifiés)**

Document destiné à Claude Code. Il décrit CE QUI DOIT ÊTRE CONSTRUIT, sur QUELLE BASE existante,
et QUELLES RÈGLES respecter (dette technique, conventions du repo, sécurité).
Aucune intégration de paiement in-app dans cette phase — voir section 0.4.

---

## 0. Contexte — à lire avant toute chose

### 0.1 Nature du projet
Teranga est une plateforme "franchise panafricaine" multi-pays (Teranga OS) : gestion de tâches,
commerce (produits/commandes) et fins d'usage client / agent / admin. Un admin scope-limité à un
pays/région agit comme "master" local (= Country Manager dans le business model).

### 0.2 Stack en production — ne pas dévier sans raison documentée
| Couche | Détail |
|---|---|
| Backend | Node.js, Express 5, Sequelize 6, JWT (+ blacklist), bcrypt, Joi, Multer + ImageKit, Jest/Supertest, contrat OpenAPI versionné |
| Frontend | React 19 (Create React App non éjecté), react-router-dom 7, Tailwind CSS, framer-motion, axios, Playwright (E2E) |
| DB | MySQL 8 managée par DigitalOcean (migration depuis PlanetScale le 28/05/2026, pour raisons de coût) |
| Hosting | Frontend sur Netlify (www.teranga-diaspora.com), backend sur Render |
| Médias | ImageKit en option, sinon fallback local sur Render (⚠️ signalé comme risque en cas de redéploiement) |
| CI | GitHub Actions : lint + test back, E2E Playwright. Pas de job de déploiement (Netlify/Render déploient nativement depuis Git) |

### 0.3 Ce qui existe déjà (ne pas recréer, étendre)
L'audit du repo montre que le cœur du modèle v2.0 est déjà implémenté :

| Entité déjà en prod | Équivalent business model |
|---|---|
| `properties` (biens immobiliers) | Visites/vérifications immobilières (section 3.2 du BM) |
| `services` + tâches liées + `evidences` (preuves/upload) | Missions + preuves photo géolocalisées/horodatées (chap. 3) |
| `transactions` (module finance) | Comptabilité des commissions 60/40 (chap. 6) |
| Catalogue produits + commandes | Marketplace (section 5.4) |
| `projects` | Projets structurés (section 4.4) |
| Dashboard finance + métriques admin | Suivi KPI |
| Journal d'activité / audit | Traçabilité |

➡️ **Principe directeur du dev** : la v3.0/v3.1 est une **extension** de `services`/`evidences`/`properties`,
pas une refonte. On ajoute un statut de mission enrichi, une couche de géolocalisation temps réel,
et un nouveau type d'acteur (`providers`), sans casser les modules existants (properties, projects,
catalogue, finance).

### 0.4 Hors périmètre explicite de cette phase
- **Aucune intégration de moyen de paiement in-app** (mobile money, carte...). Le prix reste affiché
  à titre indicatif, le règlement continue de passer par les canaux existants hors-app.
- Ne pas toucher au module `transactions` autrement que pour ajouter les lignes de commission
  différenciées par type de mission (voir 3.5).

### 0.5 Dette technique à connaître (impacte directement ce chantier)
Ces points **doivent être traités en même temps** que les nouvelles fonctionnalités, car ils les
rendraient fragiles sinon :

| Dette | Pourquoi elle bloque cette phase | Action requise dans ce chantier |
|---|---|---|
| Double montage API `/api` (legacy) et `/api/v1`, sans dépréciation formelle | Toute nouvelle route doit avoir un seul chemin canonique | **Toutes les nouvelles routes vont exclusivement sous `/api/v1`**. Ajouter un header `Deprecation` sur les routes `/api` équivalentes si elles existent, sans les casser. |
| Colonnes géographiques nullable partout, pas de contrainte stricte | Le tracking GPS temps réel et le matching par proximité (Distance Matrix) ne peuvent pas tourner sur des coordonnées absentes ou invalides | Rendre `latitude`/`longitude` **obligatoires et validées (Joi)** sur toute création de mission et de position agent/prestataire à partir de cette phase. Migration de nettoyage des données existantes en amont (script de backfill + rapport des lignes orphelines). |
| Pas de contraintes FK en base (relations gérées uniquement côté Sequelize) | Le réseau de prestataires introduit des relations sensibles (mission ↔ prestataire ↔ contrat ↔ filière) où une orpheline est un risque métier (facturation, garantie) | Ajouter les **contraintes FK réelles en base** pour toutes les nouvelles tables de ce chantier (voir section 3). Ne pas généraliser aux tables existantes dans ce ticket (risque de régression hors scope) — le signaler comme dette à traiter séparément. |
| Nommage DB hybride snake_case/camelCase | Confusion possible sur les nouvelles tables | Nouvelles tables et colonnes en **snake_case strict** (documenté), mapping Sequelize en camelCase côté modèle comme le reste du repo. |
| `@reduxjs/toolkit`/`react-redux` déclarés mais non utilisés (état géré en Context) | Le tracking temps réel (position live sur carte) va nécessiter un état partagé fréquent (WebSocket/polling) | **Décision à prendre explicitement** (voir 4.4) : soit on active enfin Redux Toolkit pour cet état à haute fréquence de mise à jour, soit on documente pourquoi Context suffit. Ne pas laisser la dépendance inutilisée sans décision. |
| CSP/HSTS incomplets (`docs/AUDIT_PUBLIC_RELEASE.md`) | On ajoute des appels sortants vers Google Maps Platform (scripts tiers, tuiles, XHR) | Mettre à jour la CSP pour autoriser explicitement les domaines Google Maps nécessaires (`maps.googleapis.com`, `maps.gstatic.com`, etc.) **avant** d'activer le SDK en prod. |
| Historique Git tronqué / repo réinitialisé | — | Sans impact direct, mentionné pour info. |

**Avant de commencer**, Claude Code doit lire :
- `docs/MATURITY_STATUS_2026-03-07.md`
- `docs/AUDIT_PUBLIC_RELEASE.md`
- la checklist go-live existante

... et vérifier qu'aucun des points ci-dessus n'est déjà traité différemment de ce qui est décrit ici.

### 0.6 Décisions d'architecture tranchées (état des lieux du schéma réel effectué)

L'inspection du schéma Sequelize réel (modèles `services`, `evidences`, `properties`, `transactions`,
`tasks`, `users`, `countries`) a révélé 4 écarts entre les hypothèses initiales de ce document et le
code. Ils sont tranchés ci-dessous et remplacent les passages correspondants plus loin dans ce
document.

**a) Code pays (FK `providers.country_code`)**
La colonne réelle est `countries.iso_code`, `VARCHAR(2)` (ISO 3166-1 alpha-2) — pas `countries(code)`
en `VARCHAR(5)` comme supposé initialement.
➡️ `providers.country_code VARCHAR(2) NOT NULL REFERENCES countries(iso_code)`. Ne pas élargir
`iso_code` : alpha-2 est le standard international pour un identifiant de pays, aucune raison métier
de l'étendre. La locale/langue est une préoccupation séparée, déjà portée par
`countries.default_language` et l'i18n frontend — ne pas les fusionner.

**b) Statut de mission vs `services.status` / `tasks.status` existants**
Le repo a déjà deux state machines non synchronisées : `services.status` (4 valeurs : created,
in_progress, completed, validated) et `tasks.status` (5 valeurs, avec `cancelled` en plus). Aucun des
deux ENUM ne doit être modifié en place : ils sont lus par le module finance
(`transaction.controller.js`), le dashboard (`dashboard.controller.js`) et les clients `/api` legacy.
➡️ La nouvelle machine à états (section 2) vit dans une **colonne additive**
`services.missionStatus` (nouvel ENUM, camelCase pour rester cohérent avec le reste de la table
`services`), renseignée uniquement pour les missions créées via le nouveau flux
(`execution_type` défini). Une **synchronisation applicative** (dans le service de transition, pas un
trigger DB) met à jour `services.status` legacy vers sa valeur grossière équivalente à chaque
transition :
- `CREATED` / `SEARCHING_EXECUTOR` → `status='created'`
- `ASSIGNED` / `EN_ROUTE` / `ON_SITE` / `IN_PROGRESS` → `status='in_progress'`
- `COMPLETED` → `status='completed'`
- `VALIDATED` / `CLOSED` → `status='validated'`
- `CANCELLED_BY_CLIENT` / `NO_EXECUTOR_FOUND` / `DISPUTED` / `RESOLVED_*` → pas d'équivalent legacy,
  `status` reste figé à sa dernière valeur connue (écart accepté, le legacy n'a pas de notion
  d'annulation/litige sur `services`, à ne pas corriger dans ce ticket).

`tasks.status` n'est pas touché dans cette phase.

**c) Migration de `users.role` (ajout de `provider` et `category_manager`)**
MySQL 8.0.12+ (version en prod) supporte un ALTER ENUM **instantané**
(`ALGORITHM=INSTANT`) tant que les nouvelles valeurs sont ajoutées **en fin de liste**, sans
réordonner ni supprimer les valeurs existantes — pas de verrouillage ni réécriture de table.
➡️ Une seule migration :
```sql
ALTER TABLE users MODIFY COLUMN role
  ENUM('client','agent','admin','provider','category_manager')
  NOT NULL DEFAULT 'client', ALGORITHM=INSTANT;
```
À rejouer en répétition ("rehearsal") sur une copie de la base avant application en prod, comme pour
la migration DigitalOcean.
➡️ `providers` doit porter une colonne `user_id INT NOT NULL UNIQUE REFERENCES users(id)` (absente de
la version initiale de cette spec, corrigée en 3.1) : l'authentification des prestataires réutilise le
JWT existant via `role='provider'`, au lieu d'un second système d'auth — conformément à la règle de la
section 8 ("ne pas dupliquer un système de permission/rôles existant"). `providers.phone_number` /
`providers.email` restent le contact professionnel affiché en interne (admin), distinct des
identifiants de connexion portés par `users`.
➡️ Le scope géo/filière du rôle `category_manager` reste à concevoir au Lot 3 comme prévu ; seule la
valeur d'ENUM est réservée dès le Lot 1 pour éviter un second ALTER risqué plus tard.

**d) Organisation frontend (`src/features/`)**
Le frontend actuel est organisé à plat (`pages/`, `components/`, `services/`, `contexts/`), sans
dossier `features/`. Une réorganisation complète du repo existant n'est pas justifiée par ce chantier
(risque de régression disproportionné, contraire au principe de non-refonte de la section 0.3).
➡️ `src/features/` est introduit **uniquement pour le nouveau code v3** : `features/mission-creation/`,
`features/mission-tracking/`, `features/provider-onboarding/`. Le code existant n'est pas déplacé. Les
nouvelles features consomment les `services/` (clients API) et `contexts/` existants sans les
dupliquer.

### 0.7 Décisions Lot 3 (prises à l'implémentation, 2026-07-25)

**a) Scope filière/géo du rôle `category_manager`** (différé au Lot 3 par la décision 0.6.c)
- **Filière** : nouvelle table `category_manager_trade_categories` (`user_id`, `trade_category_id`,
  clé composite, FK CASCADE), même pattern M:N que `provider_trade_categories` (Lot 1) — un
  category_manager peut auditer plusieurs filières.
- **Géo** : réutilise `users.countryId`/`users.regionId`, déjà en place pour le rôle `admin` scoped
  (pas de second mécanisme, conforme à la section 8). Un category_manager **sans** scope géo est
  considéré national pour sa/ses filière(s) — le modèle métier le définit d'abord par filière, le
  scope géo est une restriction additionnelle optionnelle.
- Autorisation centralisée dans `backend/src/utils/providerScope.js`
  (`canManageProvider`/`getManageableProviderFilter`), utilisée par
  `PATCH /providers/:id/status`, `POST /providers/:id/contracts` et `GET /providers`. Un admin
  **global** passe toujours ; un admin **scoped** (= `country_admin` au sens section 5) est restreint
  au pays de son scope (résolu depuis `providers.country_code` via `countries.iso_code`).

**b) `roles.middleware.js` et `user.controller.js` bloquaient silencieusement les nouveaux rôles**
`requireRoles()` filtrait ses arguments contre une whitelist figée à `client/agent/admin` (il aurait
throw une erreur sur `requireRoles('provider', ...)`), et trois listes en dur dans
`user.controller.js` (`createUser`, `updateUser`, `listByRole`) plus `user.schemas.js` empêchaient
un admin d'assigner `provider`/`category_manager` à un compte. Corrigé au même régime que
`agent`/`client` (pas de garde "global admin only" comme pour `admin`) : c'est le chemin par lequel
un compte devient réellement `provider`/`category_manager` avant de pouvoir utiliser les endpoints
ci-dessous.

**c) Endpoint `GET /api/v1/providers` (liste) ajouté au-delà du tableau 3.3**
La table 3.3 ne liste que `GET /providers/:id`. Sans endpoint de liste, un admin/category_manager
ne peut pas découvrir les candidatures `pending` à traiter — la fonctionnalité "Onboarding admin"
du Lot 3 (section 6) serait inutilisable en pratique. Ajouté avec le même scope que
`GET /providers/:id`, filtrage `?status=`.

**d) `provider_contracts`** créée conformément au schéma 3.1, FK physique vers `providers` (même
justification que les tables Lot 1 : table neuve, vide à la création).

### 0.8 Décisions Lot 2 — homepage comme base d'interactions (2026-07-25)

Extension du périmètre initial du Lot 2 : au-delà de la création de mission guidée *dans l'app*
(section 4.1), la homepage publique (`frontend/src/pages/HomePage.js`) devient un point d'entrée de
demande sans compte préalable, pour que Teranga soit utilisable dès le premier contact (objectif
produit : "premier réflexe" pour un besoin de service en Afrique).

**a) Pas d'OTP/SMS — compte auto-provisionné par téléphone + PIN choisi par le visiteur**
Aucune passerelle SMS n'existe dans ce repo (vérifié : aucune trace Twilio/Africa's Talking/Orange/
Vonage). Plutôt que de simuler un flux OTP non fonctionnel, le formulaire demande téléphone + un
code (PIN, 4 caractères min. — volontairement plus permissif que les 8 caractères de
`/auth/register`, cf. `missionRequest.schemas.js`) :
- Numéro **nouveau** → compte `role='client'` créé avec ce PIN comme mot de passe réel (bcrypt),
  session émise immédiatement (mêmes cookies/JWT que `/auth/login`), codes de récupération générés
  (`rotateRecoveryCodes`, comme `/auth/register`).
- Numéro **déjà connu** → le PIN doit correspondre (bcrypt.compare), sinon 401. **Jamais** de
  connexion silencieuse sur un compte existant — un attaquant ne peut pas usurper une session en
  soumettant le numéro de quelqu'un d'autre.
- Nouveau endpoint public `POST /api/v1/mission-requests` (v1-only, `guestLimiter` : 15 req/15 min/IP)
  dans `missionRequest.controller.js`, réutilisant les primitives déjà exportées de
  `auth.controller.js` (`signAccess`, `issueRefreshToken`, `setAuthCookies`, `resolveGeoScope`,
  `countryHasActiveMaster`, `rotateRecoveryCodes`) plutôt que de dupliquer la logique de session.

**b) Deux familles de demande, aucune extension d'ENUM risquée**
- *Filière/métier* (plombier, électricien, **livraison**...) → `executionType='provider'`,
  `tradeCategoryId` posé, `missionStatus='CREATED'` (nouveau flux Lot 1/3). "Livraison" a été ajoutée
  comme `trade_categories` (seeder `20260725150000-seed-livraison-trade-category.js`), pas comme
  valeur d'ENUM `services.type` — cohérent avec la logique déjà posée au Lot 1/3 : les filières sont
  des données, pas du schéma.
- *Service classique* (course, démarche administrative, paiement, transfert d'argent, "Autre" =
  assistance générale) → `executionType='agent'`, réutilise l'ENUM `services.type` existant tel quel.
- `service.controller.js` (`create`, flux authentifié) a été étendu pour accepter ces mêmes champs
  `executionType`/`tradeCategoryId` en option (rétro-compatible) : la homepage et l'app authentifiée
  partagent désormais la même logique de création, pas deux implémentations parallèles.

**c) Sélecteur pays** : réutilise `GET /franchises/masters` (déjà public, déjà utilisé par
`RegisterPage`) — même règle "pays avec master actif" qu'à l'inscription, pas de nouveau mécanisme.

**d) Portée volontairement limitée** : les 6 cartes WhatsApp existantes (`#actions`) ne sont pas
modifiées dans cette passe — le nouveau formulaire (`#demande`) est une section additionnelle, mise
en avant comme CTA principal du hero. Fusionner les deux (cartes qui pré-remplissent le formulaire
par catégorie) est un bon candidat d'itération future, pas fait ici pour éviter un mapping forcé
entre les 6 catégories marketing existantes et les filières/types réels.

**e) Validé en navigateur réel** (pas seulement via tests API) : Laragon MySQL + `node index.js` +
`npm start`, parcours complet driveé via Chrome — candidature filière ("Livraison") et candidature
classique, session auto-émise visible immédiatement dans la navbar authentifiée, mission visible
dans `/services`. Un bug réel n'aurait pas été détecté par les seuls tests d'intégration backend :
le nouvel endpoint est v1-only mais l'instance axios frontend (`api.js`) cible `/api` (legacy) par
défaut — corrigé en préfixant explicitement `/v1` dans `missionRequests.js`.

---

## 1. Objectifs de cette phase

Deux chantiers fonctionnels, livrables indépendamment mais qui partagent la même infrastructure
technique (géolocalisation, statuts de mission, matching) :

1. **Teranga App** — expérience utilisateur temps réel façon Uber : création de mission guidée,
   suivi en direct sur carte (Google Maps API), statut de mission en direct, accessibilité (mode
   data-light, PWA, multi-langues).
2. **Teranga Pro** — réseau de prestataires qualifiés (ouvriers indépendants et entreprises
   partenaires) intégré au même moteur de missions, avec anonymisation, non-contournement,
   contrats, et commission différenciée.

---

## 2. Machine à états — statut de mission (socle commun aux deux chantiers)

Nouvelle colonne additive `services.missionStatus` (voir décision 0.6.b — ne remplace pas
`services.status` legacy, synchronisé en parallèle pour compatibilité descendante).

```
CREATED
  → SEARCHING_EXECUTOR         (recherche agent OU prestataire)
  → ASSIGNED                   (agent/prestataire affecté)
  → EN_ROUTE                   (déplacement vers le lieu de mission)
  → ON_SITE                    (arrivé sur place)
  → IN_PROGRESS                (exécution en cours)
  → COMPLETED                  (exécutant marque terminé + preuves envoyées)
  → VALIDATED                  (client valide)
  → CLOSED                     (commission calculée, dossier archivé)

Branches d'exception :
  ASSIGNED | EN_ROUTE          → CANCELLED_BY_CLIENT
  SEARCHING_EXECUTOR           → NO_EXECUTOR_FOUND (timeout, alerte Country Manager)
  COMPLETED                    → DISPUTED (réclamation client, voir 3.6)
  DISPUTED                     → RESOLVED_REFUND | RESOLVED_REDO | RESOLVED_CLOSED
```

- Chaque transition doit être **horodatée** et **journalisée** (réutiliser le journal d'activité/audit
  existant plutôt qu'en créer un nouveau).
- Chaque transition déclenche un événement consommé par le frontend (voir 4.2) pour mettre à jour
  l'UI en direct.
- Chaque transition écrit aussi la valeur grossière correspondante dans `services.status` (mapping
  0.6.b), dans la même transaction DB que l'insertion `mission_status_history`, pour que
  `missionStatus` et `status` ne divergent jamais.
- Table dédiée `mission_status_history` (nouvelle) : `id, service_id (FK), from_status, to_status,
  actor_type (client|agent|provider|admin|system), actor_id, created_at`.

---

## 3. Teranga Pro — modèle de données et règles métier

### 3.1 Nouvelles tables

```sql
-- Filières / métiers
CREATE TABLE trade_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,          -- "Plomberie", "Électricité", ...
  slug VARCHAR(100) NOT NULL UNIQUE,
  requires_company BOOLEAN DEFAULT FALSE, -- ex: sécurité/gardiennage souvent entreprise
  default_warranty_days INT DEFAULT 0,    -- garantie post-intervention (13.9)
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME, updated_at DATETIME
);

-- Prestataires (ouvriers indépendants ET entreprises)
CREATE TABLE providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,           -- lien vers users.id, réutilise l'auth JWT existante (rôle 'provider'), voir 0.6.c
  type ENUM('independent','company') NOT NULL,
  legal_name VARCHAR(150),               -- raison sociale si entreprise
  display_first_name VARCHAR(80) NOT NULL, -- seul nom visible du client (13.7)
  rccm_number VARCHAR(50) NULL,          -- obligatoire si type='company'
  phone_number VARCHAR(30) NOT NULL,     -- contact professionnel interne, jamais exposé au client (13.7)
  email VARCHAR(150),
  country_code VARCHAR(2) NOT NULL,      -- ISO 3166-1 alpha-2, aligné sur countries.iso_code (voir 0.6.a)
  status ENUM('pending','probation','active','suspended','revoked') DEFAULT 'pending',
  average_rating DECIMAL(3,2) DEFAULT NULL,
  completed_missions_count INT DEFAULT 0,
  has_liability_insurance BOOLEAN DEFAULT FALSE,
  insurance_expires_at DATE NULL,
  badge_certified BOOLEAN DEFAULT FALSE, -- "Partenaire certifié Teranga"
  created_at DATETIME, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (country_code) REFERENCES countries(iso_code)
);

CREATE TABLE provider_trade_categories (   -- un prestataire peut couvrir plusieurs filières
  provider_id INT NOT NULL,
  trade_category_id INT NOT NULL,
  PRIMARY KEY (provider_id, trade_category_id),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (trade_category_id) REFERENCES trade_categories(id) ON DELETE CASCADE
);

-- Contrat de partenariat (13.6)
CREATE TABLE provider_contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,     -- part Teranga en % (25.00, 10.00, ...)
  non_circumvention_months INT DEFAULT 12,   -- clause 13.6.1
  signed_at DATETIME NOT NULL,
  document_url VARCHAR(255),                 -- contrat scanné/PDF (stockage ImageKit)
  status ENUM('active','terminated') DEFAULT 'active',
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- Position live (agents ET prestataires, réutilisable pour 4.3)
CREATE TABLE executor_locations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  executor_type ENUM('agent','provider') NOT NULL,
  executor_id INT NOT NULL,
  service_id INT NULL,             -- NULL si position "au repos", rempli pendant une mission active
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  recorded_at DATETIME NOT NULL,
  INDEX (executor_type, executor_id, recorded_at),
  FOREIGN KEY (service_id) REFERENCES services(id)  -- adapter au nom réel de la table mission
);

-- Preuves avant/après spécifiques métier (extension d'evidences existant)
-- Réutiliser la table evidences existante en ajoutant une colonne :
ALTER TABLE evidences ADD COLUMN evidence_phase ENUM('before','after','standard') DEFAULT 'standard';

-- Litiges (13.6.2)
CREATE TABLE mission_disputes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_id INT NOT NULL,
  opened_by ENUM('client','admin') NOT NULL,
  reason TEXT NOT NULL,
  resolution ENUM('refund','redo','closed_no_action') NULL,
  resolved_by_admin_id INT NULL,
  created_at DATETIME, resolved_at DATETIME NULL,
  FOREIGN KEY (service_id) REFERENCES services(id)
);
```

> Noms de tables/colonnes confirmés contre le schéma réel (état des lieux effectué) : mission =
> table `services` (camelCase : `countryId`, `regionId`, `createdAt`...), FK pays = `countries.iso_code`
> (pas `code`). Les nouvelles tables de ce chantier (`providers`, `trade_categories`, ...) suivent la
> convention snake_case des tables commerce récentes (`products`, `orders`) comme indiqué en 0.5 ;
> les nouvelles colonnes ajoutées **sur `services` lui-même** (ex. `execution_type`, `missionStatus`)
> restent en camelCase pour rester cohérentes avec le reste de cette table existante.

### 3.2 Extension de la table de mission existante (`services`)

Ajouter (colonnes camelCase, cohérentes avec le reste de la table `services`) :
- `executionType ENUM('agent','provider') NOT NULL DEFAULT 'agent'`
- `providerId INT NULL` (FK vers `providers`)
- `tradeCategoryId INT NULL` (FK vers `trade_categories`, rempli si `executionType='provider'`)
- `missionStatus` : nouvelle colonne, machine à états de la section 2 — **n'écrase pas** `status`
  legacy, voir décision 0.6.b pour la synchronisation
- `warrantyExpiresAt DATETIME NULL` (calculé depuis `trade_categories.default_warranty_days`)

### 3.3 Endpoints API (`/api/v1`)

| Méthode | Route | Description | Rôle requis |
|---|---|---|---|
| `POST` | `/api/v1/providers` | Candidature prestataire (étape 1 onboarding, 13.5) | public authentifié |
| `GET` | `/api/v1/providers/:id` | Fiche prestataire (usage interne admin uniquement — jamais exposée telle quelle au client) | admin, category_manager |
| `PATCH` | `/api/v1/providers/:id/status` | Faire progresser le statut (pending → probation → active, ou suspension) | category_manager, country_admin |
| `POST` | `/api/v1/providers/:id/contracts` | Enregistrer le contrat signé | category_manager |
| `GET` | `/api/v1/trade-categories` | Liste des filières actives | public |
| `POST` | `/api/v1/missions` | Création de mission (guidée, voir 4.1) — remplace/étend l'endpoint services existant | client |
| `POST` | `/api/v1/missions/:id/assign` | Moteur de matching (voir 3.4) déclenché ou affectation manuelle admin | system, admin |
| `PATCH` | `/api/v1/missions/:id/status` | Transition de statut (2.) | agent, provider, client, admin |
| `POST` | `/api/v1/missions/:id/location` | Ping de position pendant une mission active | agent, provider |
| `GET` | `/api/v1/missions/:id/track` | Flux de suivi (position + statut courant) consommé par le frontend carte | client (propriétaire de la mission) |
| `POST` | `/api/v1/missions/:id/dispute` | Ouvrir un litige (13.6.2) | client |
| `PATCH` | `/api/v1/disputes/:id/resolve` | Résoudre un litige | admin |
| `GET` | `/api/v1/missions/:id/messages` / `POST .../messages` | Messagerie masquée client-exécutant (13.6.1, 13.7) | client, agent, provider |

Toutes ces routes doivent avoir un contrat **OpenAPI** documenté (le repo en a déjà un — l'étendre,
pas en créer un second).

### 3.4 Moteur de matching (Distance Matrix)

Service backend `matching.service.js` (nom indicatif) :
1. Filtrer les exécutants (`agents` pour missions simples, `providers` actifs+certifiés pour la
   filière concernée) par disponibilité.
2. Appeler **Google Distance Matrix API** avec la position du client/lieu de mission et la position
   la plus récente (`executor_locations`) de chaque candidat.
3. Trier par ETA réel (pas juste distance à vol d'oiseau) et par note moyenne.
4. Proposer le top candidat (auto-assignation) ou une short-list (choix admin en phase de lancement,
   avant confiance suffisante dans l'auto-matching — décision produit à valider avec l'équipe).
5. **Cache obligatoire** des appels Distance Matrix (coût API) — ne jamais appeler l'API à chaque
   ping de position, seulement lors d'une recherche d'exécutant.

### 3.5 Commission différenciée (13.8)

Ne pas coder les taux en dur : les stocker sur `provider_contracts.commission_rate` (prestataires)
et garder la logique 60/40 existante pour `execution_type='agent'`. Le calcul de commission dans le
module `transactions` doit lire ce taux dynamiquement, pas un pourcentage codé en dur dans le
service de facturation.

### 3.6 Anonymisation et non-contournement (13.6.1, 13.7)

- Le frontend client **ne doit jamais recevoir** `providers.phone_number`, `providers.email`,
  `providers.legal_name` dans aucune réponse API. Sérialiser les prestataires via un DTO dédié
  (`ProviderPublicDTO`) qui n'expose que `display_first_name`, `trade_category`, `average_rating`,
  `completed_missions_count`, `badge_certified`.
- Tout appel/message doit transiter par les endpoints `/messages` (relai applicatif), jamais par un
  numéro affiché en clair. Si un futur besoin d'appel vocal apparaît, prévoir un relais (masking
  téléphonique) plutôt que d'exposer le numéro réel — à cadrer dans un chantier ultérieur.
- Ajouter un test automatisé (Jest/Supertest) qui échoue si un champ sensible de `providers` fuite
  dans une réponse destinée à un rôle `client`.

---

## 4. Teranga App — UX temps réel et Google Maps

### 4.1 Création de mission guidée (< 60 secondes, section 12.2 du BM)

Écran en 4 étapes (React, composants sous `frontend/src/features/mission-creation/` — nouveau dossier
scopé au v3 uniquement, voir décision 0.6.d ; ne pas déplacer les pages/composants existants) :
1. Choix de catégorie (icônes) — inclut désormais les `trade_categories` en plus des types de
   services existants.
2. Lieu : `Places Autocomplete` + carte pour dépose d'épingle + lieux favoris (nouvelle table
   `saved_locations` liée à l'utilisateur, si elle n'existe pas déjà côté `properties`).
3. Description : champ texte court + upload photo (réutiliser Multer/ImageKit existant) + option
   note vocale (nouveau, stockage fichier audio via même pipeline média).
4. Confirmation : prix indicatif + délai estimé, calculé côté backend avant affichage.

### 4.2 Suivi en direct

- Composant carte (`Maps SDK` React) affichant : position de l'exécutant (mise à jour depuis
  `GET /api/v1/missions/:id/track`), statut textuel courant, ETA.
- Mécanisme de mise à jour : **polling raisonnable (ex. toutes les 5-10s) dans un premier temps**,
  pas de WebSocket obligatoire en v1 — le repo n'a pas d'infra websocket existante, ne pas en
  introduire une seule pour ce besoin sans validation explicite. Si la fréquence de mise à jour
  s'avère insuffisante en usage réel, ouvrir un chantier dédié.

### 4.3 Intégration Google Maps Platform — briques et clés

| Brique | Usage | Où |
|---|---|---|
| Maps SDK (Web) | Affichage carte + trajet | Frontend |
| Places API (Autocomplete) | Saisie d'adresse | Frontend |
| Geocoding API | Adresse ↔ coordonnées | Backend (validation à la création de mission) |
| Directions API | Itinéraire + ETA affiché au client | Backend (calcul) + Frontend (affichage tracé) |
| Distance Matrix API | Matching (3.4) | Backend uniquement |
| Geolocation (device) | Position de l'exécutant | App mobile/web de l'agent/prestataire |

- **Clé API séparée** pour les appels backend (restreinte par IP serveur Render) et pour le frontend
  (restreinte par domaine `teranga-diaspora.com`), jamais la même clé des deux côtés.
- Variables d'environnement à ajouter : `GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAPS_BROWSER_KEY`.
- Mettre à jour la CSP (voir 0.5) pour autoriser les domaines Google Maps.
- Prévoir un **budget de quota et une alerte de dépassement** (Distance Matrix et Directions sont
  facturés à l'appel) — mettre en place le cache mentionné en 3.4 avant l'ouverture en prod.

### 4.4 Accessibilité

- Mode "data-light" : compression image côté client avant upload (réutiliser/adapter le pipeline
  Multer existant), tuiles carte basse résolution, file d'attente de synchronisation (retry) en cas
  de perte réseau pendant l'envoi d'une preuve.
- PWA : ajouter un manifest + service worker basique pour permettre l'usage sans app store sur
  téléphones d'entrée de gamme (CRA non éjecté le permet nativement via `cra-template-pwa`
  ou configuration manuelle — à vérifier avant d'éjecter CRA, ce qui serait un changement lourd).
- i18n : introduire une couche de traduction (à choisir : `react-i18next` ou équivalent léger) pour
  français / anglais / wolof / bambara / dioula, en commençant par français + une langue locale
  pilote au Mali.
- **Décision Redux à trancher avant de coder le tracking live (0.5)** : si l'état de position en
  temps réel est géré à haute fréquence sur plusieurs composants (carte, statut, notifications),
  documenter le choix entre activer `@reduxjs/toolkit` (déjà en dépendance) ou rester en Context.
  Ne pas laisser cohabiter les deux sans règle claire.

---

## 5. Rôles et permissions à ajouter/étendre

| Rôle | Nouveau ou existant | Périmètre |
|---|---|---|
| `client` | existant | crée des missions, suit en direct, note, ouvre un litige |
| `agent` | existant | missions simples (chap. 3 du BM) |
| `provider` | **nouveau** | reçoit des missions de sa filière, mêmes obligations de preuve que les agents |
| `category_manager` | **nouveau** | gère l'onboarding et l'audit d'une filière (13.10) — probablement une variante scope-limitée du rôle admin existant, pas un système de permission entièrement séparé |
| `country_admin` (master pays) | existant (à confirmer dans le repo) | coordonne les category managers de son pays |
| `super_admin` | existant | tout accès |

Vérifier dans le repo le système de permission actuel (RBAC ? scopes JWT ?) avant d'ajouter des
rôles — étendre le système existant plutôt que d'en créer un second.

---

## 6. Plan de livraison suggéré (aligné sur la feuille de route business, chap. 12.8 et 13.11)

### Lot 1 — Fondations techniques (prérequis, à faire avant toute UI)
- Nettoyage/validation des colonnes géographiques (0.5)
- Migration ENUM `users.role` (+`provider`, +`category_manager`, `ALGORITHM=INSTANT`, rehearsal
  avant prod — 0.6.c)
- Migration `mission_status_history` + colonne additive `services.missionStatus` + sync vers
  `services.status` legacy (0.6.b) ; extension `evidences` (`evidence_phase`)
- Tables `providers` (avec `user_id`), `trade_categories` (0.6.a, 0.6.c)
- Routage `/api/v1` strict pour toute nouvelle route + plan de dépréciation `/api`
- Clés Google Maps + CSP

### Lot 2 — Teranga App v1
- Création de mission guidée (4.1)
- Geocoding + Directions à la création
- Suivi en direct par polling (4.2)
- Mode data-light basique

### Lot 3 — Teranga Pro v1
- ✅ Table `provider_contracts` (schéma `providers`/`trade_categories`/`provider_trade_categories`
  déjà livré en Lot 1) — livré 2026-07-25
- ✅ Endpoints API `/api/v1/providers` (+ liste, voir 0.7.c), `/api/v1/trade-categories` + validation
  Joi — livré 2026-07-25, v1-only (0.5)
- ✅ Onboarding admin (statuts pending → probation → active, machine à états dans
  `src/constants/providerStatus.js`) — livré 2026-07-25
- DTO d'anonymisation (`Provider.toPublicDTO()`) posé au Lot 1 ; pas encore consommé par un endpoint
  client (aucun endpoint Lot 3 n'expose un provider à un client — voir 3.6, à activer au Lot 4
  matching)
- Matching manuel (choix admin) avant auto-matching : reste à faire (Lot 4)

### Lot 4 — Teranga Pro v2 / optimisation
- Matching automatique via Distance Matrix (3.4)
- Commission différenciée dynamique (3.5)
- Litiges (`mission_disputes`) et garanties par filière
- PWA + i18n complet

---

## 7. Critères d'acceptation (à décliner en tests Jest/Supertest + Playwright)

- Une mission créée sans coordonnées valides doit être **rejetée** par l'API (Joi), jamais acceptée
  avec des valeurs nulles.
- Aucune réponse API destinée à un rôle `client` ne doit contenir `providers.phone_number`,
  `providers.email` ou `providers.legal_name` (test automatisé dédié, voir 3.6).
- Toute transition de statut de mission doit être journalisée dans `mission_status_history` avec
  l'acteur exact.
- Le calcul de commission d'une mission `execution_type='provider'` doit utiliser
  `provider_contracts.commission_rate` et non une valeur codée en dur.
- Un test E2E Playwright doit couvrir le parcours complet : création de mission guidée → matching
  → suivi en direct (mock de position) → validation client → commission calculée.

---

## 8. Ce qu'il ne faut surtout pas faire

- Ne pas coder de logique de paiement in-app (0.4).
- Ne pas exposer les coordonnées d'un prestataire, même "temporairement pour tester" (3.6).
- Ne pas ajouter de nouvelles routes sous `/api` legacy.
- Ne pas éjecter Create React App pour la PWA sans évaluer d'abord les options non destructives.
- Ne pas dupliquer un système de permission/rôles si un système RBAC existe déjà dans le repo —
  l'étendre.
- Ne pas appeler Distance Matrix / Directions à chaque ping de position (coût) — uniquement lors
  d'une recherche de matching ou d'un recalcul d'itinéraire explicite.
- Ne pas réorganiser l'arborescence frontend existante (`pages/`, `components/`, `services/`) : le
  dossier `features/` est additif, scopé aux nouveaux flux v3 (0.6.d).
- Ne pas modifier `services.status` ou `tasks.status` en place : la nouvelle machine à états passe par
  la colonne additive `services.missionStatus`, synchronisée vers `status` (0.6.b).
- Ne pas créer de second système d'authentification pour les prestataires : `providers.user_id`
  réutilise `users`/JWT existant avec `role='provider'` (0.6.c).

---

## 9. Première commande à donner à Claude Code

> "Lis `docs/MATURITY_STATUS_2026-03-07.md` et `docs/AUDIT_PUBLIC_RELEASE.md`, puis inspecte le
> schéma Sequelize actuel des tables `services`, `evidences`, `properties`, `transactions` et le
> système de permissions/rôles existant. Rends-moi un état des lieux précis (noms de tables réels,
> conventions de nommage observées, système d'auth/rôles) avant de commencer le Lot 1 de
> `DEV_SPEC_TERANGA_v3.md`, pour que je puisse ajuster les noms de tables hypothétiques de ce
> document à la réalité du repo."
