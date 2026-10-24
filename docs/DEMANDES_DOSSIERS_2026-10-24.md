# Demandes et dossiers — troisième étape

Ce lot prolonge les [accueils par rôle](ACCUEILS_ACTIONS_2026-10-24.md) et le [centre des opérations commun](FUSION_CENTRE_OPERATIONS_2026-10-24.md). Il simplifie la liste des demandes du client et le détail des services et missions, y compris la consultation du résultat des courses et livraisons.

## Liste des demandes

- Une seule liste avec les vues « En cours », « À vérifier », « Terminées » et « Toutes ». Les demandes en cours incluent les résultats qui attendent encore une confirmation.
- Une recherche par texte ou référence, et un filtre par famille : service, taxi ou livraison.
- Les vues, la recherche et les familles sont filtrées au serveur avant comptage et pagination. Les compteurs concernent l’ensemble des résultats filtrés, pas seulement la page chargée.
- Vingt demandes par page, avec un ordre stable lorsque plusieurs demandes ont la même date. Une page devenue vide après une évolution des dossiers revient à la dernière page disponible.
- Une carte courte : référence, titre, statut, intervenant lorsqu’il est connu, indication de la prochaine étape et un seul lien principal vers le bon dossier.
- La création reste accessible par « Nouvelle demande ». Les doubles accès taxi/livraison, encarts répétés et anciens compteurs limités aux données chargées sont retirés de cette liste.

Les filtres et la page figurent dans l’adresse. L’ouverture puis le retour depuis un dossier conserve ce contexte. Les anciens accès `/services` et `/demandes?vue=a-verifier` continuent de fonctionner.

## Dossiers

- Sur un service classique, le compte rendu et ses justificatifs précèdent l’unique bouton de confirmation. Les actions restent dans le contenu, sans deuxième bouton de validation flottant sur téléphone.
- L’agent voit la prochaine action appropriée : commencer, préparer le compte rendu ou remettre le résultat lorsque les pièces requises sont présentes. L’interface ne remplace pas les vérifications serveur.
- Le détail, les liens vers tâches et règlements et l’assistance restent accessibles dans des panneaux secondaires. Les montants restent séparés de la confirmation du résultat.
- Sur une mission remise au client, le résultat, les pièces, la confirmation et le signalement d’un problème sont réunis en haut du dossier. Une erreur de confirmation apparaît près de cette action.
- Les actions mobiles spécialisées du chauffeur et du livreur, ainsi que le code de départ, sont conservés. Les interventions hors transport utilisent une action dans leur contenu.
- L’avancement sur téléphone affiche l’étape actuelle en texte lisible, avec les cinq repères accessibles. Les intitulés complets de toutes les étapes restent affichés sur écran plus large.
- Le type des pièces est détecté automatiquement comme auparavant. Son réglage est secondaire ; il est ouvert immédiatement lorsque les justificatifs requis comprennent un reçu ou un autre type à préciser.

Une nouvelle demande depuis une mission hors transport ouvre le parcours de service, sans basculer vers le taxi. Un administrateur suivant un ancien lien de service vers une mission rejoint la page de gestion adaptée à son rôle.

## Fiabilité et compatibilité

Les paramètres facultatifs `view=active|history` et `kind=all|service|taxi|delivery` complètent les filtres existants de `GET /services/me`. La recherche `q` accepte une référence numérique, avec ou sans `#`. Les droits du destinataire et le périmètre administratif restent vérifiés. Le contrat OpenAPI est mis à jour.

Les réponses tardives d’un ancien compte, périmètre, filtre ou dossier sont ignorées. Une actualisation échouée conserve les données du même contexte ; une révocation d’accès les retire. Les brouillons du compte rendu et la reprise des envois restent disponibles.

Aucune migration, dépendance ou variable d’environnement n’est ajoutée. Publier le backend avant l’interface afin que les listes utilisent les nouveaux filtres. Les trois lots sont conservés localement ; ce travail ne déclenche pas de déploiement.

## Validation locale

- 529 tests backend réussis, dont les filtres avant pagination, l’accès à une ancienne demande au-delà de 100 dossiers récents, les statuts de mission prioritaires, les familles, les références et l’ordre des pages.
- 218 tests interface réussis, dont le compte rendu avant confirmation, les liens de retour, le changement de dossier, les interruptions réseau et la visibilité du type de reçu requis.
- 15 scénarios Chromium avec API simulées réussis, dont recherche, pagination, retour aux filtres et consultation des pièces sur téléphone et ordinateur, ainsi que les accueils et les parcours critiques existants.
- Captures de la liste et du dossier client sur petit écran examinées. Les repères de progression ont été ajustés pour éviter les libellés trop serrés.
- 9 scénarios Chromium avec vrai serveur et MySQL réussis, dont le parcours complet agent → compte rendu et justificatifs → validation client sur mobile, ainsi que le taxi et son code de départ.
- Contrôles du code frontend et backend, compilation de production et recherche de secrets réussis.

Les transitions métier, autorisations, exigences de justificatif et règles de validation sont conservées. Ce lot ne refond pas les écrans détaillés des projets et commandes commerciales.
