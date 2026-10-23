# Cohérence financière et territoriale

## Règles appliquées

Les bilans ne convertissent pas les devises. Une opération en GHS et une opération en GNF ne produisent pas un montant global additionné. Le bilan respecte la formule `revenus - dépenses - commissions + ajustements` ; un ajustement négatif réduit le solde.

Le tableau financier charge toutes les pages de transactions du périmètre sélectionné avant d'établir ses totaux et son export. Une interruption est signalée ; l'export est désactivé pendant le chargement ou après une erreur. Le changement de pays recharge les données ; une réponse tardive de l'ancien périmètre ne peut pas remplacer le bilan courant. La devise sélectionnée s'applique aux totaux, moyennes, comparaisons, graphiques, détails par rôle et exports.

Le détail d'un projet affiche ses montants et les bilans de ses transactions dans leurs devises respectives. Les formulaires de transactions de service, projet et commande héritent de la devise de l'opération ; un choix explicite reste prioritaire. Une lecture de justificatifs liés à une opération s'appuie sur les autorisations de cette opération plutôt que sur le pays mémorisé dans la navigation.

## Contrat des API de rapport

`GET /api/v1/transactions/summary` accepte les filtres `countryId`, `regionId`, `currency`, `serviceId`, `taskId`, `orderId`, `projectId`, `type` et `status`. Les filtres restreignent les droits du demandeur et ne remplacent jamais son périmètre autorisé. L'accès aux rapports reste réservé aux administrateurs.

La réponse conserve les champs `revenues`, `expenses`, `commissions`, `adjustments` et `balance` pour un résultat dans une seule devise. Elle ajoute `currency`, `count`, `multiCurrency` et `byCurrency`.

Avec plusieurs devises, les montants globaux et `currency` valent `null`, `multiCurrency` vaut `true`, et chaque élément de `byCurrency` contient ses propres montants et son solde. Ajouter `currency=GHS`, par exemple, permet de demander un bilan dans une seule devise. Un résultat vide contient des montants à zéro, `currency: null` et `byCurrency: []`.

`GET /api/v1/transactions/report` applique les mêmes règles et accepte `startDate` et `endDate`. Une période invalide est refusée avec le statut `400`. Chaque élément de `byCurrency` contient `currency`, `count`, `balance` et `totals` (`revenue`, `expense`, `commission`, `adjustment`). `totalsWithLabels` indique la devise de chaque montant. Les montants du champ global `totals` valent `null` si plusieurs devises sont présentes.

Les agrégations s'effectuent en SQL par devise et par type ; le serveur ne charge pas les justificatifs et les lignes détaillées pour établir un rapport.

## Recette

### Modifications et historique

Le propriétaire conserve l'accès à ses services, projets, phases et documents exécutés dans un autre pays. Les contrôles de propriété et la limite d'une heure pour modifier un projet restent applicables. Les administrateurs locaux et agents restent soumis à leur périmètre.

La création et la modification d'une affectation de projet vérifient le rôle et le périmètre de l'agent. Une désaffectation explicite utilise `agentId: null`. Un changement de pays sans région efface la région précédente ; une région appartenant à un autre pays est refusée. Le déplacement géographique est bloqué après démarrage ou présence de tâches, transactions, phases ou documents, selon le module, pour préserver la cohérence de l'historique. Un simple changement de description reste possible selon les droits habituels, même si le pays ou l'offre ont ensuite été désactivés.

Les transactions vérifient l'existence, les droits et la cohérence géographique de tous leurs rattachements. Une tâche doit appartenir au service indiqué. Un rattachement modifié déduit sa géographie de l'opération cible sans réutiliser une région de l'ancien pays ; le montant et la devise enregistrés restent inchangés sauf modification financière explicite par un administrateur. Le formulaire de création d'un paiement lié ne lui injecte plus la sélection géographique de navigation. Un doublon de paiement de commande dans une autre devise renvoie `409`.

Les justificatifs remplacés sont supprimés après enregistrement de leur remplacement. Une validation refusée conserve la preuve existante ; un échec d'enregistrement nettoie le nouveau fichier. L'interface utilise `PUT` pour remplacer un justificatif. Une réponse métier ou une panne réseau ne provoque plus plusieurs soumissions ; seul un rejet explicite du nom du champ fichier permet l'essai d'un autre alias compatible.

Les anciennes routes de création de services respectent aussi le catalogue local lorsqu'il est configuré. Un changement de type doit y être disponible. Réenregistrer le même type pour préciser une opération historique ne dépend pas de la disponibilité actuelle.

Les grilles tarifaires exigent un pays existant, une région et une filière compatibles, et un prix de base pour une estimation chiffrée active. Elles peuvent être préparées sur un pays inactif. Le changement de devise d'un pays renvoie `409` tant que des grilles chiffrées sont actives : les désactiver, changer la devise, réviser leurs montants puis les réactiver. Cette procédure ne convertit aucun prix automatiquement.

### Parcours à vérifier

1. Utiliser un pays de test en GHS, un second en USD et un compte client rattaché au premier pays.
2. Créer un service et un projet dans le second pays. Vérifier USD, l'absence d'une région héritée du compte et le refus d'une région du premier pays.
3. Créer des transactions en GHS et GNF pour un projet. Vérifier les deux bilans séparés et le montant du budget dans la devise du projet.
4. Changer la devise du bilan puis le pays pendant un chargement. Vérifier les totaux, les libellés et l'export.
5. Depuis un administrateur local, demander un rapport d'un autre pays puis tenter d'y créer ou déplacer une transaction : le rapport est vide et les mutations sont refusées.
6. Depuis le client, consulter les tâches et justificatifs de son propre service exécuté à l'étranger. Vérifier aussi le refus d'une opération appartenant à un autre client.
7. Désactiver un pays ou une région projetés. Vérifier les états des territoires utilisés par le catalogue. Vérifier également l'héritage des fuseaux sans modifier les régions qui possèdent leur propre fuseau.
8. Modifier un projet étranger depuis son propriétaire, consulter ses documents et phases, puis vérifier les refus pour un administrateur d'un autre pays.
9. Essayer d'affecter un agent d'un autre pays, puis désaffecter avec `null`. Déplacer un projet neuf et vérifier le refus du déplacement après création d'une transaction.
10. Modifier un rattachement de transaction avec un identifiant inexistant ou des opérations de pays différents : aucun changement ne doit être enregistré. Effectuer ensuite une correction valide et vérifier que la devise historique est conservée.
11. Désactiver une disponibilité locale et vérifier que l'ancienne API `/services` refuse la création tout en permettant de préciser une opération existante. Vérifier le blocage du changement de devise en présence d'une grille chiffrée active.

Depuis `backend`, utiliser `REQUIRE_INTEGRATION_DB=true` pour rendre obligatoire l'exécution réelle de `tests/integration/local-currency-flows.test.js` sur MySQL. Le scénario vérifie aussi le rollback d'une mise à jour pays en cas d'échec de la projection. Les tests ne modifient pas la production et nettoient leurs données de recette.

La base de recette doit contenir les migrations du catalogue, notamment `20260831150000-create-service-catalog-foundation.js`. La recette échoue si ces tables sont absentes. `transactionContext.service.test.js` et `transaction.controller.update.test.js` complètent ces parcours avec les incompatibilités entre liens et la conservation des justificatifs en cas d'échec.

Les scénarios d'interface sont couverts par `FinanceDashboardPage.test.jsx`, `ProjectCurrencyFlows.test.jsx`, `LocalCurrencyFlows.test.jsx` et `services/transactions.test.js`. Les contrôles d'ouverture régionale et de périodes de validité sont couverts par `pilotReadiness.service.test.js` et `serviceCatalog.controller.test.js`.
