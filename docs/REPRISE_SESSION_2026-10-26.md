# Reprise de session — clôture du 26 octobre 2026

Projet : `C:\Users\konea\Teranga`. Branche : `master`.

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
