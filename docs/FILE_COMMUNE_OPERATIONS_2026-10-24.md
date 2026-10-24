# Centre des opérations : À faire, À suivre, Informations

Deuxième lot de la [refonte d'unification](REFONTE_UNIFICATION_2026-10-24.md), après le [dossier service avec étapes et justificatifs](DOSSIER_SERVICE_ETAPES_2026-10-24.md).

## Parcours commun

Les comptes client, agent, prestataire et responsable disposent des mêmes trois entrées :

| Vue | Contenu | Compteur |
| --- | --- | --- |
| À faire | Dossiers dont une action attend l'utilisateur : résultat à vérifier, intervention à réaliser, étape à affecter ou contrôler, coordination à reprendre. | Dossiers filtrés nécessitant une action, après regroupement des étapes. |
| À suivre | Dossiers en cours qui attendent une autre personne, ou étapes encore suivies après la fin de leur service parent. | Dossiers filtrés sans action demandée à l'utilisateur courant. |
| Informations | Informations personnelles et historique de lecture, avec les filtres « À lire » et « Tout le suivi ». | Notifications personnelles non lues ; ce compteur ne mesure pas le travail à faire. |

Le centre s'ouvre sur « À faire ». Lire une information ne termine aucune étape. Consulter la file ne marque aucune information comme lue et ne change aucun statut métier.

Chaque carte présente la référence, le titre, les personnes et le territoire lorsqu'ils sont connus, une explication de l'action ou de l'attente, et un lien principal. Les échéances et le nombre d'étapes en attente complètent la carte sans créer une seconde liste du même travail. Les actions de réalisation, de validation et de gestion restent dans leurs dossiers ; aucune action métier n'est automatiquement exécutée depuis la consultation de la file.

## Une pagination pour tous les dossiers

Les services, projets, commandes et interventions autorisés sont réunis au serveur. Les étapes d'un service ou d'un projet accessible sont regroupées sous ce dossier **avant** la recherche finale, le comptage et la pagination. Une carte peut donc indiquer que plusieurs étapes attendent la même personne.

La liste comporte vingt dossiers par page. Elle ne provient pas de l'assemblage des vingt premiers éléments de chaque ancien module. Une ancienne demande reste atteignable, et les compteurs portent sur les résultats filtrés complets. Les escalades, la priorité de l'action et les échéances précèdent l'ordre stable par date et identité typée.

La recherche accepte le titre du dossier, le code d'une commande, le titre d'une étape autorisée ou une référence numérique avec ou sans `#`. Une recherche portant sur une étape conserve les autres étapes autorisées du dossier dans ses compteurs. Le filtre de famille porte sur le dossier regroupé : service, projet, commande ou intervention autonome.

Les vues, la recherche, la famille et la page figurent dans l'adresse. L'ouverture puis le retour depuis un dossier conservent ce contexte. Une page devenue vide après évolution du travail revient à la dernière page disponible.

## Droits et conservation du travail

- Le client voit son propre travail, y compris lorsque son pays de résidence diffère du pays d'exécution. Le pays choisi pour une nouvelle réservation ne masque pas ses dossiers existants.
- L'agent retrouve ses services et projets affectés, ses commandes coordonnées et ses tâches autorisées. Les missions affectées conservent les droits de suivi prévus par leurs endpoints, y compris les cas géographiques historiques.
- Le prestataire retrouve les missions affectées à son propre profil. Les autres familles et les tâches ne lui accordent pas de nouveaux droits. Une modification du statut de profil ne fait pas disparaître une mission que les règles existantes lui permettent encore de suivre.
- Le responsable garde son périmètre administratif ; la sélection pays/région le restreint davantage. Le repli régional existant sur une ressource sans région reste applicable selon la configuration de périmètre strict.
- Une tâche affectée seule à un agent ne révèle pas le titre, l'intervenant ou le contenu du service parent interdit. Elle devient une carte d'intervention limitée. Les tâches liées seulement à un bien, sans parent ou à un parent supprimé conservent leur place si leur statut et leurs droits les rendent encore pertinentes.
- Les sous-missions internes de transport restent invisibles au client comme dossiers de service. Une tâche historique autorisée qui s'y rattache conserve uniquement son espace limité.
- Les identités sont typées : un service et un projet ayant le même numéro restent deux dossiers. Les étapes ne sont pas déplacées et aucune nouvelle table universelle n'est créée.

Les états métier sont conservés. Le compte rendu final, le contrôle administratif d'une étape et la confirmation par le client restent distincts. Une étape ouverte ne termine pas automatiquement son service et n'introduit pas de nouveau blocage sur sa remise. Un service déjà terminé peut rester dans la file si ses étapes autorisées demandent encore du travail.

## Intervention limitée et gestion ciblée

`/tasks/:id` présente une intervention dans un cadre court : avancement, affectation si autorisée, justificatifs et retour vers la file. Ce cadre réutilise le composant d'étape existant. Le serveur retire les données du service et du bien parents, ainsi que les informations de créateur et les adresses de courriel ; un lien vers le service n'est fourni que si l'acteur peut le consulter.

Une action concernant une étape de service ouvre le dossier sur cette étape. Une étape de projet ou une intervention sans service ouvre son espace limité, en attendant le lot de refonte du dossier projet. Les pièces, les exigences d'envoi et les règles de suppression restent celles de chaque ressource.

Les responsables gardent les outils existants dans un accès secondaire « Outils de coordination ». Les liens de coordination ciblés et l'ancienne URL `/admin/operations` restent fonctionnels. Les réglages et brouillons déjà ouverts sont conservés lors du passage aux informations puis du retour à la coordination. Ils sont réinitialisés lors d'un changement de compte, de rôle ou de territoire.

Un problème signalé ouvre la liste des litiges du dossier précis, en conservant le contrôle géographique. Le retour à tous les litiges est explicite ; une réponse tardive d'un ancien filtre ne remplace pas le cas courant.

## Informations et compatibilité

Les anciennes URL `/notifications`, `/activities`, `/operations?vue=a-lire`, `/operations?vue=historique` et les liens `vue=coordonner` sont conservés. Les deux premières vues historiques mènent désormais à la section Informations, avec le mode de lecture correspondant.

La réconciliation activité/notification, les protections de version lors de la lecture et de la suppression, et le nettoyage explicite restent en place. Une information ne donne pas automatiquement accès au dossier qu'elle mentionne : les écrans et endpoints vérifient toujours les droits actuels.

## Interruptions et fiabilité

La file active et visible est actualisée toutes les trente secondes, ainsi qu'au retour de la connexion. Les vues cachées ne lancent pas leur actualisation de travail. Une interruption conserve les résultats du même contexte et affiche une erreur ; une révocation d'accès retire les cartes et leurs compteurs. Les réponses d'un ancien compte, rôle, périmètre, filtre ou numéro de page sont ignorées.

Si une source nécessaire à la projection est indisponible, le serveur renvoie une indisponibilité explicite. Il ne présente pas une file partielle comme un ensemble complet ou comme « aucune action ». La section Informations demeure indépendante.

Les résultats et leurs compteurs sont calculés dans une transaction de lecture avec un instantané cohérent. Les données nécessaires à l'affichage sont limitées aux cartes paginées ; les noms de pays et régions sont chargés par lots. Le calcul de la file ne déclenche ni initialisation de coordination, ni affectation, ni transition de statut.

## Contrat et publication

- `GET /v1/operations/workspace?view=action|following&kind=all|service|project|order|task&q=…&page=1&limit=20` renvoie `items`, `pagination`, `summary` et l'heure serveur. Les paramètres pays/région facultatifs restreignent les droits existants ; ils ne les remplacent pas.
- `GET /tasks/:id/workspace` renvoie la tâche autorisée, ses capacités et un éventuel identifiant de service parent accessible.
- `GET /v1/missions/disputes?serviceId=…` accepte le ciblage facultatif d'un dossier, avec ses droits administratifs habituels.

Le contrat OpenAPI décrit ces lectures. Les écritures existantes sont réutilisées. Aucune migration, dépendance ou variable d'environnement nouvelle n'est ajoutée. Le backend compatible doit être publié avant l'interface. Ce lot et les précédents restent locaux tant qu'aucune publication n'est demandée.

## Validation locale

- Backend : **558 tests réussis**, dont 15 tests d'intégration MySQL dédiés à la file ; contrôle du contrat OpenAPI rejoué après la mise à jour de sa documentation : **3 tests réussis**.
- Interface : **268 tests réussis** dans 65 suites ; contrôles du code backend et interface et compilation de production réussis.
- Navigateur avec API simulée : **14 scénarios réussis**, sur téléphone et ordinateur, couvrant la file, les anciennes entrées, la coordination et les étapes intégrées.
- Navigateur avec vrai serveur et MySQL isolé : **13 scénarios distincts réussis**. La recette complète a validé 12 scénarios ; les deux nouveaux scénarios ont ensuite été rejoués avec succès après correction de la création du bien dans la fixture de recette.
- Analyse Gitleaks des **852 fichiers publiables** : aucun secret détecté. Contrôle des espaces par Git réussi.

Les contrôles portent notamment sur le regroupement avant pagination, les références anciennes, les tâches sans service, l'absence d'accès indu au parent, les rôles et territoires, les filtres de retour et la distinction entre lecture et réalisation. La recette réelle vérifie une carte regroupant trois étapes, l'ouverture de l'étape exacte, le début de son exécution et une intervention liée uniquement à un bien, sans service ajouté artificiellement.

## Suite

La prochaine étape de simplification concerne la navigation et les accès redondants, après vérification des contextes de biens, projets, commandes et interventions historiques. Ce lot conserve les menus existants pour que chaque capacité reste accessible pendant la transition.
