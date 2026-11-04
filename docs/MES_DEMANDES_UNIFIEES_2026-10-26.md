# Mes demandes : services, projets et commandes

Lot local du 26 octobre 2026, après les projets et biens. Branche `master`, socle `1cb0a6d`. Ce lot et les lots précédents restent non commités. Aucun push ni déploiement.

## Parcours

`Mes demandes → recherche ou filtre → dossier → réalisation, justificatifs, paiements → retour à la même liste`.

- `/demandes` et son accès historique `/services` affichent les services, projets et commandes du client connecté, vingt dossiers par page.
- Une recherche et quatre vues communes : **En cours**, **À vérifier**, **Terminées**, **Toutes**. La vue En cours inclut les résultats ouverts à vérifier. Le type distingue service, taxi, livraison, projet et commande.
- Un seul lien principal par carte : suivre, vérifier le résultat ou consulter le dossier terminé. Les commandes affichent aussi un extrait de leur description pour être reconnaissables au-delà de leur référence. Les identifiants numériques peuvent coïncider entre familles : la clé est toujours `famille:id`.
- Les trois accès de création ouvrent directement le formulaire adapté : demander un service, nouveau projet, nouvelle commande. `?nouveau=1` ouvre immédiatement les formulaires projet/commande existants. Leur dossier conserve le retour vers la liste commune.
- Les retours projet/commande conservent vue, recherche, type et page, y compris après ouverture d'une section du dossier. Une suppression de projet autorisée conserve également ce retour.
- Le menu client donne directement accès à **Mes biens**. Les projets et commandes sont accessibles dans Mes demandes. Les pages spécialisées et `/dossiers` restent accessibles par leurs adresses existantes ; les outils agent et administrateur conservent leurs accès.

## Règles métier et confidentialité

La présentation commune ne fusionne pas les tables ni les cycles de vie. Un paiement enregistré ne livre pas une commande. Une commande expédiée ou payée n'apparaît jamais comme un résultat que le client doit confirmer.

La vue À vérifier contient les services dont le statut de référence est COMPLETED et les projets terminés qui disposent du suivi coordonné permettant la confirmation client. Un ancien projet sans coordination reste consultable ; aucune action de confirmation artificielle n'est ajoutée.

Les statuts historiques des missions viennent de `MISSION_HISTORY_STATUSES`. Les services classiques validés, projets validés/annulés et commandes livrées (`delivered` ou ancien `fulfilled`), annulées/remboursées appartiennent à Terminées. Une reprise liée à un service reste dans son dossier parent, comme dans le centre des opérations.

`GET /api/v1/requests` est réservé au rôle client. Chaque branche SQL impose le propriétaire (`Service.clientId`, `Project.clientId`, `Order.userId`) avant tout filtrage. Le pays de résidence et les sélecteurs territoriaux ne masquent pas les dossiers personnels à l'étranger. Un identifiant client ou un filtre géographique fourni à cette route est rejeté. Les autres rôles conservent leur centre et leurs écrans spécialisés.

La liste ne charge ni transactions, ni pièces jointes, ni coordonnées privées des autres participants. Seul le nom de l'intervenant utile au suivi est renvoyé. Les autorisations d'ouverture et de modification restent vérifiées par chaque dossier.

## Lecture complète et fiable

Une union SQL lit les trois familles, puis applique les filtres, le comptage et la pagination à l'ensemble. Aucun assemblage des vingt premiers éléments de trois listes n'est utilisé. Comptage et page partagent une transaction en lecture au niveau repeatable read. Le tri décroissant de création est départagé par famille et identifiant.

Les paramètres sont validés : page 1–100000, taille 1–50 (interface 20), recherche 200 caractères au maximum. Titres, descriptions et références de commande sont recherchables ; `#123` trouve l'identifiant dans chaque famille. `%`, `_` et `!` sont littéraux et les valeurs SQL sont liées. La réponse est `no-store`. Une erreur sur une famille provoque un échec explicite, jamais un total partiel présenté comme complet.

L'interface annule les requêtes précédentes et ignore leurs réponses tardives après changement de compte ou de filtre. Une actualisation hors ligne conserve les informations déjà chargées dans le même contexte ; une révocation d'accès les efface. Les filtres sont conservés dans l'URL. Une page devenue vide redirige vers la dernière page existante.

## Vérification

- Backend complet : **583 tests dans 84 suites**, puis **8 tests d'intégration MySQL ciblés réussis** après le dernier ajout de catégorie et d'extrait de commande. Couverture des pages profondes et totaux, recherche ancienne, caractères SQL, propriétaire, rôle, pays de résidence distinct, statuts, taxi/livraison et validation des paramètres. Ne pas présenter 584 comme un nouveau passage complet.
- Interface complète : **388 tests dans 80 suites**, puis **39 tests ciblés réussis** après l'harmonisation des libellés et l'extrait de commande. Couverture des cartes de trois familles ayant le même identifiant, des liens directs de création, du retour filtré et des réponses tardives.
- Compilation de production et ESLint réussis. Contrôle syntaxique backend : 315 fichiers. Contrôle des espaces Git réussi.
- Recette réelle locale : les **13 scénarios du passage courant** ont réussi sur serveur et MySQL isolés. Ils couvrent catalogue (2), finances (5), projets/biens (3), parcours complets agent/prestataire (2) et liste commune (1). Le nouveau parcours crée un projet puis une commande depuis Mes demandes, vérifie les retours, recherche et note de commande, et retrouve les deux familles dans l'API.
- Recette navigateur simulée complète : **87 scénarios réussis**, téléphone et ordinateur, dont les nouveaux retours projet/commande après ouverture des paiements, la recherche commune, les vues, les formulaires directs et la navigation conservée. Captures contrôlées sur téléphone et ordinateur. Serveurs de recette arrêtés après validation.

Le premier passage de la nouvelle recette a détecté les anciennes étiquettes « Suivre le service » / « Voir le service » sur les cartes de projets et commandes. Les libellés communs sont maintenant « Suivre ma demande » / « Consulter le dossier », en français et en anglais. Le rejeu réel a confirmé le parcours corrigé. Les pièces de recette utilisent le stockage local de test ; cette recette ne valide pas un hébergement de production.

## Suite

Poursuivre avec l'espace prestataire : disponibilité, offres, intervention, compte rendu, justificatifs et historique dans un parcours cohérent. Garder le centre pour savoir quoi faire, le dossier pour agir et les étapes facultatives. Les adaptations de production, notifications réelles et stockage durable restent des validations distinctes des recettes locales.

Si une publication est demandée ultérieurement, rendre la nouvelle route backend disponible avant de publier l'interface qui la consomme.
