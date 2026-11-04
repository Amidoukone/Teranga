# Espace prestataire : interventions, offres et historique

Lot local du 27 octobre 2026, après [Mes demandes](MES_DEMANDES_UNIFIEES_2026-10-26.md). Les modifications s’ajoutent aux lots déjà présents. Aucun commit, push ni déploiement.

## Parcours et disposition

**Le centre indique quoi traiter et gère la disponibilité. Mes interventions retrouve le travail courant et passé. Le dossier permet d’intervenir, de rendre compte et de consulter les justificatifs.**

Les trois listes prestataire (services, courses, livraisons) partagent désormais `/prestataire/interventions`, nommé **Mes interventions** dans le menu ordinateur et téléphone. Le menu principal prestataire contient le centre et cette liste commune ; les réglages restent dans le menu du compte.

- **En cours** : interventions ouvertes, offres valides en tête, y compris les propositions anciennes situées au-delà des vingt premiers dossiers. Les résultats remis restent ici en attendant la confirmation du client.
- **Offres à accepter** : propositions affectées, au statut ASSIGNED, dont le délai reste valide. Accepter ouvre directement le bon dossier ; Refuser actualise la liste. Les détails restent consultables avant de répondre.
- **Historique** : statuts terminaux de `MISSION_HISTORY_STATUSES`, notamment validées, clôturées ou annulées. COMPLETED attend encore le client et n’est pas archivé.

Recherche par titre, description, adresse ou numéro et filtre Services / Taxi / Livraisons sur toute la collection autorisée, avec vingt interventions par page. Vue, recherche, filtre et page restent dans l’URL et sont conservés au retour du dossier, y compris après acceptation.

Les anciens favoris `/prestataire/services`, `/chauffeur/courses` et `/livreur/livraisons` ouvrent la liste commune avec leur type présélectionné. `/missions/mine` l’ouvre pour le prestataire et garde son écran pour l’agent. Les dossiers services, taxi et livraison conservent leurs parcours métier : position, code de départ, collecte et remise restent spécialisés.

## Disponibilité et réalisation

Le centre reste le seul lieu de déclaration de disponibilité, accessible depuis la liste. Il ne charge pas une seconde liste d’archive. Le véhicule éligible est visible même lorsqu’il est unique ; le choix entre plusieurs véhicules est conservé. Un refus GPS ne bloque pas la disponibilité. Une réponse GPS reçue alors que le panneau est devenu inactif ne déclenche plus de déclaration tardive.

Chaque carte indique la prochaine action. **Compte rendu et justificatifs** ouvre le dossier existant pour un travail remis ou archivé, sans copie de pièce ni étape supplémentaire. Les libellés prestataire précisent que la confirmation attend le client. Les étapes facultatives et interventions liées aux biens sont conservées.

Les paiements restent indépendants : aucune écriture financière n’accepte une offre, ne termine une intervention ni ne confirme son résultat. Aucun modèle métier, migration, dépendance ou paramètre d’environnement applicatif nouveau.

## Droits et fiabilité

`GET /api/v1/missions/mine` applique le propriétaire avant tout filtrage : prestataire dérivé du compte connecté ou agent superviseur connecté. La sélection géographique ne masque pas ses affectations à l’étranger et ne donne aucun droit supplémentaire.

Recherche, type, vue, comptage et pagination sont appliqués au serveur. Le tri actif place les offres valides en tête, puis utilise création et identifiant décroissants. Les anciens filtres de catégorie et la pagination par décalage restent acceptés. La route et ses nouveaux paramètres sont documentés dans OpenAPI ; les paramètres inconnus, notamment un identifiant de prestataire fourni par le navigateur, sont rejetés. Réponse `no-store`.

La recherche SQL utilise `LOCATE` avec échappement Sequelize : `%`, `_` et antislashs restent littéraux. `#123` retrouve aussi l’identifiant exact. Recherche limitée à 200 caractères, page 1–100000, taille 1–200 pour compatibilité ; l’interface utilise 20.

L’interface annule les lectures précédentes et ignore les réponses tardives d’un ancien filtre ou compte. Une panne conserve les données déjà lues dans le même contexte, avec erreur visible ; une révocation les retire. Une page devenue vide revient à la dernière page existante. Les réponses aux offres sont protégées contre les doubles soumissions. Une acceptation achevée après changement de compte ne provoque pas de navigation. Une offre expirée encore affichée est désactivée, puis retirée au rafraîchissement ; le serveur garde l’autorité sur les mutations.

## Validation

- **Backend complet : 590 tests réussis, 85 suites**, sur MySQL local isolé. Les six nouveaux tests d’intégration vérifient pagination profonde, offre ancienne prioritaire, expiration, statuts, trois types, recherche littérale, droits personnels à l’étranger, supervision agent et paramètres invalides. Le premier passage a révélé deux doubles de réponse HTTP à adapter pour `no-store` ; le passage complet final réussit.
- **Interface complète : 397 tests réussis, 81 suites**, puis **18 tests ciblés réussis** sur la liste et le dossier après le dernier ajustement du libellé de retour. Couverture des routes spécialisées, filtres, offres, doubles clics, conflit d’affectation, expiration, panne, révocation et réponses tardives.
- **Navigateur simulé : 21 scénarios distincts validés**, téléphone et ordinateur. Le passage de 21 a réussi pour 19 ; les trois scénarios de la nouvelle liste ont ensuite tous réussi en rejeu ciblé. Les deux échecs venaient des attentes de recette : attendre le filtre appliqué avant le clic suivant et attendre la page 1 après une liste vide. Ce résultat n’est pas un nouveau passage complet de 90 scénarios. Captures offres/historique contrôlées aux deux dimensions.
- **Serveur réel et MySQL isolé : deux parcours continus réussis**, agent et prestataire. Le parcours prestataire vérifie aussi la recherche dans Mes interventions, l’attente du client, l’ouverture du compte rendu avec sa photographie, le retour filtré et l’historique après confirmation. Reçu financier et justificatif de réalisation restent accessibles séparément. Les 13 scénarios du bilan précédent n’ont pas été rejoués en bloc.
- Compilation de production, ESLint et contrôle syntaxique backend (317 fichiers) réussis. Contrôle des espaces Git adapté aux fins de ligne Windows.

Les tests utilisent un conteneur MySQL local dédié, sans réutiliser de base métier. Les serveurs de recette et ce conteneur ont été arrêtés après validation. Les pièces de recette emploient le stockage local de test ; cela ne valide ni stockage hébergé ni notifications de production.

## Suite

Recueillir les retours d’un prestataire sur téléphone : disponibilité et offres, compte rendu, distinction entre résultat remis et confirmé, retour à une ancienne intervention. Ajuster les clics réellement gênants. Prévoir ensuite une recette terrain dédiée taxi/livraison pour positions, codes de départ et conditions de remise.

Pour une publication ultérieure, rendre d’abord le backend compatible avec `kind`, `q` et `view=offers`, puis publier l’interface. Ce lot n’autorise aucune publication.
