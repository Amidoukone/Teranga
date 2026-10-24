# Préparation de Teranga au démarrage terrain — 24 octobre 2026

## État vérifié

Les corrections ci-dessous sont réalisées et vérifiées dans le dépôt local. Elles complètent les [simplifications des parcours](SIMPLIFICATION_PARCOURS_2026-10-24.md), sans modifier les rôles, les territoires, les concepts de services ou le graphe des statuts des missions.

La validation locale du logiciel est acquise pour les contrôles exécutés. L'autorisation d'ouverture du service déployé reste à établir sur cet environnement avec ses données et ses responsables. Aucun déploiement, aucune activation d'offre et aucune modification de base de production n'ont été réalisés pendant cette intervention.

## Corrections appliquées

- **Remise au client guidée.** Depuis sa liste, l'agent ouvre le compte rendu de la prestation. Si le compte rendu ou les types de justificatifs exigés manquent, l'action principale du détail mène à leur dépôt. Une fois ces éléments enregistrés, l'action de finalisation apparaît. Le suivi des missions applique le même guidage sur mobile et ordinateur. Les contrôles du serveur restent obligatoires.
- **Envoi des preuves protégé.** Les champs et pièces jointes sont figés pendant leur envoi. Un verrou empêche deux soumissions simultanées. Une interruption conserve la saisie et la référence de soumission pour réessayer. Une actualisation du suivi ne remplace pas un compte rendu en cours de saisie.
- **Suivi conservé pendant une coupure.** L'échec d'une actualisation conserve les dernières informations et la saisie du compte rendu dans l'écran ouvert. Un message invite à réessayer ; une reconnexion reprend le suivi. Une révocation d'accès reste traitée comme une interdiction, sans conserver l'affichage du dossier.
- **Accès à tout le travail de l'agent.** Les services actifs et les archives sont filtrés côté serveur avant pagination. Les pages suivantes sont accessibles ; les 25 premiers résultats ne sont plus présentés comme l'ensemble du travail. Les réponses d'un ancien chargement ne remplacent pas le nouveau périmètre de consultation.
- **Transitions concurrentes protégées.** La finalisation et la validation des services classiques utilisent une transaction avec verrou sur le service. Deux finalisations simultanées produisent une seule transition. Les raccourcis classiques refusent les missions qui doivent suivre leur propre machine à états.
- **Notifications de service visibles.** Une nouvelle étape met à jour la notification existante ou crée celle d'un nouveau destinataire. Elle redevient non lue, même si l'étape précédente avait été lue. Les changements de statut ne dépendent plus de l'existence d'une notification antérieure.
- **Diagnostic de disponibilité plus fidèle.** Le contrôle terrain vérifie le périmètre régional des prestataires, les missions qui les occupent et la capacité restante des agents. Une offre de transport automatisée exige un prestataire disponible, un véhicule éligible et une position récente. Un horodatage de traitement automatique absent, invalide, trop ancien ou excessivement futur ne suffit pas à déclarer le traitement opérationnel.

Le diagnostic constitue un instantané de préparation. Il ne garantit pas qu'un véhicule de chaque type sera proche de chaque futur trajet. L'assistance et le responsable de coordination restent nécessaires lorsque la recherche ne trouve personne.

## Vérifications exécutées

| Contrôle | Résultat |
| --- | --- |
| Backend complet, base MySQL disponible, `REQUIRE_INTEGRATION_DB=true` | 74 suites, 466 tests réussis |
| Interface complète | 59 suites, 183 tests réussis |
| Recette terrain `npm run field:recipe` | 6 suites, 57 tests réussis |
| Contrôle du code backend | Réussi, 285 fichiers |
| Contrôle du code interface | Réussi |
| Compilation de production de l'interface | Réussie |
| Navigateur Chromium, vrai backend et base MySQL isolée | 4 scénarios réussis |

Les quatre scénarios navigateur couvrent l'inscription et la connexion, la déconnexion avec reconnexion, le changement de mot de passe avec nouvelle authentification, et la remise d'une prestation sur un écran de 360 pixels.

Ce dernier scénario réalise le démarrage par l'agent, l'envoi d'une photo, la finalisation, la lecture du compte rendu par le client, le téléchargement effectif de la photo et la validation du service. Les appels métier et le stockage du justificatif utilisent le vrai serveur local ; seules les requêtes de suivi analytique externes sont bloquées.

La recette terrain inclut désormais les devises locales, les montants de règlements justifiés et les contrôles de disponibilité. Elle exige MySQL et échoue si les tests concernés ne peuvent pas accéder à la base.

Le serveur d'intégration crée une **nouvelle base locale `teranga_e2e_*` par lancement**. Il ne supprime plus une base existante avant les tests. Un nom déjà utilisé ou un hôte distant est refusé. Les bases et fichiers de test restent locaux ; les commandes de recette d'intégration ne doivent pas être exécutées sur un serveur de production.

## Conditions restant à constater avant ouverture

Le poste de travail ne contient ni `DATABASE_URL` de production ni fichier `backend/.env.production`. Le diagnostic local `field:check -- --country=ML` constate une base de test dont la préparation territoriale est incomplète. Ces constats ne décrivent pas la configuration actuelle du service hébergé.

Sur la version déployée, conserver les résultats des vérifications suivantes :

1. **Version et configuration :** déployer le backend et l'interface compatibles, contrôler les migrations en attente, exécuter `validate:prod-config` puis `field:check` sur le pays et, si nécessaire, la région réellement ouverts.
2. **Offres exécutables :** vérifier les offres effectivement ouvertes, les résultats attendus, les délais par étape et le responsable de chaque intervention bloquée. Confirmer le prix ou le devis avec le client avant l'exécution ; un budget ou une estimation affichés ne constituent pas un accord de prix.
3. **Équipe disponible :** vérifier les comptes, le territoire, les compétences, les disponibilités et la capacité de prise en charge. Pour le transport, vérifier également les véhicules et la position récente. Définir qui reprend une demande sans réponse.
4. **Assistance joignable :** appeler le numéro configuré depuis un téléphone du pays. Vérifier les notifications internes sur les comptes réels de l'équipe et du client. Les liens WhatsApp ouvrent une conversation ; ils ne constituent pas un service automatique d'envoi de SMS ou WhatsApp.
5. **Preuves durables :** déposer un vrai justificatif, le consulter avec le compte client, redémarrer ou redéployer le serveur, puis consulter le même fichier. Un chemin de stockage configuré ne prouve pas sa persistance.
6. **Sauvegarde restaurable :** restaurer une sauvegarde sur une copie isolée, vérifier les données et conserver la procédure de retour arrière.
7. **Recette de l'équipe :** refaire une prestation complète sur l'environnement déployé, puis un cas de coupure, d'absence de réponse et de réclamation. Consigner les références des demandes et la décision d'ouverture du responsable local.

Le déroulement détaillé et les commandes de production figurent dans le [guide de préparation terrain](runbooks/preparation-terrain.md) et la [checklist de mise en ligne](GO_LIVE_CHECKLIST.md). Les preuves externes signalées par `remainingChecks` restent distinctes du résultat de configuration : persistance des justificatifs après redémarrage, notifications, restauration, prestation complète et accord opérationnel local. Les outils ajoutés lors de la reprise sont décrits dans le [guide de vérification du déploiement](runbooks/verification-deploiement.md).

## Reprise : outils de préparation du déploiement

Le chargement des variables est maintenant partagé par le serveur, Sequelize et les contrôles : en production, les variables du service sont prioritaires et seul `.env.production` peut les compléter. Le fichier de développement `.env` n'est plus chargé dans ce contexte. Les contrôles locaux de test conservent leur configuration locale.

Les commandes suivantes sont disponibles depuis `backend` :

- `migrations:check` compare en lecture seule le code au suivi `SequelizeMeta`. Une migration absente ou inconnue bloque le résultat ; le contrôle n'applique et ne réconcilie rien.
- `release:check -- --country=ML` réunit configuration, politique de stockage, migrations et préparation du territoire. Une configuration incohérente ne conduit pas à un résultat prêt. `openingApproved` reste `false`.
- `proofs:check` enregistre l'empreinte d'un vrai justificatif puis la compare après redémarrage ou redéploiement. La référence existante ne peut pas être écrasée ; le redémarrage et le téléchargement par le client restent à constater séparément.
- `backup:counts` collecte les nombres de lignes source sans écrire en base. `backup:rehearse` importe le dump dans une base locale neuve avec un compte temporaire limité à cette seule base, compare les comptages, recherche les références orphelines et retire le compte d'import. Il conserve la copie et un rapport sans afficher de lignes métier. Il n'utilise pas `DATABASE_URL` et ne restaure pas les fichiers du stockage média.
- `backup:recipe` exige MySQL local et teste ces protections, notamment le refus d'un SQL visant une autre base. Un job CI dédié prépare la même recette sur une instance MySQL isolée ; son exécution sur GitHub reste à constater après publication du code.

La [fiche de recette de déploiement](RECETTE_DEPLOIEMENT_MODELE.md) permet de consigner les responsables, les essais, les références de dossiers et la décision locale.

Vérifications supplémentaires exécutées lors de cette reprise : suite backend complète de **76 suites et 493 tests**, puis recette des outils de **3 suites et 32 tests** incluant cinq contrôles supplémentaires du bilan de déploiement. Ces deux exécutions se recoupent ; leurs nombres ne doivent pas être additionnés. La recette inclut un import réel MySQL, le maintien d'une table extérieure à la copie, les comptages source, les références orphelines, les preuves modifiées ou absentes et la séparation des configurations. Le contrôle du code passe pour **301 fichiers**. La syntaxe du workflow CI est vérifiée localement.

La recette navigateur complète réussit désormais avec **9 scénarios Chromium**, vrai serveur et MySQL isolé : les trois parcours d'authentification, la création de service par le nouvel assistant, les tâches, les notifications, les commandes, la remise sur mobile et la commande Taxi avec PIN et notification administrateur. Les scénarios suivent les écrans actuels et le port de serveur configuré. Ils réutilisent la session du client de recette entre écrans afin de respecter le quota d'authentification existant ; les scénarios de connexion gardent leurs propres comptes jetables. Les limites du serveur n'ont pas été modifiées. Sur ce poste Windows, les deux processus de serveur de recette ont dû être arrêtés à la fin pour terminer le lanceur, qui a rendu le code `0` avec les neuf scénarios réussis.

La commande `proofs:check` a également été exécutée dans des processus distincts : prise de référence, relecture identique réussie, puis refus après modification du fichier. Cet essai vérifie l'outil local ; il ne remplace pas l'essai après redéploiement du stockage hébergé.

Le contrôle de production exécuté sur ce poste échoue comme attendu en l'absence des variables nécessaires, avant toute connexion à une base. Le diagnostic des migrations sur la base **de test locale** constate un suivi incomplet ; il n'a pas tenté de le corriger et ne décrit pas l'état de la base hébergée. Le [contrôle avant publication](CONTROLE_PUBLICATION_2026-10-24.md) complète ce bilan avec la vérification des secrets et les résultats de validation les plus récents.
