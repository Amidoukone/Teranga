# Cohérence des transports et de l’espace prestataire

Lot local du 27 octobre 2026, après [l’espace prestataire unifié](ESPACE_PRESTATAIRE_UNIFIE_2026-10-27.md). Les changements s’ajoutent aux lots locaux précédents. Aucun commit, push ni déploiement.

## Résultat

Le parcours reste **centre → intervention ou offre → dossier → réalisation et justificatifs → confirmation client → historique**. Les parcours taxi et livraison ont été exercés avec le serveur et MySQL locaux, sur téléphone et ordinateur. Les corrections portent sur les ruptures constatées pendant cette recette.

### Répondre à une offre

- Un refus dans le dossier ramène à la liste filtrée d’origine, ou au centre si l’offre avait été ouverte depuis celui-ci. Il ne recharge plus un dossier dont le prestataire vient de perdre l’accès.
- L’échéance apparaît également dans le dossier ; une proposition expirée ne permet plus de répondre depuis cet écran. Les erreurs de conflit reprennent le motif du serveur et actualisent la prise en charge.
- Le refus est vérifié sous verrou : propriétaire, statut ASSIGNED, acceptation en attente et délai valide. Il ne peut plus annuler une acceptation déjà enregistrée, y compris lorsque les deux requêtes arrivent ensemble. La réaffectation administrative reste un parcours distinct.
- Les boutons de réponse et de vérification du code de départ partagent la protection contre les doubles soumissions.

### Disponibilité du chauffeur

Le serveur refuse une déclaration de disponibilité qui effacerait une réservation taxi ou une course active, même si elle provient d’un ancien écran. L’écriture conditionnelle conserve une réservation faite pendant le contrôle de conformité. Une déclaration répétée du même état reste valide : le fait que MySQL signale zéro ligne modifiée ne signifie pas à lui seul un conflit.

Ces contrôles ne fusionnent pas les règles d’affectation taxi et livraison. Le véhicule attaché à une course, le code de départ et la prise en charge d’un colis gardent leurs règles propres.

### Réalisation et justificatifs

La recette a révélé qu’une affectation directe depuis l’outil spécialisé pouvait précéder la création de sa coordination. Le dossier ne proposait alors pas de compte rendu et pouvait ignorer une obligation prévue par le catalogue.

Les règles initiales sont maintenant calculées par la même fonction que la coordination. En l’absence de coordination persistée, le suivi peut lire ces règles sans créer d’étape ni faire avancer le travail. Un compte rendu requis reste bloquant avant COMPLETED. Son dépôt initialise les métadonnées nécessaires dans la transaction d’écriture, sans déclencher d’affectation automatique. Un compte rendu déjà existant conserve sa règle et ses justificatifs.

Quand le compte rendu est facultatif, son formulaire est replié et présenté comme tel. Un dossier terminé sans compte rendu facultatif n’affiche pas de panneau vide. Les cartes, codes de départ et commandes de réalisation devenus inutiles ne restent pas proposés après remise ou clôture. Les libellés prestataire distinguent remise au client et confirmation par celui-ci.

Les adresses se lisent correctement sur téléphone. En l’absence de GPS pendant un transport, le message indique une position indisponible et rappelle que les statuts restent la référence ; il ne prétend plus que l’exécutant n’a pas commencé à se déplacer. La confirmation finale et le lien de nouvelle demande sont regroupés, sans second message de confirmation identique dans le dossier.

### Montant reçu à la remise

Un seul champ nommé et facultatif remplace les deux saisies mobile/ordinateur du montant collecté par le livreur. La valeur, y compris zéro, est enregistrée **dans la même transaction que la remise du colis**. Un montant hors de la capacité de stockage est rejeté avant tout changement d’avancement.

Le suivi restitue la déclaration au prestataire et au client. Elle apparaît comme **montant déclaré par le livreur, à rapprocher**, séparément des règlements justifiés enregistrés. Elle ne crée aucune transaction financière, ne diminue aucun solde et ne confirme aucun paiement. La recette vérifie une déclaration de 750 XOF avec zéro paiement enregistré.

### Pays de la demande

Pour un client connecté qui choisit un autre pays que celui de son compte, les formulaires taxi et livraison transmettent désormais ce choix lors de la création, comme ils le font pour l’estimation. Le serveur peut ainsi vérifier la destination et rejeter une incohérence. Le parcours habituel dans le pays du compte conserve sa résolution territoriale existante. Les vérifications géographiques ne sont pas assouplies pour les tests.

## Validation

- **Backend complet : 598 tests réussis dans 86 suites**, après le correctif de compte rendu des affectations manuelles. Couverture supplémentaire : réponses concurrentes à une offre, refus périmé, réservation chauffeur, déclaration répétée, montant déclaré distinct des transactions et exigences du catalogue avant initialisation de la coordination. Le test de ce dernier cas confirme que le GET ne crée pas de coordination, que la remise prématurée échoue et que le dépôt du compte rendu rend la remise possible.
- **Interface complète : 406 tests réussis dans 81 suites**, puis **21 tests ciblés réussis** après les derniers ajustements du dossier (GPS, adresses et confirmation unique).
- **Navigateur simulé : 90 scénarios distincts couverts avec succès.** Le passage complet a réussi pour 89 scénarios ; les trois scénarios de la liste prestataire ont ensuite tous réussi en rejeu. Le seul échec du passage complet était une attente de recette : la panne était déclenchée avant la fin de la nouvelle recherche, donc aucun résultat de ce contexte n’avait encore été chargé. Le test attend désormais sa réponse réussie avant de vérifier la conservation des données hors ligne. Ne pas présenter ce résultat comme un passage unique de 90 scénarios tous réussis.
- **Navigateur réel : dernier passage de quatre scénarios réussi** sur serveur et MySQL isolés : création taxi/PIN/notification vers le dispatch ; course complète avec affectation, mauvaise puis bonne saisie du code, remise et historique ; livraison avec destinataire, photographie, déclaration de montant, confirmation et historique ; refus depuis le dossier avec retour aux filtres et révocation de l’accès. Les besoins de transport des nouveaux parcours sont créés par l’API ; le premier scénario vérifie aussi la création dans l’interface taxi.
- Captures réelles téléphone/ordinateur inspectées. Les derniers changements de présentation de la confirmation unique sont couverts par les 21 tests ciblés après ces captures.
- ESLint, compilation de production et contrôle syntaxique backend (318 fichiers) réussis. Contrôle des espaces Git adapté aux fins de ligne Windows. Les rapports et images de recette restent dans `artifacts/`, désormais ignoré par Git.

Les premiers passages ont corrigé un cas MySQL réel (déclaration inchangée), la rupture du compte rendu sans coordination et plusieurs attentes du nouveau jeu de recette : chargement de la disponibilité, choix territorial, véhicule réservé au taxi et recherche avant panne. Le dernier passage réel contient bien les quatre scénarios réussis ; les échecs intermédiaires ne sont pas masqués par un succès partiel.

## État et suite

Aucune migration, dépendance ou variable d’environnement applicative nouvelle. Le compte de transport ajouté au bootstrap appartient uniquement aux bases locales isolées de recette. Les serveurs temporaires et le conteneur MySQL de recette sont arrêtés après validation.

Cette validation locale ne remplace pas des retours de vrais utilisateurs. Les clés cartographiques ne sont pas configurées dans cette recette : le parcours sans GPS est vérifié, pas la précision du GPS ou les calculs cartographiques en conditions réelles. Stockage durable et notifications hébergées restent à contrôler dans leur environnement.

Le prochain contrôle utile est une démonstration de référence par rôle avec les utilisateurs concernés, puis une recette terrain taxi/livraison avec position réelle et assistance téléphonique. Toute publication éventuelle devra livrer le backend compatible avant l’interface ; ce lot reste local.
