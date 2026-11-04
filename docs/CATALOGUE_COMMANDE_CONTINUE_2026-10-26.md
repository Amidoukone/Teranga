# Catalogue, commande et paiements : un parcours continu

## Objectif et résultat

La suite logique du journal intégré était de supprimer les détours avant l'ouverture du dossier commande. Le catalogue utilisait une fenêtre de commande indépendante, fermée avant la réponse du serveur ; la fiche produit ne permettait pas de commander. Un échec faisait perdre le formulaire, et les filtres du catalogue disparaissaient au retour.

Le parcours courant devient : **article → quantité et instruction facultative → création → dossier avec suivi et paiements**. Il est possible de commander directement dans une carte du catalogue ou depuis la fiche article, avec le même formulaire. La fiche n'est pas une étape obligatoire.

## Interface

- La recherche et la catégorie restent visibles. Les prix et le tri sont repliés, avec filtres et pagination conservés dans l'URL. La saisie de recherche ne recharge pas l'écran à chaque lettre ; le bouton Rechercher applique la recherche.
- Une carte montre le nom, la description, le prix et le stock. Le nom et la photo ouvrent la fiche ; Commander déplie le formulaire sur place. Replier le formulaire conserve son brouillon.
- Le formulaire montre la quantité, le total des articles, une instruction facultative et Créer la commande. Il ne demande ni prix unitaire ni validation supplémentaire dans une fenêtre.
- Le dossier créé ouvre le suivi et le journal commun déjà intégrés. Le retour retrouve le catalogue filtré, ou la fiche puis sa recherche d'origine.
- Les ancres des sections pouvaient effacer l'état du routeur et faire perdre ce retour. L'en-tête conserve désormais le point d'entrée pendant sa présence dans le dossier, même après l'ouverture des paiements. Un accès direct sans cet historique garde son retour habituel à la liste.
- La fiche utilise le nom de l'article comme titre, les codes de devise comme le dossier et des informations secondaires repliées. Une fiche sans photo ne réserve plus un grand espace vide. Les photos existantes, vignettes et agrandissements restent disponibles dans la fiche.
- L'API produits nécessite déjà une connexion. Un visiteur reçoit une entrée de connexion explicite, qui conserve la destination demandée, sans tentative de lecture non autorisée du catalogue. Les agents et responsables consultent les articles ; le formulaire d'achat du catalogue est réservé au client. La création administrative demeure dans Commandes.

## Règles conservées

Le serveur continue à fixer le prix, vérifier le territoire et la devise, verrouiller les articles et déduire le stock lors de la création. Le formulaire envoie les références de l'article, sa quantité, sa devise et son territoire, sans prix unitaire ni modification des statuts de réalisation ou de paiement.

La quantité doit être un entier positif, dans le stock connu. Un refus serveur, notamment si le stock a changé depuis l'affichage, reste visible dans le formulaire avec sa saisie. La soumission en cours bloque les envois répétés. Ce verrou est une protection de l'interface ; il n'ajoute pas de mécanisme d'idempotence au serveur.

Les réponses des anciens filtres ou territoires sont ignorées. Une indisponibilité temporaire du catalogue conserve les résultats et brouillons du contexte courant ; une révocation d'accès retire les articles. Un changement de compte ou de territoire réinitialise les données et les brouillons concernés.

Les paiements se font toujours hors de Teranga. Le journal enregistre les écritures et leurs reçus ; sa saisie ne livre pas la commande et ne la marque pas payée. Les règles de contrôle administratif, de devise et d'unicité des écritures restent celles du lot précédent.

Aucune API métier, migration, dépendance ou configuration privée ajoutée. Les produits et reçus de recette sont fictifs, dans une base MySQL locale isolée et le stockage local de test.

## Validation

Le passage ciblé a validé **20 scénarios navigateur** : achat depuis les deux écrans à 360 et 1440 pixels, paiements dans le dossier, conservation du retour et du brouillon, double soumission, accès agent et visiteur, ainsi que les dossiers projets et commandes existants.

Le passage avec serveur et MySQL isolé a validé **7 scénarios réels**, dont deux nouveaux parcours catalogue et fiche : prix réel et total décimal, diminution du stock, refus serveur après modification du stock, reprise du brouillon, écriture avec reçu et statuts de commande préservés. Les cinq autres scénarios contrôlent les finances des services, projets, commandes et étapes limitées. Les avertissements de stockage local correspondent au mode de recette ; ce passage ne valide pas le stockage hébergé.

Les premiers passages navigateur ont permis de corriger l'exposition de l'état de connexion dans le contexte et la perte du retour après une ancre. Les passes interrompues pendant ces corrections ne sont pas comptées comme des validations réussies.

Après le dernier allègement visuel, les contrôles finaux sont réussis :

- **371 tests interface dans 78 suites**, passage complet.
- **78 scénarios navigateur avec API simulée**, passage complet, dont les sept nouveaux scénarios catalogue et fiche. Le passage ciblé de 20 scénarios est inclus dans ce total et ne s'y additionne pas.
- ESLint interface, compilation de production et contrôle des espaces Git réussis.
- Captures du catalogue et de la fiche examinées à 360 et 1440 pixels ; absence de débordement horizontal vérifiée dans les nouveaux parcours. Artefacts locaux dans `frontend/test-results/catalogue-direct-final/` et `catalogue-direct-real/`.

Le passage réel de sept scénarios précède le dernier allègement visuel de la fiche ; les règles et formulaires de commande/paiement restent ceux de ce passage. Le backend métier n'a pas changé et sa suite complète n'a pas été relancée pour ce lot.

## Repères et suite

- Catalogue : `frontend/src/features/shop/CatalogWorkspace.jsx`, export compatible `pages/ProductCatalogPage.jsx`.
- Commande d'article commune : `features/orders/ProductOrderForm.jsx`, `features/shop/ProductPurchase.jsx`.
- Fiche : `pages/ProductDetailPage.jsx` ; images et retour du catalogue : `features/shop/productDisplay.js`.
- Accès et retour du dossier : `contexts/GeoContext.jsx`, `features/shop/useShopAccess.js`, `components/DossierHeader.jsx`.
- Recettes : `e2e/catalogue-to-order.spec.js`, `e2e-integration/catalogue-to-order.real.spec.js`.

Le lot s'ajoute aux modifications locales de recette par rôle et de commandes/paiements intégrés. Le dernier commit demeure `1cb0a6d` ; aucun commit, push ou déploiement n'est effectué dans ce lot.

La prochaine étape utile est une recette de démonstration sur des dossiers représentatifs avec les utilisateurs de chaque rôle, pour vérifier la compréhension des libellés et des montants. Conserver le principe du dossier unique, puis corriger les frictions observées avant toute nouvelle extension.
