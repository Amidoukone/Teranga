# Reprise de session — simplification de Teranga

Projet : `C:\Users\konea\Teranga`. Bilan du 24 octobre 2026, préparé pour le commit demandé par l'utilisateur.

## Direction à conserver

Teranga coordonne et fait exécuter des services par des humains, avec une interface simple, accessible et adaptée au contexte africain. La refonte simplifie les parcours sans remplacer les concepts, données et règles métier existants.

Principe adopté : **un centre pour savoir quoi faire, un dossier pour le faire, des étapes facultatives lorsque le travail le nécessite**. « Dossier » est une présentation des modèles existants, pas une nouvelle entité métier. Les tâches conservent leurs identifiants, droits, justificatifs et liens financiers.

## Implémentations incluses dans le commit

1. Fusion des activités, notifications et opérations dans `/operations`. Les anciennes URL restent compatibles. Lecture et suppression des informations protégées contre les réponses et versions périmées.
2. Accueils adaptés aux rôles, présentation commune et prochaine action explicite. Disponibilité, transports et outils spécialisés conservés.
3. Demandes client avec recherche, filtres et pagination au serveur ; résultats et justificatifs présentés avant confirmation ; retour aux filtres conservé.
4. Coordination centralisée et affectations directes, avec outils avancés conservés et maintien du mode automatique lors du seul choix du responsable.
5. Étapes et justificatifs intégrés au dossier service. Service simple réalisable sans tâche artificielle. Affectation et contrôle d'une étape distincts de la finalisation et de la confirmation du service.
6. File commune **À faire / À suivre / Informations**, ouverte par défaut sur À faire pour les quatre rôles. Services, projets, commandes et interventions regroupés avant recherche finale, comptage et pagination ; vingt dossiers par page. Une carte de dossier résume ses étapes autorisées et ouvre l'action précise. Lire une information ne termine aucun travail.
7. Espace limité `/tasks/:id` pour une intervention autonome ou sans droit sur son service parent ; ciblage des litiges d'un dossier pour le responsable. Droits et territoires contrôlés au serveur.

Les actualisations préservent les brouillons et les données du même contexte en cas d'interruption. Les réponses d'un ancien compte, rôle, territoire ou filtre sont ignorées ; une révocation retire les données concernées. Aucune migration, dépendance ou variable d'environnement nouvelle dans ces lots de simplification.

## Validation du dernier état du code

- Backend : **558 tests réussis**, dont 15 tests d'intégration MySQL de la file commune. Contrat OpenAPI rejoué : **3 tests réussis** (déjà compris dans la suite backend).
- Interface : **268 tests réussis**, dans 65 suites.
- Navigateur : **14 scénarios avec API simulée** et **13 scénarios distincts avec vrai serveur et MySQL isolé** réussis. Pour la recette réelle, 12 scénarios ont réussi dans le lancement complet, puis les deux nouveaux ont réussi lors d'un rejeu après correction d'une fixture de bien immobilier.
- Contrôles du code backend et interface, compilation de production et vérification des espaces Git réussis.
- Analyse Gitleaks effectuée avant commit ; aucun secret détecté dans les fichiers publiables. Les fichiers de configuration privés et artefacts ignorés restent exclus.

Ces vérifications sont locales. Elles ne constituent pas une validation du déploiement ou de la configuration de production.

## État Git et publication

L'utilisateur a demandé de **committer les changements**, puis de reprendre dans une nouvelle session. Le commit préparé avec ce bilan regroupe tous les lots ci-dessus. Son identifiant est communiqué dans la réponse de fin de session et se retrouve avec `git log -1 --oneline`.

**Aucun push ni déploiement effectué dans cette clôture.** La production déployée précédemment peut donc différer de cet état. Les mentions « locales/non commitées » dans les bilans des lots précédents décrivent leur état historique avant ce commit.

Lors d'une publication ultérieure, publier le backend compatible avant l'interface : la nouvelle interface utilise les filtres et lectures ajoutés à l'API. Vérifier ensuite Render, Netlify et les parcours sur l'environnement déployé. Les besoins de stockage durable des preuves, notifications et restauration restent à contrôler avec la vraie configuration de production ; ne pas les considérer comme validés par la recette locale.

## Prochaine étape proposée

Simplifier la navigation et les accès redondants en s'appuyant sur le centre commun. Avant de retirer Tâches du menu principal, vérifier que les interventions liées aux biens, aux projets et aux données historiques conservent tous leurs accès. Poursuivre ensuite l'unification des dossiers projets et commandes, en gardant leurs règles propres et les parcours taxi/livraison. Cette suite reste à implémenter.

## Lectures prioritaires

- [File commune : comportement, droits, contrat et validation](FILE_COMMUNE_OPERATIONS_2026-10-24.md).
- [Refonte d'unification : conception cible et étapes](REFONTE_UNIFICATION_2026-10-24.md), avec [maquette navigable](design/teranga-unification.html).
- [Dossier service : étapes et justificatifs intégrés](DOSSIER_SERVICE_ETAPES_2026-10-24.md).
- [Préparation terrain et limites de production](PREPARATION_TERRAIN_2026-10-24.md).

Les autres bilans de simplification sont accessibles depuis le README.
