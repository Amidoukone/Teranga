# Navigation centrée sur le travail et accès aux interventions

Date : 25 octobre 2026. Suite du [bilan de reprise](REPRISE_SESSION_2026-10-24.md). Changements locaux, sans publication.

## Organisation retenue

Le centre est la première destination du travail courant. L'ordinateur et le téléphone utilisent la même liste d'entrées principales, dans le même ordre.

| Rôle | Navigation principale | Accès secondaires préservés |
| --- | --- | --- |
| Client | Centre des opérations · Mes demandes · Nouvelle demande | Accueil, Biens et projets, Interventions et historique, boutique et commandes |
| Agent | Centre des opérations · Services | Accueil, missions filière, projets, Interventions et historique, transactions et finances |
| Prestataire | Centre des opérations · Services · Mes courses · Mes livraisons | Accueil, paramètres et outils du compte |
| Responsable | Centre des opérations · Gestion · Courses Taxi · Livraisons | Pilotages spécialisés, interventions, équipe, catalogue, qualité, finances et configuration selon ses droits |

Les accès secondaires sont regroupés dans « Plus ». « Gestion » ouvre l'accueil administratif existant. Le compte, l'aide et les anciennes URL restent disponibles. Le lien des informations personnelles ouvre toujours la vue de lecture du centre sans marquer les messages comme lus.

L'espace `/dossiers` reste un regroupement de biens et de projets : son nom devient **Biens et projets**. Il n'est pas présenté comme une liste universelle de services et commandes. Les listes Services et Missions des agents sont conservées : leurs contrats couvrent des familles de travail différentes.

## Retrait de Tâches de la navigation principale

Les interventions autonomes et historiques restent accessibles par `/tasks`, nommé **Interventions et historique** dans « Plus », pour les clients, agents et responsables déjà autorisés par cette route. Les interventions en cours restent dans la file commune. Les prestataires n'obtiennent aucun nouvel accès aux tâches.

Les pages de biens du client et du responsable proposent **Voir les interventions**. Ce lien ouvre `/tasks?propertyId=…`, qui retrouve les tâches directement liées au bien et celles rattachées à ses services, dans les accès de l'utilisateur. Il ne crée aucun service artificiel. La consultation d'un bien n'accorde pas le droit de consulter les tâches d'un service appartenant à quelqu'un d'autre.

Une carte propose une action principale : **Ouvrir l'intervention**. Elle ouvre le dossier limité `/tasks/:id`, déjà utilisé par le centre, qui porte les actions autorisées, l'affectation et les justificatifs. Les contrôles et les transitions ne sont plus dupliqués dans la liste générale. Les liens financiers du service restent dans ce dossier lorsque le parent est accessible. Les anciennes pages de preuves restent compatibles.

Le formulaire historique de création d'étape de service est conservé comme outil secondaire, fermé par défaut. Une actualisation conserve son brouillon. L'envoi protège contre les doubles clics. La vue contextuelle d'un bien sert à retrouver ses interventions ; elle n'affiche pas ce formulaire destiné aux services.

## Recherche et historique complets

L'ancienne page chargeait la première page des tâches puis filtrait localement. La nouvelle liste applique recherche, filtres, autorisations et contexte du bien **au serveur avant la pagination**. Elle affiche vingt interventions par page, y compris les tâches validées et annulées lorsque les filtres le permettent.

`GET /tasks` conserve son contrat existant et ajoute :

- `propertyId` : bien direct ou bien du service ; un identifiant invalide ou vide renvoie une erreur 400 ;
- `q` : sous-chaîne du titre, de la description ou du titre du service/bien ; `%` et `_` restent des caractères littéraux ;
- `pagination.total` et `totalPages`, avec maintien du nombre `count` de la page ;
- un ordre stable par date puis identifiant décroissants.

Les filtres et la page restent dans l'URL et dans le retour depuis le dossier. Les réponses d'une ancienne recherche, d'un ancien compte ou d'un ancien territoire sont ignorées. Une interruption conserve les résultats du même contexte et affiche l'échec ; une révocation retire les résultats. Une erreur ne devient pas un faux état vide. Seuls les responsables transmettent la sélection territoriale administrative : les listes personnelles ne doivent pas masquer les interventions d'un bien situé dans un autre pays. Le contrat est documenté dans [OpenAPI](../backend/openapi/openapi.json).

Les données Task, leurs statuts, les justificatifs et les liens financiers restent inchangés. Aucune migration, dépendance ou variable de configuration nouvelle.

## Validation

- Backend : **566 tests réussis**, dans 82 suites. La suite MySQL des étapes et interventions comprend 16 tests, dont les nouveaux cas de pagination de l'historique, de contexte du bien, de recherche et de restrictions d'accès.
- Interface : **289 tests réussis**, dans 66 suites. Couverture du menu par rôle, du changement de compte/territoire, des réponses tardives, des interruptions, de la révocation, du brouillon et du retour aux filtres.
- Navigateur : **9 scénarios avec API simulée**, pour les quatre rôles à 360 et 1440 pixels et l'historique d'un bien sur deux pages. Captures inspectées et absence de débordement horizontal contrôlée.
- Navigateur avec API réelle et MySQL de recette : **7 scénarios distincts réussis** (services, création de tâche, lecture du centre, commandes, étapes regroupées, intervention autonome et accès depuis un bien). Le premier lancement a validé les services ; les six autres ont été rejoués avec succès après retrait d'une ouverture de formulaire inutile dans le test : la fixture de connexion ouvrait déjà ce formulaire. Aucun changement du comportement applicatif n'a été nécessaire pour ce rejeu.
- Contrôles du code backend et interface et compilation de production réussis. Les fins de ligne Windows ont été prises en compte dans le contrôle des espaces Git.

Ces résultats restent locaux et ne valent pas validation de la production.

## Suite

La présentation commune des dossiers projets et commandes a été réalisée dans le [lot suivant](DOSSIERS_PROJETS_COMMANDES_2026-10-25.md), en conservant leurs phases, articles et conditions de remise. Les parcours taxi/livraison gardent leurs outils propres. L'accueil connecté reste une page distincte à cette étape ; son éventuelle fusion avec le centre n'est pas encore réalisée.

Publier le backend compatible avant l'interface lors d'une publication ultérieure, puis contrôler Render et Netlify. Aucun push ni déploiement dans ce lot.
