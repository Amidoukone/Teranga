# Teranga – Résumé d’intégration multi-pays & franchise

## Objectif
Mettre en place Teranga comme une franchise panafricaine pilotée par un siège central (Teranga OS) et opérée localement par pays/région, afin d’assurer des standards communs tout en permettant l’adaptation locale et l’inclusion de toutes les diasporas africaines.

## Documentation de référence
- [Audit de cohérence et de fiabilité : erreurs silencieuses, bugs et incohérences du 3 novembre 2026](docs/AUDIT_COHERENCE_FIABILITE_2026-11-03.md)
- [Barre supérieure simplifiée : navigation par rôle, territoire, informations et menu de compte](docs/TOPBAR_SIMPLIFIEE_2026-10-27.md)
- [Recette HTTPS : service commun interface/API, configuration de publication et banc de sessions sécurisées](docs/RECETTE_HTTPS_2026-10-27.md)
- [Recette utilisateurs : environnement HTTPS recommandé, parcours par rôle et fiche d’observation sur téléphones](docs/RECETTE_UTILISATEURS_2026-10-27.md)
- [Vues par rôle : accueil, disponibilité, filtres et navigation simplifiés](docs/VUES_PAR_ROLE_SIMPLIFIEES_2026-10-27.md)
- [Synthèse de la simplification de Teranga et principes transposables à la santé](docs/SYNTHESE_SIMPLIFICATION_ET_TRANSPOSITION_SANTE_2026-10-27.md)
- [Cohérence taxi/livraison : offres, réalisation et déclaration distincte des paiements](docs/COHERENCE_TRANSPORT_2026-10-27.md)
- [Espace prestataire : offres, interventions et historique réunis](docs/ESPACE_PRESTATAIRE_UNIFIE_2026-10-27.md)
- [Mes demandes : liste commune des services, projets et commandes, création et retours directs](docs/MES_DEMANDES_UNIFIEES_2026-10-26.md)
- [Projets et biens : listes simples, fiche centrale et demande d'intervention contextualisée](docs/PROJETS_BIENS_SIMPLIFIES_2026-10-26.md)
- [Catalogue → commande → paiements : parcours continu, formulaire commun et retours conservés](docs/CATALOGUE_COMMANDE_CONTINUE_2026-10-26.md)
- [Commandes et paiements : consultation et saisie directement dans les dossiers](docs/COMMANDES_PAIEMENTS_DIRECTS_2026-10-26.md)
- [Recette par rôle : parcours continus, libellés et accès aux paiements](docs/RECETTE_PAR_ROLE_2026-10-26.md)
- [Reprise du 26 octobre : résumé complet, commit local et prochaine session](docs/REPRISE_SESSION_2026-10-26.md)
- [Paiements et dépenses : journal commun, bilan et droits par dossier](docs/ESPACES_FINANCIERS_2026-10-26.md)
- [Accueil connecté unique, disponibilité et outils administratifs dans Gestion](docs/ACCUEIL_CONNECTE_2026-10-26.md)
- [Dossiers projets et commandes : cadre commun, réalisation et justificatifs](docs/DOSSIERS_PROJETS_COMMANDES_2026-10-25.md)
- [Navigation centrée sur le travail, historique et interventions des biens](docs/NAVIGATION_INTERVENTIONS_2026-10-25.md)
- [Reprise de session : état global de la simplification et suite proposée](docs/REPRISE_SESSION_2026-10-24.md)
- [Centre des opérations : file commune À faire / À suivre / Informations](docs/FILE_COMMUNE_OPERATIONS_2026-10-24.md)
- [Dossier service : premier lot de refonte avec étapes et justificatifs intégrés](docs/DOSSIER_SERVICE_ETAPES_2026-10-24.md)
- [Proposition de refonte : centre, dossiers, étapes et justificatifs, avec maquette navigable](docs/REFONTE_UNIFICATION_2026-10-24.md)
- [Coordination et affectations : quatrième étape de simplification](docs/COORDINATION_AFFECTATIONS_2026-10-24.md)
- [Listes de demandes et dossiers : troisième étape de simplification](docs/DEMANDES_DOSSIERS_2026-10-24.md)
- [Accueils par rôle et actions principales : deuxième étape de simplification](docs/ACCUEILS_ACTIONS_2026-10-24.md)
- [Fusion des activités, notifications et coordination dans le centre des opérations](docs/FUSION_CENTRE_OPERATIONS_2026-10-24.md)
- [Contrôle des secrets et validation avant publication](docs/CONTROLE_PUBLICATION_2026-10-24.md)
- [Vérifier le déploiement, la persistance des justificatifs et la restauration](docs/runbooks/verification-deploiement.md)
- [Préparation terrain : corrections, recette réelle et conditions d'ouverture du 24 octobre 2026](docs/PREPARATION_TERRAIN_2026-10-24.md)
- [Simplification des espaces par rôle, des commandes et de la reprise après interruption](docs/SIMPLIFICATION_PARCOURS_2026-10-24.md)
- [Simplicité des parcours et efficacité des services — audit et corrections du 24 octobre 2026](docs/AUDIT_SIMPLICITE_SERVICES_2026-10-24.md)
- [Plan d’exécution des améliorations](docs/PLAN_EXECUTION.md)
- [Checklist Go-Live exécutable](docs/GO_LIVE_CHECKLIST.md)
- [Snapshot maturite actuelle (2026-03-07)](docs/MATURITY_STATUS_2026-03-07.md)
- [Règles multi-pays & franchise (backend)](backend/docs/multi-country-rules.md)

## Configuration rapide (env)
- `CORS_ORIGINS` : liste d’origines autorisées (séparées par des virgules). Utiliser `*` en dev si besoin.
- `LOG_LEVEL` : niveau de logs (`debug`, `info`, `warn`, `error`).
- `JWT_ACCESS_EXPIRES` : durée du token d’accès (ex: `1h`).
- `JWT_REFRESH_EXPIRES` : durée du refresh token (ex: `30d`).
- `BOOTSTRAP_ADMIN_ENABLED` : activer le bootstrap admin en prod (`true/false`).
- `BOOTSTRAP_ADMIN_EXPIRES_AT` : date d’expiration ISO pour le bootstrap admin.
- `BOOTSTRAP_ADMIN_ALLOW_DEFAULTS` : en dev, autorise des valeurs par défaut si email/mot de passe manquants (`true/false`, défaut `true`).
- `BOOTSTRAP_ADMIN_DEFAULT_EMAIL` : email par défaut utilisé en dev si absent.
- `BOOTSTRAP_ADMIN_DEFAULT_PASSWORD` : mot de passe par défaut utilisé en dev si absent.
- Le seeder administrateur local exige `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` (16 caractères minimum, 72 octets UTF-8 maximum), sans valeur par défaut. Il refuse la production, où le bootstrap contrôlé reste le parcours prévu.
- `METRICS_TOKEN` : token d’accès à `/api/metrics` (recommandé en prod).
- `SLOW_REQUEST_THRESHOLD_MS` : seuil (ms) pour signaler les requêtes lentes (défaut 1500).
- La réinitialisation de mot de passe est volontairement manuelle (admin/master du pays/région de l'utilisateur, voir `manualPasswordReset` dans `user.controller.js`) — aucune configuration SMTP n'est nécessaire ni lue par le backend.
- `PROPERTY_MAX_FILE_MB` : taille max par fichier uploadé pour les biens (recommandé en prod mobile: `20`).

## Vision globale (franchise panafricaine)
- **Plateforme centrale** : Teranga OS, développé et maintenu au siège.
- **Réseau de franchisés** : franchisés master par pays, franchisés régionaux par ville/région.
- **Communauté diaspora** : expérience unifiée, produits et services localisés selon les pays d’origine.

## Architecture administrative (4 niveaux)
### 1) Administrateurs généraux (Siège)
- Vision stratégique et gouvernance globale.
- Développement et maintenance de Teranga OS.
- Standards qualité internationaux.
- Gestion des franchisés master.
- Analytics panafricains, R&D et innovation.

### 2) Franchisés master (par pays)
- Implémentation nationale (ex. Teranga Mali SAS).
- Adaptation locale (langues, réglementation, fiscalité).
- Recrutement et formation des franchisés régionaux.
- Marketing national et gestion financière pays.

### 3) Franchisés régionaux (par région/ville)
- Opérations quotidiennes (ex. Teranga Bamako).
- Gestion des agents, relation client, logistique locale.
- Application stricte des standards Teranga.

### 4) Agents Teranga (exécution terrain)
- Formés via Teranga Academy.
- Application des SOP, preuves conformes, interface terrain.

## Gestion des produits par zone
Chaque produit est rattaché à un pays et une région, avec des règles précises :
- **Disponibilité** (pays/région), **prix** local, **logistique** locale, **affectation d’agent**.
- Ex. « Huilier traditionnel sénégalais » : disponible uniquement au Sénégal, prix par région, livraison ciblée, agent régional assigné.

## Tableaux de bord hiérarchiques
- **Siège (panafricain)** : pays actifs, CA total, croissance, alertes franchisés.
- **Pays (master)** : CA national, performance vs objectifs, agents, produits locaux.
- **Région** : opérations quotidiennes, agents actifs, clients, spécificités locales.

## Modèle franchise (synthèse)
- **Franchisé master (pays)** : droit d’entrée + % revenus, accès complet Teranga OS, formation, support 24/7, manuel localisé.
- **Franchisé régional** : droit d’entrée + % revenus, zone exclusive, formation agents, marketing pack local.

## Stratégie d’inclusion de la diaspora
- **Plateforme unique, expériences multiples** : même workflow, preuves, support et paiements; adaptation locale (langues, devises, règles).
- **Personnalisation par communauté** : produits/services propres à chaque diaspora, ambassadeurs, partenariats.
- **Programme “Teranga Community”** : ambassadeurs, groupes officiels, webinaires, newsletter, parrainage.

## Intégration dans l’existant (plan d’exécution)
### Phase 1 — Préparation infrastructure (Mois 1-2)
1. Migration BD vers une architecture multi-pays.
2. Création des rôles/permissions hiérarchiques.
3. Développement des dashboards par niveau.
4. Documentation franchise (contrats, SOP, manuels).

### Phase 2 — Lancement du pays pilote (Mois 3-4)
1. Recruter le franchisé master **Mali**.
2. Former l’équipe nationale.
3. Localiser le contenu (produits, prix, descriptions).
4. Lancement officiel du Mali.

### Phase 3 — Expansion progressive (Mois 5-12)
- T2 : Côte d’Ivoire + Mali.
- T3 : Burkina Faso + Guinée.
- T4 : Ghana + Bénin.

### Phase 4 — Optimisation continentale (Année 2)
- Marketplace panafricaine.
- Teranga Capital (financements transfrontaliers).
- Mobilité inter-pays des agents (formation croisée).

## Indicateurs de succès (KPIs)
- **Par pays** : adoption diaspora, satisfaction client (CSAT > 4,5), marge nette > 15%, agents certifiés.
- **Global** : nombre de pays actifs, croissance CA > 20% trimestriel, uniformité qualité < 10%, NPS franchisés > 40.

## Paramètres initiaux pour le pilote Mali
- **Langue** : français uniquement (phase pilote).
- **Objectif** : valider le modèle multi-pays, les dashboards et la chaîne de conformité avant extension.

---

### Résumé exécutif (intégration dans l’ensemble)
Teranga devient une **franchise panafricaine** avec une **plateforme centrale** (Teranga OS) et une **opération locale** par pays et région. Le siège garantit la **cohérence, la qualité, la gouvernance et l’innovation**, tandis que les franchisés adaptent les opérations aux réalités locales. Cette approche combine **standardisation** (processus, preuves, sécurité, qualité) et **localisation** (langues, réglementations, produits, logistique), permettant à **toutes les diasporas africaines** de se sentir représentées. Le **Mali** sert de pays pilote avec le **français** comme langue initiale, afin de stabiliser le modèle avant une expansion progressive vers d’autres pays.
