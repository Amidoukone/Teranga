# Coordination et affectations — quatrième étape

Ce lot prolonge les [listes et dossiers simplifiés](DEMANDES_DOSSIERS_2026-10-24.md). Il rapproche la prise en charge par un responsable, l'affectation et le travail de l'agent dans le centre des opérations, sans changer les transitions métier ni les autorisations.

## Trouver le travail à traiter

- La file propose les vues générales, les dossiers à débloquer et les dossiers suivis par le responsable connecté.
- La recherche accepte le titre d'un service ou projet, le code d'une commande et une référence numérique, avec ou sans `#`.
- La priorité des dossiers signalés puis des échéances est appliquée au serveur avant la pagination. Les filtres de responsable, de recherche et de territoire précèdent également le comptage.
- La vue commune présente au maximum 25 dossiers par famille et indique cette limite. Sélectionner une famille donne accès à sa pagination complète, par pages de 25.
- Une ouverture sur une référence précise affiche directement ce dossier, sans répéter les filtres généraux.

Chaque carte distingue le responsable du suivi et l'intervenant, affiche la prochaine échéance et donne un accès principal au dossier. Les réglages d'affectation sont dans un panneau secondaire. Pour une mission réalisée par un prestataire, la carte présente ce prestataire plutôt que son agent superviseur.

## Prendre en charge et affecter

Prendre la responsabilité du suivi conserve le mode de coordination existant. Cette action ne désactive plus implicitement une recherche automatique. Le lancement d'une recherche automatique reste une action explicite.

Un service classique encore à affecter peut recevoir un agent directement depuis sa carte. Les projets et commandes disposent aussi d'une affectation directe et du réglage de leur délai. Modifier uniquement ce délai conserve le mode de recherche ; changer l'agent confirme une affectation manuelle. Les listes d'agents sont chargées à l'ouverture du formulaire et restent limitées au périmètre. L'agent déjà affecté reste visible lorsqu'il n'apparaît pas dans la liste retournée.

Les missions spécialisées, dont taxi et livraison, conservent leurs outils existants. Le lien d'une mission vers la gestion des services ou livraisons cible sa référence pour éviter une nouvelle recherche. Le suivi d'un projet ou d'une commande conserve son dossier dédié.

Les brouillons résistent aux actualisations de la file. Si une nouvelle affectation est reçue pendant la saisie, l'enregistrement est bloqué jusqu'à relecture de l'affectation actuelle ; le délai saisi est conservé. Ce contrôle porte sur les changements déjà observés par l'interface et ne constitue pas un verrou transactionnel supplémentaire au serveur.

## Fiabilité et continuité

- Les réglages d'offres, la préparation du territoire et les agents sont chargés séparément, au besoin. Leur indisponibilité ne masque pas la file de travail.
- Fermer les réglages d'offres ou subir une interruption réseau conserve leurs formulaires déjà chargés. Les mécanismes existants de suspension et de configuration sont préservés.
- Une actualisation réseau échouée conserve les données du même contexte. Un refus d'accès les retire. Les réponses d'un ancien territoire, filtre ou dossier ne remplacent pas le contexte courant.
- L'actualisation périodique concerne uniquement la vue active et visible. Les doubles envois sont bloqués sur les actions d'avancement et les réglages ; le compte rendu ne peut pas être modifié pendant son envoi.
- Le suivi d'un projet et celui d'une commande restent isolés, y compris lorsque leurs identifiants numériques sont identiques.

Les contrôles serveur de droits, de territoire et de transitions restent applicables. Les règles existantes de capacité et de disponibilité ne sont pas étendues par ce lot.

## Contrat et publication

`GET /operations` accepte les paramètres facultatifs `owner=me` et `q`. L'ordre des priorités est stable avant pagination pour les trois familles. L'accès administratif aux services accepte aussi un `id` précis, toujours soumis aux droits géographiques. Le contrat OpenAPI des opérations est actualisé.

Aucune migration, dépendance ou variable d'environnement n'est ajoutée. Publier le backend avant l'interface afin que les nouveaux filtres fonctionnent. Les quatre étapes de simplification restent locales, non commitées et non déployées à l'issue de cette intervention.

## Validation locale

- 535 tests backend réussis. Les nouveaux cas vérifient les urgences au-delà de la première page, les recherches et responsables sur les trois familles, les restrictions géographiques et la conservation du mode automatique lors de la prise en charge. Après l'ajout du nom du prestataire dans la liste, les 34 tests de coordination ont été rejoués avec succès.
- 226 tests interface réussis. Les 16 tests de la file ont été rejoués après le dernier contrôle des changements d'affectation pendant la saisie.
- 18 scénarios Chromium avec API simulées réussis pour les accueils, le centre commun et la coordination.
- 10 scénarios Chromium avec vrai serveur et MySQL réussis. Le nouveau parcours affecte une commande depuis le centre sur téléphone, puis vérifie que l'agent peut en commencer la préparation. La remise des justificatifs, la validation client et les parcours de transport existants restent couverts.
- Contrôles du code backend et frontend, compilation de production et recherche de secrets dans les fichiers publiables réussis.

Cette étape ne refond pas entièrement les écrans détaillés des projets, commandes et anciennes listes administratives. La validation terrain et les vérifications de configuration de production restent celles du [bilan de préparation](PREPARATION_TERRAIN_2026-10-24.md).
