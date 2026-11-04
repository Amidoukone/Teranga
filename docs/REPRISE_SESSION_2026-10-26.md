# Reprise de session — clôture du 26 octobre 2026

Projet : `C:\Users\konea\Teranga`. Branche : `master`.

**Dernier lot local du 27 octobre :** [barre supérieure simplifiée](TOPBAR_SIMPLIFIEE_2026-10-27.md). Navigation principale allégée, territoire dans un panneau dédié, cloche d’informations et compte regroupant paramètres, sécurité, aide, langue et déconnexion sur ordinateur et mobile. Validation : 422 tests interface, lint et compilation réussis, 37 scénarios navigateur et 4 parcours réels avec les comptes locaux de Côte d’Ivoire. Changements non commités et non déployés, ajoutés aux lots ci-dessous ; serveurs de développement de l’utilisateur laissés disponibles.

Ce document constitue le point de reprise courant. Il est inclus dans le commit détaillé demandé par l'utilisateur, avec tous les changements des 25 et 26 octobre. Son identifiant se retrouve avec `git log -1 --oneline` et est communiqué dans la réponse de clôture. Le commit précédent est `2af8e61`.

**Aucun push ni déploiement n'est demandé ou effectué dans cette clôture.** Les mentions « local/non commité » des bilans de lots décrivent leur état avant ce commit. Ne pas les interpréter comme des changements encore à enregistrer après cette clôture.

## Direction produit à conserver

**Un centre pour savoir quoi faire, un dossier pour agir, des étapes facultatives.**

Teranga coordonne la réalisation de services par des humains. L'objectif est une application simple et concrète, avec moins de menus, d'écrans répétitifs et d'actions inutiles. Le terme « dossier » présente les modèles existants ; il ne crée pas une nouvelle entité métier.

Les tâches restent utiles pour les étapes complexes et les interventions autonomes liées aux biens. Ne pas les supprimer ni perdre leurs identifiants, justificatifs, autorisations et liens financiers. Une étape terminée ne termine pas automatiquement son dossier. Lire une notification ne clôture aucun travail. Un justificatif de réalisation n'est pas un reçu de paiement. Livrer ou confirmer un résultat ne vaut pas règlement.

## Ensemble réalisé

Le socle du 24 octobre, déjà dans `2af8e61`, a fusionné activités, notifications et opérations, simplifié les demandes et la coordination, intégré étapes et justificatifs aux services, puis installé la file commune **À faire / À suivre / Informations**. Les tâches sans droit sur leur parent disposent d'un espace limité `/tasks/:id`. Les règles et périmètres sont contrôlés au serveur.

Le commit de clôture ajoute quatre lots :

1. **Navigation et interventions.** Le centre ouvre le travail courant pour les quatre rôles. Tâches devient « Interventions et historique » dans les accès secondaires. Les biens ouvrent directement leur archive d'interventions. Recherche, filtre par bien/projet, droits, comptage et pagination sont appliqués au serveur avant l'affichage ; les filtres et la page sont conservés au retour. `/dossiers` est nommé « Biens et projets ».
2. **Dossiers projets et commandes.** En-tête, prochaine action et sections communes : réalisation, justificatifs, montants, détails. Les phases et étapes projet restent distinctes ; les articles restent propres à la commande. Les justificatifs sont présentés avant confirmation. La lecture des conditions de remise partage les contrôles de l'écriture et ne fait avancer aucun travail. La remise d'un projet demande compte rendu, phases/étapes non bloquantes et justificatif du bon auteur ; le client confirme ensuite le projet. La livraison d'une commande conserve son suivi de paiement séparé.
3. **Accueil connecté unique.** `/operations` devient la destination par défaut de connexion et du logo connecté. `/dashboard` reste un favori compatible. Les liens protégés vers un dossier conservent paramètres et ancre après connexion. Salutation et consigne adaptées au rôle, disponibilité agent/prestataire dans le centre, aucune seconde liste d'affectations dans ces contrôles. Durée, capacité, véhicule, statut occupé et position facultative sont conservés. `/gestion` regroupe les outils administratifs et les bilans chargés à la demande. L'accueil public `/` reste public.
4. **Paiements et dépenses.** Journal et formulaire communs aux services, projets, commandes et interventions. `/transactions` ouvre le journal, `?vue=bilan` ouvre le bilan, `/finance` redirige vers ce dernier. Recherche et pagination du journal au serveur, vingt écritures par page. Le bilan charge toutes les pages autorisées, sépare les devises et affiche explicitement les statuts retenus ; il ne calcule pas un reste à payer. Export CSV, justificatifs, modification/contrôle administratif et compléments autorisés des autres rôles. La suppression reste réservée à l'administrateur global. Un agent autorisé sur une seule étape conserve son journal limité sans accès au parent. La saisie répétée d'une commande conserve l'unicité existante par nature et remplace son montant ; elle ne crée pas un acompte supplémentaire.

Les paiements restent externes à l'application. Aucune migration, dépendance ou variable d'environnement nouvelle dans ces lots. Les parcours spécialisés taxi/livraison restent distincts. Les pages historiques et favoris utiles restent compatibles.

## Comportements de reprise et droits

- Les réponses d'un ancien compte, rôle, territoire, dossier ou filtre sont ignorées.
- Une interruption réseau ne devient pas un faux état vide : les données et brouillons du même contexte restent disponibles lorsque le parcours le permet, avec une erreur explicite.
- Une révocation retire les données et contrôles concernés. La sélection d'un territoire ne donne pas de nouveaux droits.
- La devise et le territoire d'un dossier autorisé priment sur une ancienne sélection de navigation.
- Les mutations sont protégées contre les doubles soumissions ; une position GPS arrivée après avoir quitté l'écran ne déclenche pas de déclaration tardive.
- Les pièces ne sont ni copiées entre dossiers ni automatiquement requalifiées en preuve de paiement.

## Repères dans le code

| Sujet | Fichiers principaux |
| --- | --- |
| Centre, accueil et navigation | `OperationsCenterPage.jsx`, `ConnectedHomeIntro.jsx`, `NavBar.js`, `ManagementHome.jsx`, `managementNavigation.js` |
| Disponibilité | `AgentCoordinationPanel.jsx`, `ProviderAvailabilityPanel.jsx` |
| Dossiers | `DossierHeader.jsx`, `ProjectDetailPage.jsx`, `OrderDetailPage.js`, `WorkProgressPanel.jsx`, `ProjectTasksPanel.jsx` |
| Interventions | `TasksPage.js`, `TaskWorkspacePage.jsx`, `ServiceStepsPanel.jsx`, `backend/src/controllers/task.controller.js` |
| Remise des projets/commandes | `backend/src/services/workCoordination.service.js`, `backend/src/controllers/operations.controller.js`, `backend/openapi/openapi.json` |
| Finances | `frontend/src/features/finance/`, pages `*TransactionsPage*`, `FinanceRouteAlias.jsx`, `services/transactions.js` |
| Connexion et compatibilité | `App.js`, `LoginPage.js`, `loginDestination.js`, `routePreload.js` |

## Validations effectuées avant clôture

- **Backend : 567 tests réussis dans 82 suites**, dernier passage complet du lot dossiers. Les lots accueil et finances n'ont pas modifié le backend.
- **Interface : 351 tests réussis dans 75 suites**, puis **13 tests ciblés du journal réussis** après le dernier ajustement de compatibilité des montants signés. Ce dernier test supplémentaire ne constitue pas un nouveau passage complet des 75 suites.
- **Navigateur simulé : 64 scénarios réussis dans 14 fichiers**, suite complète, téléphone et ordinateur. Couverture des connexions, retours, demandes, dossiers, justificatifs, navigation, interventions, finances et interruptions.
- **Recettes réelles locales avec MySQL isolé :** lots navigation, dossiers et accueil validés dans leurs bilans respectifs ; le dernier lot ajoute **quatre scénarios financiers distincts réussis** lors des exécutions et rejeux ciblés. Ils couvrent le reçu de service accessible au client sans terminer le service, la devise et le contrôle d'une écriture projet, l'unicité d'une écriture commande sans marquage payé et l'accès financier d'un agent limité à une étape. Ne pas additionner les chiffres des bilans pour prétendre à une suite réelle unique rejouée en bloc.
- ESLint interface, compilation de production et contrôle des espaces Git réussis. Les derniers ajustements sans changement de comportement concernent des espaces de fin de ligne.
- Avant l'enregistrement du commit : vérification des fichiers inclus et analyse Gitleaks du contenu destiné au commit. Les configurations privées, reçus de recette, builds, sauvegardes et rapports locaux restent ignorés.

Les tests ont été exécutés pendant les lots ; la clôture documentaire ne les rejoue pas tous. La validation de production, des notifications réelles et du stockage durable reste distincte de ces recettes locales. Le stockage local utilisé pour les pièces de test ne valide pas Render ou Netlify.

## Prochaine session

**Dernier lot local — préparation HTTPS du 27 octobre :** [Version de recette HTTPS](RECETTE_HTTPS_2026-10-27.md). Build dédié `recette:build`, option `SERVE_FRONTEND` pour servir interface/API/fichiers sur une origine, en-têtes HTML adaptés sans relâcher ceux de l’API, contrôle `recette:check`, garde-fous de base/origines et manifeste `deploy/recette.render.yaml` pour un service distinct sans déploiement automatique. Validation : backend complet **623 tests / 87 suites**, puis 24 ciblés ; **six scénarios HTTPS réussis** sur le build compilé en configuration serveur production, dont quatre rôles sans jetons persistants, rechargement, disponibilité, CSRF, déconnexion, GPS simulé et réalisation avec justificatif consulté par le client. Compilation et contrôle backend 323 fichiers réussis. Aucun commit, push, déploiement, domaine ou base distante créé. Pour publier : confirmer l’espace Render, la version revue, une base MySQL dédiée `teranga_recette` et l’URL du service. Aucun accès Render exploitable n’est disponible dans les outils/variables de la session. Les essais humains, GPS réel et volume hébergé restent à constater. Serveurs et MySQL locaux arrêtés.

**Dernier lot local — préparation de la recette utilisateurs du 27 octobre :** [Revue par rôle et essais sur téléphones](RECETTE_UTILISATEURS_2026-10-27.md). Recommandation : version de recette HTTPS avec base, fichiers et comptes distincts ; l’URL et l’hébergement restent à fixer, aucun déploiement effectué. Le guide contient les consignes par rôle, six parcours partagés, les reprises réseau/GPS et une fiche d’observation non remplie. Corrections : informations et listes utilisent le même résolveur de dossier ; type de colis porté par les notifications ; intervention autonome ouverte directement ; assistance avec retour au dossier et aux filtres d’origine, accès adaptés au rôle. Validation : interface complète 422 tests / 81 suites ; backend ciblé quatre tests ; navigateur réel **36 scénarios tous réussis dans le dernier passage complet** ; linters, compilation et espaces réussis. Les limites d’authentification sont conservées. Les essais humains, GPS réel et stockage hébergé restent à constater sur la version de recette choisie. Aucun commit, push ni déploiement. Les serveurs et MySQL de recette sont arrêtés.

**Dernier lot local — vues par rôle du 27 octobre :** [Vues par rôle simplifiées](VUES_PAR_ROLE_SIMPLIFIEES_2026-10-27.md). Accueils Mon suivi / Mon travail / Mon activité / Pilotage, navigation Accueil, filtres compacts communs, disponibilité en colonne sur ordinateur, outils de Gestion par catégorie et retours de dossier explicites. L’agent supervise sans boutons d’acceptation prestataire ; ses liens vers les missions passent par le suivi autorisé. Interface : 410 tests en passage complet puis 18 tests de navigation ; 100 scénarios navigateur distincts couverts (98 au passage complet, puis 22 ciblés tous réussis après actualisation de deux libellés attendus) ; sept parcours réels locaux réussis. Compilation, ESLint et contrôle des espaces réussis. Aucun commit, push ni déploiement. Suite : revue avec les personnes de chaque rôle, puis recette physique. Les serveurs de recette et MySQL sont arrêtés ; consulter le bilan pour les limites GPS et stockage. Les points ci-dessous décrivent les lots précédents.

**Dernier lot local, cohérence transport du 27 octobre :** [Taxi, livraison et cohérence des interventions](COHERENCE_TRANSPORT_2026-10-27.md). Retours après refus, délais et réponses concurrentes aux offres, protection de la réservation chauffeur, compte rendu indépendant de l’ordre d’initialisation de la coordination, déclaration à la remise distincte des paiements et pays choisi conservé. Backend complet : 598 tests ; interface complète : 406 tests puis 21 ciblés ; 90 scénarios navigateur distincts couverts (89 au passage complet, puis trois en rejeu) ; dernier passage réel de quatre scénarios réussi. Compilation et linters réussis. Aucun commit, push ni déploiement. Suite : démonstration par rôle avec de vrais utilisateurs et recette terrain GPS ; consulter les limites exactes dans le bilan.

**Dernier lot local, 27 octobre :** [Espace prestataire unifié](ESPACE_PRESTATAIRE_UNIFIE_2026-10-27.md). Mes interventions réunit services, courses et livraisons avec offres, historique, recherche et filtres conservés au retour. La disponibilité reste dans le centre ; réalisation et justificatifs restent dans le dossier. Backend complet : 590 tests ; interface complète : 397 tests puis 18 ciblés ; 21 scénarios navigateur distincts validés avec rejeu ciblé et deux parcours réels agent/prestataire réussis. Compilation et linters réussis. Aucun commit, push ni déploiement. Suite : retours prestataire sur téléphone, puis recette terrain taxi/livraison. Consulter le bilan pour les limites exactes de validation. Les indications « prochaine étape : prestataire » ci-dessous décrivent le point de reprise antérieur à ce lot.

**Lot courant après les projets et biens :** [Mes demandes unifiées](MES_DEMANDES_UNIFIEES_2026-10-26.md). `/demandes` réunit services, projets et commandes avec recherche, vues et pagination globales, création directe et retours filtrés. Le menu client ouvre directement Mes biens. Backend et interface validés en suites complètes : 583 et 388 tests, puis 8 et 39 tests ciblés après les derniers ajustements. Navigateur : 87 scénarios simulés et 13 parcours réels locaux réussis ; compilation et linters réussis. Consulter le bilan pour le détail. Ces changements s'ajoutent aux lots locaux précédents et restent non commités. La prochaine étape est l'espace prestataire ; la proposition historique de recette ci-dessous décrit le point de départ avant ces lots.

**Lot précédent :** [projets et biens simplifiés](PROJETS_BIENS_SIMPLIFIES_2026-10-26.md). Les projets utilisent une liste et une création communes ; leurs commandes de modification sont dans le dossier. Les biens disposent d'une fiche avec documents et historiques, et d'une demande d'intervention préremplie qui conserve le rattachement au bien. Le lot Mes demandes lui succède. Changements locaux, non commités, ajoutés aux lots ci-dessous.

**Lot antérieur :** [catalogue, commande et paiements en un parcours continu](CATALOGUE_COMMANDE_CONTINUE_2026-10-26.md). Commande directe depuis le catalogue ou la fiche avec le même formulaire ; recherche et retour conservés ; prix, stock et reçu vérifiés avec le serveur local. Les validations et les fichiers de reprise sont décrits dans ce bilan. Les changements restent non commités et s'ajoutent aux deux lots ci-dessous.

**Lot antérieur :** [commandes et paiements directement dans les dossiers](COMMANDES_PAIEMENTS_DIRECTS_2026-10-26.md). La liste des commandes et leur création sont simplifiées ; le journal commun est intégré aux dossiers services, projets et commandes. Ce bilan décrit les validations et l'état courant non commité, qui s'ajoutent à la recette par rôle ci-dessous.

**Suite engagée le 26 octobre après le commit `1cb0a6d` :** la recette technique par rôle et les petits ajustements de libellés et d'accès aux paiements sont décrits dans [le bilan de recette](RECETTE_PAR_ROLE_2026-10-26.md). Ces changements sont locaux et ne font pas partie du commit de clôture décrit plus haut. Consulter ce bilan et `git status --short` avant de reprendre ; l'état propre attendu ci-dessous concerne la clôture initiale.

Commencer par `git status --short`, puis lire ce document et les quatre bilans ci-dessous. Le dépôt doit être propre après le commit de clôture ; examiner tout changement apparu depuis avant d'intervenir.

La prochaine étape proposée est une **recette utilisateur complète de la version de démonstration, par rôle**, du besoin initial jusqu'à la confirmation finale et à l'enregistrement financier. Il ne s'agit pas de relancer une nouvelle refonte globale. Vérifier les libellés, les retours et les clics encore superflus dans ces parcours :

1. Client : demander, suivre, consulter le résultat et les justificatifs, confirmer, retrouver les paiements.
2. Agent : se rendre disponible, ouvrir le bon dossier ou la seule étape autorisée, exécuter, joindre les pièces et rendre compte.
3. Prestataire : disponibilité/véhicule, offre, intervention, justificatifs et historique spécialisé.
4. Responsable : coordonner, affecter, traiter un blocage, vérifier la remise, accéder à Gestion et contrôler les écritures dans son périmètre.

Privilégier les petits correctifs démontrés par cette recette. Maintenir les différences métier entre services, projets, commandes, taxi et livraison. Aucune publication n'est autorisée par la demande de commit. Si une publication est demandée ultérieurement, préparer le backend compatible avant l'interface, puis vérifier les parcours et les pièces dans l'environnement hébergé.

## Lectures prioritaires

- [Finances : parcours, règles, droits et validation](ESPACES_FINANCIERS_2026-10-26.md).
- [Accueil connecté, disponibilité et Gestion](ACCUEIL_CONNECTE_2026-10-26.md).
- [Dossiers projets et commandes](DOSSIERS_PROJETS_COMMANDES_2026-10-25.md).
- [Navigation et interventions des biens](NAVIGATION_INTERVENTIONS_2026-10-25.md).
- [Résumé historique du socle du 24 octobre](REPRISE_SESSION_2026-10-24.md).
- [Conception cible et maquette navigable](REFONTE_UNIFICATION_2026-10-24.md).
- [Vérification d'un éventuel déploiement](runbooks/verification-deploiement.md).
