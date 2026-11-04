# Recette des parcours par rôle — 26 octobre 2026

Suite locale du commit `1cb0a6d`. Direction conservée : **un centre pour savoir quoi faire, un dossier pour agir, des étapes facultatives**.

## Correctifs issus de la lecture des parcours

Le parcours de création mélangeait « demande » dans la navigation et la confirmation, puis « mission » dans le bouton d'envoi et le suivi. Il utilise maintenant « Envoyer ma demande », « Demande envoyée » et « Suivre ma demande ». Les messages d'erreur, la référence et la nouvelle saisie suivent ce vocabulaire, en français et en anglais. Les noms des API et les différences métier restent inchangés.

Dans un service classique, le client devait chercher le journal dans « Autres options », alors que « Prix et règlement » présentait déjà les montants. Le lien vers les écritures se trouve désormais dans « Prix et règlement » ; le panneau devenu vide disparaît pour le client. Le suivi d'un service réalisé par un prestataire propose le même accès au journal depuis les montants. Les parcours de transport conservent leur suivi spécifique.

La revue des captures a ensuite révélé des clés de traduction affichées après confirmation d'un service prestataire. Les messages de confirmation, clôture, annulation, absence de prestataire et résolution d'une réclamation sont complétés en français et en anglais. Le bandeau final utilise ces messages de clôture ; ce même choix corrige les bandeaux terminaux de transport qui tentaient de lire des messages d'avancement absents.

Un service prestataire affiche « Suivi du service », le même bouton de confirmation que le service classique, un partage du suivi et un avis sur la prestation. Après la réalisation, la carte et les avertissements d'attente GPS disparaissent de ce service ; le compte rendu et les justificatifs restent accessibles. Les cartes et règles de transport sont conservées.

## Parcours de référence

| Rôle | Chemin vérifié | Résultat attendu |
| --- | --- | --- |
| Client | Centre → Nouvelle demande → besoin et lieu facultatif → récapitulatif → envoi → suivi | Une seule demande créée ; accès au bon dossier sans devoir choisir entre service et mission. |
| Responsable | Centre → coordination du dossier → prise en charge → affectation | Le responsable prend la demande, choisit l'exécutant et retrouve le dossier concerné. Les outils de Gestion restent accessibles dans son périmètre. |
| Agent | Disponibilité dans le centre → dossier confié → démarrage → compte rendu et photo → remise | Le dossier porte la réalisation et les pièces ; la remise attend le compte rendu et les justificatifs prévus. |
| Prestataire | Disponibilité dans le centre → prestation confiée → en route → arrivée → démarrage → compte rendu et photo → remise | Les transitions propres au prestataire sont conservées ; le dossier confirmé est retrouvé dans son historique spécialisé. |
| Responsable, finances | Journal du dossier → enregistrement d'un règlement et de son reçu | L'écriture et son reçu sont conservés sans confirmer le résultat à la place du client. |
| Client, résultat | Centre → Vérifier le résultat → ouverture de la photo → confirmation | Le justificatif de réalisation est consultable avant confirmation. |
| Client, paiement | Dossier → Prix et règlement → journal → reçu → retour au dossier | Le reçu de règlement est distinct de la photo de réalisation ; le retour retrouve le dossier. |

Deux scénarios continus ont été ajoutés dans `frontend/e2e-integration/role-journeys.real.spec.js` : un client avec agent, puis un client avec prestataire. Chaque scénario crée son propre dossier par l'interface et traverse les trois rôles concernés, jusqu'à la confirmation et la consultation du reçu. L'exécution terrain est contrôlée à 360 px ; le second parcours client et la coordination sont également vérifiés à 1440 px.

Le jeu de recette réel comprend maintenant un compte prestataire actif et une offre fictive de plomberie avec photo attendue. Ces données sont créées par le bootstrap de la base MySQL isolée ; elles ne créent aucun compte en production et ne modifient pas la démonstration persistante du poste.

Le serveur d'intégration désactive les tâches planifiées en environnement `test`. Les scénarios continus passent donc explicitement par « Prendre en charge », qui initialise la coordination et ses conditions de remise. Ils ne prétendent pas valider l'ordonnanceur automatique en arrière-plan.

## Validation

- Interface : **352 tests réussis dans 75 suites**, puis **10 tests ciblés du suivi** après la dernière harmonisation du bouton de confirmation.
- Navigateur avec API simulée : **64 scénarios réussis**, téléphone et ordinateur, puis **13 scénarios ciblés réussis** après les corrections issues des captures.
- Serveur réel et MySQL isolé : **24 scénarios réussis dans le dernier passage complet**, après les corrections issues des captures, dont les deux nouveaux parcours continus. Leurs fichiers et reçus renvoient un statut HTTP 200.
- ESLint interface, contrôle backend de 311 fichiers et compilation de production réussis.

Les API métier du backend ne sont pas modifiées dans ce lot ; ses 567 tests documentés au lot précédent ne sont pas rejoués ici. Les captures finales des nouveaux parcours sont produites dans `frontend/test-results/recette-validee/` ; la clôture du service prestataire a été inspectée après correction des traductions et des indications GPS.

Commandes depuis `frontend` :

```powershell
npm.cmd test -- --silent
npm.cmd run lint
npm.cmd run build
node node_modules/@playwright/test/cli.js test --workers=2
node node_modules/@playwright/test/cli.js test --config=playwright.integration.config.js --workers=1 --reporter=list
```

## Portée et suite

Cette recette technique automatisée complète la vérification des parcours. L'appréciation des libellés et de la facilité d'utilisation par les utilisateurs finaux reste à recueillir sur la démonstration.

La recette locale ne valide pas les notifications externes, le stockage hébergé des pièces, la géolocalisation réelle ni l'ensemble d'une course ou d'une livraison avec véhicule. Les pièces de recette utilisent le stockage local de test. Le scénario réel de mobilité existant vérifie la demande, le code client et l'accès du responsable au dispatch.

Aucune migration ni dépendance nouvelle. Les changements restent locaux, sans nouveau commit, push ou déploiement.
