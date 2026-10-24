# Simplification des espaces de travail Teranga

Ce lot complète l’[audit initial](AUDIT_SIMPLICITE_SERVICES_2026-10-24.md). Il conserve les concepts, les transitions métier et les droits serveur. Les changements portent sur les parcours et leur présentation ; aucune activation d’offre ni migration de production n’est effectuée.

## Parcours livrés

| Acteur ou besoin | Comportement |
| --- | --- |
| Client | L’accueil affiche la création d’une demande, les résultats à vérifier et les demandes en cours. Les modules financiers et la demande de compléter un profil sont retirés de cet accueil. Les dossiers et paiements restent accessibles. |
| Agent | L’accueil ouvre les interventions. Un bouton déclare la disponibilité pour 30, 60, 120, 240 ou 480 minutes. La capacité simultanée se règle dans un panneau séparé ; sa modification ne renouvelle pas la disponibilité. Les anciennes lectures sont ignorées après une modification. Les projets et commandes affectés restent accessibles dans le même espace. |
| Prestataire | L’accueil ouvre les missions en cours, avec les propositions à accepter en premier. Un bouton gère la disponibilité ; un prestataire occupé conserve les contrôles existants. L’historique se consulte séparément. Le filtrage en cours/historique est appliqué au serveur avant pagination. |
| Responsable | L’accueil donne accès à la file des opérations et aux outils du territoire. La file commune réunit services, projets et commandes, avec priorité aux escalades parmi les dossiers chargés. Le type de ressource est conservé dans chaque action, même lorsque les identifiants numériques se recoupent. |
| Commande | Les raccourcis taxi et livraison utilisent les formulaires spécialisés, que le client soit déjà connecté ou non. Un choix depuis l’assistant général conserve explicitement le pays d’exécution ; il ne revient pas automatiquement au pays du compte. |
| Suivi | Services classiques et missions partagent cinq étapes de présentation : reçue, prise en charge, réalisation, résultat à vérifier, terminée. Les annulations et litiges ont une présentation distincte. Les statuts détaillés et les actions métier sont conservés. |
| Assistance | Les demandes disposent d’une aide avec référence préremplie et téléphone du territoire de la demande. Une demande située dans un autre pays n’utilise pas le téléphone du pays du compte. En l’absence de contact local, un lien vers le support par courriel peut servir de relais. Ces liens ouvrent le canal choisi ; ils n’envoient aucun message automatiquement. |
| Interruption | Les demandes générales conservent leur texte et leurs lieux dans l’onglet du navigateur, avec expiration à 24 heures. Les brouillons connectés sont séparés par utilisateur. Téléphone, identité, code secret et fichiers ne sont pas enregistrés dans ces brouillons. La référence de création est conservée pour une reprise après perte de réponse. |
| Pièces jointes | Après une création réussie et un échec d’envoi des pièces, le client peut renvoyer uniquement les pièces jointes avec la référence déjà créée. Les fichiers restent en mémoire pendant cette page ; après fermeture ou rechargement, ils doivent être sélectionnés à nouveau. |

## File commune et pagination

La vue commune charge les 25 premiers dossiers de chaque famille dans le périmètre autorisé, puis les réunit. Elle annonce cette limite et permet d’ouvrir la pagination de chaque famille. Elle ne prétend pas classer la totalité d’une base volumineuse par urgence. Un échec sur une famille est signalé sans masquer celles qui ont pu être chargées.

Les listes client et prestataire permettent de consulter les pages suivantes. Le résumé de l’accueil client porte sur les 100 demandes les plus récentes et annonce une éventuelle limite. Les réponses tardives d’un ancien filtre ou territoire ne doivent pas remplacer la vue actuelle.

## Montants et limites de la donnée existante

Le responsable consulte les montants issus du résumé financier regroupé par devise. Aucun solde ne mélange des monnaies différentes et aucun libellé XOF fixe n’est appliqué à un montant d’une autre devise.

Sur une demande, le détail financier distingue le montant de référence et les règlements justifiés enregistrés. Ces derniers proviennent uniquement des transactions de recette `completed`, rattachées à cette demande, avec preuve et dans sa devise. Ce total représente les écritures enregistrées, sans intégration automatique à un opérateur de paiement.

Le modèle actuel ne possède pas de prix convenu confirmé séparé du budget ou de l’estimation. Ce lot conserve cette logique : `agreedAmount` et `remainingAmount` restent nuls, le prix est indiqué « à confirmer » et aucun reste à payer n’est déduit d’une simple estimation. Un futur processus de devis accepté nécessiterait une décision métier explicite.

## Compatibilité et mise en service

- L’API des missions accepte les filtres facultatifs `view=active|history` et `excludeTradeCategorySlug`. Sans ces filtres, son comportement de liste reste compatible.
- Le détail d’un service expose le contact d’assistance résolu et l’état des règlements après vérification des droits existants. Le suivi d’une mission expose l’état financier au client propriétaire.
- Les nouvelles interfaces doivent être publiées avec le backend correspondant, afin que le filtrage des missions soit effectué avant pagination.
- Le stockage local des brouillons peut être refusé par le navigateur ; la saisie reste disponible. Il ne s’agit pas d’un mode de création hors connexion.
- Les réglages de catalogue, les autorisations, la durée maximale de disponibilité et les exigences de preuve restent vérifiés au serveur.

## Vérification

Résultats locaux : suite frontend de 59 fichiers / 177 tests réussie ; après le dernier ajustement du lien d’assistance par rôle, ses trois tests ont également réussi, dont un nouveau cas. Le total courant est de 178 cas frontend. La suite backend de 73 fichiers / 457 tests est réussie et la connexion à la base de test a été vérifiée. Les lints frontend et backend ainsi que la compilation de production sont réussis. Les onze scénarios Chromium ciblés sont réussis ; les captures de l’accueil client sur mobile et ordinateur ont été examinées.

La recette automatisée couvre les espaces par rôle, les actions attendues du client, la disponibilité explicite et son expiration, la séparation des devises, la référence d’assistance, la conservation des brouillons et l’envoi des pièces jointes sans recréation. Des scénarios Chromium sur mobile et ordinateur couvrent également le changement de territoire, les identifiants qui se recoupent entre familles et la reprise de la même clé après une réponse de création perdue.

Les scénarios navigateur utilisent des API simulées. La recette terrain avec exécutants, opérateurs et moyens de paiement réels reste nécessaire avant mise en service.
