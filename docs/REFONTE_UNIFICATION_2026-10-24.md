# Unifier le travail dans Teranga

Date : 24 octobre 2026. Statut : **proposition de conception**, fondée sur le code local après les quatre étapes de simplification. Cette analyse ne modifie ni les écrans déployés, ni les données, ni les règles métier. Les exemples de la [maquette navigable](design/teranga-unification.html) sont fictifs et ses actions restent en mémoire.

## 1. Décision recommandée

**Un centre pour savoir quoi faire, un dossier pour le faire, des étapes seulement lorsque le travail le nécessite.**

Le centre des opérations, le service et la tâche ne doivent plus ressembler à trois applications. Ils correspondent à trois niveaux du même travail :

| Niveau | Question de l'utilisateur | Place dans l'interface |
| --- | --- | --- |
| Centre des opérations | Que dois-je faire ou suivre maintenant ? | Une file de dossiers, avec la prochaine action et les informations nouvelles. |
| Dossier de demande | Où en est ma demande et comment agir ? | L'écran commun de suivi et d'exécution d'un service, projet ou commande. |
| Étape de réalisation | Que reste-t-il à faire à l'intérieur de ce travail ? | Une section facultative du dossier, issue des tâches ou phases existantes. |
| Justificatif | Qu'est-ce qui montre le résultat ou explique la demande ? | Une pièce affichée dans le dossier, avec son origine et son usage. |
| Historique | Que s'est-il passé ? | La chronologie du dossier ; les informations personnelles restent accessibles au centre. |

« Dossier » désigne ici un contenant d'interface. Il ne crée pas une nouvelle table et ne remplace pas les modèles Service, Project ou Order. Le catalogue conserve le mot « services » pour ce qu'on peut demander ; « mes demandes » désigne ce qu'on suit. Le terme technique « mission » reste dans les API et les outils qui en ont besoin.

La recommandation est de retirer **le module Tâches de la navigation principale**, après avoir intégré tous ses cas d'usage. Les tâches existantes, leurs identifiants, leurs preuves et leurs transactions sont conservés. Un service simple n'exige pas de créer une tâche pour joindre son résultat.

## 2. Ce que le code montre

L'analyse porte sur les routes, les modèles, les contrôleurs et les écrans locaux. Aucun diagnostic de fréquence d'usage ne peut être déduit de ce code ; aucune observation terrain nouvelle n'a été réalisée.

| Constat vérifié | Conséquence pour la refonte | Source locale |
| --- | --- | --- |
| Le centre a déjà réuni activités et notifications et propose une coordination administrative. | Conserver cette base. Faire des dossiers nécessitant une action l'entrée par défaut, plutôt qu'un fil d'événements pour certains rôles. | [OperationsCenterPage](../frontend/src/pages/OperationsCenterPage.jsx), [operationUpdates.service](../backend/src/services/operationUpdates.service.js) |
| Les menus proposent encore tâches, services, missions, projets et leurs variantes administratives ; l'accueil répète des accès. | Réorganiser par intention et par rôle, avec un accès principal au travail courant. | [NavBar](../frontend/src/components/NavBar.js), [ManagementHome](../frontend/src/pages/ManagementHome.jsx), [App](../frontend/src/App.js) |
| La page actuelle « dossiers » regroupe uniquement biens et projets. | Ne pas renommer cette page en liste universelle sans changer son contenu. Séparer « Mes demandes » et « Mes biens ». | [DossiersPage](../frontend/src/pages/DossiersPage.jsx) |
| Les tâches ont un statut, un agent, un délai et des montants propres ; elles peuvent être liées à un service ou à un bien. | Une simple suppression ferait disparaître des capacités utiles. Les présenter dans leur contexte. | [Task](../backend/models/task.js), [task.controller](../backend/src/controllers/task.controller.js) |
| Un lien projet → tâches et une migration `projectId` existent, mais la création générique de tâche ne reprend pas ce champ. | Auditer ce raccordement avant de proposer l'ajout d'étapes de projet. Conserver les phases déjà opérationnelles. | [Project](../backend/models/project.js), [migration](../backend/migrations/20251025111347-add-projectId-to-tasks.js), [task.controller](../backend/src/controllers/task.controller.js) |
| Les justificatifs peuvent déjà être directement liés au service. Le compte rendu final les enregistre ainsi. | Réutiliser le parcours existant pour la réalisation simple. Aucune tâche artificielle n'est nécessaire. | [Evidence](../backend/models/evidence.js), [missionCompletion.controller](../backend/src/controllers/missionCompletion.controller.js) |
| L'ajout générique de preuves attend une tâche ou une commande ; les pièces de demande et comptes rendus de service passent par d'autres routes. | Une galerie commune doit orienter chaque envoi vers le contrat approprié. Changer seulement son formulaire ne suffit pas. | [evidence.controller](../backend/src/controllers/evidence.controller.js), [mission.routes](../backend/src/routes/mission.routes.js) |
| L'agent affecté fait progresser une tâche ; sa validation finale est administrative. La confirmation d'un service classique appartient au client. | Donner deux libellés distincts et préserver les deux règles. | [task.controller](../backend/src/controllers/task.controller.js), [service.controller](../backend/src/controllers/service.controller.js) |
| La remise d'un projet vérifie ses phases et tâches non terminées, un compte rendu et un document attendu. | Une présentation commune doit conserver ces conditions et expliquer ce qui manque. | [workCoordination.service](../backend/src/services/workCoordination.service.js) |
| La finalisation du service classique vérifie le compte rendu selon sa politique, sans imposer la clôture de toutes ses tâches. | Ne pas lui ajouter implicitement le blocage des projets. Les étapes restantes peuvent être signalées sans inventer une interdiction. | [missionCompletion.service](../backend/src/services/missionCompletion.service.js), [service.controller](../backend/src/controllers/service.controller.js) |
| Des transactions référencent les tâches, services, projets et commandes. | Conserver leurs liens et éviter de compter deux fois une transaction affichée dans plusieurs vues. | [transactionContext.service](../backend/src/services/transactionContext.service.js), [Transaction](../backend/models/transaction.js) |
| Les pages Tâches et Tâches d'un service proposent des formulaires proches. Les preuves ont encore un écran autonome. | Remplacer ces trois parcours par des panneaux dans le dossier, puis garder les anciennes URL comme accès compatibles. | [TasksPage](../frontend/src/pages/TasksPage.js), [ServiceTasksPage](../frontend/src/pages/ServiceTasksPage.js), [TaskEvidencesPage](../frontend/src/pages/TaskEvidencesPage.js) |
| La liste générale des tâches est paginée, renvoie le nombre de la page et applique encore des filtres dans l'interface ; la liste par service n'a pas de pagination. | Calculer filtres, regroupements et vrais totaux au serveur avant toute pagination de la nouvelle file. | [task.controller](../backend/src/controllers/task.controller.js), [TasksPage](../frontend/src/pages/TasksPage.js) |

Ce constat conduit à une restructuration des parcours et de leur présentation commune. La fusion physique de toutes les tables apporterait des changements métier inutiles à cette étape.

## 3. Organisation cible

### Navigation selon le rôle

| Rôle | Entrées permanentes | Actions et accès contextuels |
| --- | --- | --- |
| Client | Centre des opérations · Mes demandes | « Nouvelle demande » ; Mes biens dans le compte ; paiements dans les dossiers et leur récapitulatif. |
| Agent | Centre des opérations · Mes dossiers | Disponibilité au centre ; justificatifs et frais dans le dossier ; bilan financier dans le compte. |
| Prestataire | Centre des opérations · Mes interventions | Disponibilité et outils taxi/livraison selon ses activités autorisées. |
| Responsable | Centre des opérations · Dossiers · Gestion | Équipe, catalogue, territoires, litiges et finances regroupés dans Gestion selon ses droits. |

Le compte et l'assistance sont accessibles de manière stable. « Nouvelle demande » est une action, pas un second espace de suivi. La boutique et les annonces immobilières restent des destinations de découverte accessibles depuis les entrées concernées ; les achats effectués rejoignent les demandes de type commande. Un bien immobilier est une ressource durable, pas une prestation à terminer.

L'accueil connecté peut à terme devenir le centre des opérations, avec une salutation courte et une création de demande. Il ne doit pas rester un second tableau de travail complet. L'accueil public de présentation est conservé.

### Centre des opérations

Trois vues au maximum, avec des mots adaptés au rôle :

1. **À faire** : dossiers sur lesquels l'utilisateur peut agir, plus les blocages qu'il doit résoudre. Chaque carte indique l'action, son motif et éventuellement l'échéance.
2. **À suivre** : travail en cours qui attend quelqu'un d'autre. L'absence d'action est expliquée : « Awa réalise la visite », « En attente du contrôle du responsable ».
3. **Informations** : messages personnels et historique de lecture. Un message lu ne termine aucune tâche. Une action terminée ne marque pas tous les messages comme lus.

La file opérationnelle montre en principe une carte par dossier. Deux étapes du même dossier sont résumées : « 2 étapes vous attendent ». Un utilisateur ayant seulement accès à une tâche ne reçoit pas les informations confidentielles du service parent. Il peut recevoir une carte limitée à son intervention autorisée.

Les nouveaux messages n'imposent pas une action. Les comptes « dossiers à traiter », « étapes à réaliser » et « messages non lus » restent séparés. La lecture n'est jamais un statut de travail.

L'ordre est défini au serveur : blocage ou urgence existante, échéance, puis ordre stable. Les filtres de rôle, territoire, famille et responsable, ainsi que le regroupement, précèdent la pagination. On ne fabrique pas cette vue à partir de la première page de chaque ancien module. Une panne partielle est visible ; elle ne devient pas un résultat « aucun travail ».

### Dossier commun

Ordre recommandé, sur téléphone comme sur ordinateur :

1. Référence, titre, état compréhensible, personne chargée du travail.
2. **Ce qui se passe / votre prochaine action**. Une action principale locale, ou une attente expliquée. Les justificatifs du résultat précèdent la confirmation client.
3. **Réalisation et justificatifs** : compte rendu, pièces et éventuelles étapes. Le cas simple n'affiche ni liste d'étapes vide ni bouton de création obligatoire.
4. **Détails et montants**, **Historique**, **Aide**, en sections secondaires. Les frais utiles peuvent être visibles dès l'action qui les concerne.

Le même cadre accepte des variantes : carte et code de départ pour le taxi, retrait et remise pour une livraison, phases pour un projet, articles et expédition pour une commande. Le cadre est commun ; chaque activité garde ses actions et contrôles propres.

Un seul bouton principal par contexte d'action. L'ouverture d'une étape peut avoir sa propre action dans ce panneau, sans doubler la confirmation globale. Un brouillon enregistré et un résultat remis doivent porter des confirmations différentes.

## 4. Place des tâches

### Quand les garder

Une étape a de la valeur lorsqu'elle a au moins une responsabilité distincte, une échéance, une séquence de travail, un livrable intermédiaire ou une dépense traçable. Exemples : diagnostic puis réparation ; visite puis devis ; contrôles répartis entre deux agents. Une prestation ponctuelle réalisée par une seule personne avec un compte rendu n'exige pas une étape identique au service.

| Situation | Présentation cible | Données conservées |
| --- | --- | --- |
| Service sans tâche | Réalisation directe et résultat dans le dossier. | Service et compte rendu existants. |
| Service avec tâches | Section « Étapes de réalisation », ouverte si une étape nécessite une action. | Task, assignedTo, statuts, preuves et transactions existants. |
| Tâche rattachée seulement à un bien | Intervention visible depuis le bien et la file de l'acteur autorisé. | Task + Property ; ne pas créer automatiquement un faux service. |
| Tâche historique sans parent utilisable | Accès « Autres interventions » limité aux personnes déjà autorisées. | Référence et accès existants ; qualification administrative ultérieure. |
| Projet | Phases et tâches présentées avec leur niveau d'origine, sans les dupliquer. | ProjectPhase et Task distincts ; raccordement de création à vérifier. |
| Sous-mission de transport | Retrait ou livraison liée, conservant son propre exécutant et ses contrôles. | Service.parentServiceId ; ne pas la convertir en Task. |

L'ajout d'étape reste proposé aux personnes qui peuvent déjà créer des tâches : client et administrateur selon le contexte. L'agent et le prestataire n'obtiennent pas ce droit par le simple changement d'écran. L'affectation d'une étape reste administrative. L'agent du service n'est pas automatiquement autorisé à modifier une tâche affectée à quelqu'un d'autre.

### Validation et résultat

- « Terminer l'étape » correspond à la réalisation de la tâche.
- « Contrôler l'étape » correspond à sa validation administrative.
- « Remettre le résultat » correspond à la fin de réalisation du service selon son contrat.
- « Confirmer le résultat » correspond à l'acceptation du client là où elle est prévue.

Terminer toutes les étapes ne termine pas automatiquement le service. Une preuve d'étape ne satisfait pas automatiquement les justificatifs attendus du compte rendu. Le traitement d'une tâche n'entraîne aucun encaissement automatique.

Toute proposition ultérieure de bloquer un service tant que ses étapes sont ouvertes, de valider les étapes par le client ou de réutiliser leurs preuves comme preuves finales devra être traitée comme une décision métier explicite. Elle ne fait pas partie de cette refonte.

## 5. Un espace de justificatifs, plusieurs usages conservés

Le dossier propose une seule présentation et un ajout dans le bon contexte. L'utilisateur n'a pas à choisir des identifiants de service ou de tâche. Il voit le nom du dossier et, s'il agit dans une étape, le nom de cette étape.

| Usage | Présentation | Contrat à conserver |
| --- | --- | --- |
| Document initial du client | « Document de la demande » | Pièce de création de mission ; pas une preuve de travail réalisé. |
| Preuve d'étape | « Justificatif de l'étape : … » | Upload lié à Task, quotas et droits existants. |
| Résultat du service | « Résultat remis par … » | Compte rendu de l'exécutant, types requis selon la politique, appartenance des pièces au rapport. |
| Justificatif du projet | « Document du projet / de la phase » | ProjectDocument et ses catégories, règles de remise du projet. |
| Preuve de commande | « Justificatif de préparation ou de remise » | Evidence.orderId et règles de l'avancement de commande. |
| Justificatif financier | « Reçu de dépense / de paiement » | Transaction et pièce associée ; une image n'est pas une preuve de règlement comptabilisé. |

L'affichage commun conserve l'origine, l'auteur, la date et la référence de chaque pièce. Une même preuve affichée dans une étape et dans la vue d'ensemble n'est pas copiée : dédoublonnage par `(type de source, id)`. Deux fichiers identiques avec des usages différents ne sont pas fusionnés automatiquement.

Les boutons expliquent le besoin (« Ajouter une photo », « Joindre le reçu ») lorsque le contrat le permet. Les quotas, tailles et formats restent appliqués par chaque endpoint. Le parcours actuel de compte rendu accepte trois fichiers par envoi et quinze au total ; cela ne devient pas une règle globale pour tous les documents.

Les niveaux visuels fondés seulement sur le nombre de preuves ne devraient plus présenter quinze photos comme intrinsèquement meilleures qu'un document pertinent. Afficher plutôt les types attendus et les pièces reçues, en conservant les quotas serveur.

Les règles de suppression, de conservation, de visibilité et de stockage durable doivent rester propres à chaque source. Une galerie unique ne doit pas permettre de supprimer une preuve finale par une route générique qui ne vérifie pas son dossier et son rôle dans le rapport. Les fichiers ne sont ni déplacés ni réenvoyés lors de l'unification de présentation.

## 6. Système cible dans l'architecture existante

La base React / Express / MySQL peut porter cette évolution. La proposition consiste à ajouter une couche de lecture commune et des composants partagés, en réutilisant les services métier actuels pour les écritures.

```text
Centre des opérations ── ouvre ──► Dossier de demande
                                  ├─ Résumé et prochaine action
                                  ├─ Réalisation / étapes facultatives
                                  ├─ Justificatifs avec leur origine
                                  ├─ Montants et transactions
                                  └─ Historique autorisé

                      Couche de lecture et d'actions autorisées
                       /                 |                \
             Service + coordination  Project + phases  Order + articles
                  |                         |                |
             Tasks / Evidence       Tasks / Documents   Evidence

             Property : contexte durable d'une intervention
             Notifications et activités : informations personnelles
```

### Identité et source de vérité

- Identité : `{ kind: 'service' | 'project' | 'order' | 'property_task' | 'legacy_task', id }`. Un même numéro dans deux familles ne désigne pas le même dossier. Les variantes de tâches sont des enveloppes d'accès aux Task existantes, pas des tables nouvelles.
- `service.status` et `missionStatus` ne sont pas fusionnés. L'adaptateur détermine l'état d'affichage suivant le type de service et garde les états natifs pour les transitions.
- Une projection ne contient que les données autorisées pour l'acteur courant. Posséder une tâche n'accorde pas automatiquement l'accès au budget, au client ou aux autres tâches de son service.
- Les états de lecture des notifications, les états de coordination, l'avancement du travail et les paiements restent quatre dimensions distinctes.
- L'état synthétique et la prochaine action se calculent ; ils ne deviennent pas une nouvelle colonne à maintenir manuellement.

### Contrats de lecture proposés — non implémentés

| Contrat logique | Contenu | Points à traiter avant mise en service |
| --- | --- | --- |
| `GET /v1/workspace?view=action|following&…` | Cartes regroupées, prochaine action, compteurs et pagination. | ACL avant regroupement, priorité avant pagination, totaux exacts, tâches sans service, demandes anciennes. |
| `GET /v1/cases/:kind/:id` | Résumé, capacités, action principale, raisons d'attente et compteurs. | Ne pas charger tous les fichiers ou événements ; ne pas créer de coordination lors d'un GET. |
| Sections paginées du dossier | Étapes, pièces, historique, transactions, chargés à l'ouverture. | Contrôle d'accès sur chaque section ; curseur ou ordre stable ; aucune requête par carte. |

Les noms précis des routes seront arrêtés au premier lot d'implémentation. Il faut aussi prévoir une résolution d'ancienne tâche → contexte autorisé avant de rediriger ses liens. Une absence d'accès au parent n'est pas une raison de supprimer son intervention autorisée.

La réponse décrit des capacités telles que `canAddStep`, `canUploadResult` et des actions dont le type est connu de l'interface. Elle ne contient pas d'URL arbitraire à exécuter ni de décision de droit prise par le navigateur. À l'envoi, le serveur recharge le dossier, vérifie à nouveau l'acteur, son affectation, le territoire, l'état et les prérequis.

Les écritures réutilisent les routes de démarrage, de tâche, de rapport et de confirmation existantes. Les protections transactionnelles et d'idempotence déjà présentes sont conservées ; leur couverture doit être vérifiée pour les anciennes écritures avant de les exposer dans la nouvelle file. Aucun changement de statut ne se produit en consultant ou en lisant un dossier.

### Historique et notifications

Les événements existants demeurent les traces de chaque action. Une association vers le dossier autorisé facilite leur affichage, sans écraser l'identité de la tâche ou du justificatif d'origine. Les événements anciens se résolvent par leurs liens disponibles ; les événements orphelins restent des informations personnelles avec un accès de repli sûr.

La réconciliation activité / notification déjà réalisée doit être réutilisée. Regrouper plusieurs informations sous un dossier ne supprime pas ses événements et ne marque pas toutes ses notifications comme lues. Des événements financiers ou administratifs peuvent rester hors d'un dossier opérationnel.

## 7. Disposition UI et règles d'interaction

- Sur ordinateur : navigation latérale courte, file de dossiers dans le contenu ; le dossier a un résumé principal et des sections secondaires. Sur téléphone : navigation courte en bas et contenu en une colonne.
- Un bouton principal de couleur par contexte. Les actions de gestion, suppression et paramètres sont secondaires. L'aide et le signalement d'un problème restent faciles à trouver.
- Libellés concrets : « Commencer la visite », « Ajouter le reçu », « Remettre le résultat », « Confirmer le résultat ». Pour une attente : qui agit et ce qui est attendu.
- Pas de formulaire de création de tâche ouvert par défaut. Les champs déjà connus du dossier ne sont pas redemandés. Les réglages avancés apparaissent à la demande.
- L'état n'est pas indiqué uniquement par une couleur. Labels associés aux champs, navigation clavier, focus visible, messages proches de l'action et cibles tactiles d'au moins 44 px.
- Les variantes spécifiques au transport restent visibles quand nécessaires ; une carte, le code de départ et les confirmations de remise ne sont pas cachés dans un menu générique.
- Les actualisations conservent le brouillon du même utilisateur et dossier. Un changement de compte ou de territoire ne réutilise pas les données précédentes. Une réponse tardive ne remplace pas le dossier ouvert.
- En connexion instable, distinguer « enregistré localement » et « reçu par Teranga ». Aucune confirmation de résultat n'est annoncée sur la seule sauvegarde d'un brouillon. Les opérations non idempotentes ne sont pas rejouées silencieusement.
- Les pièces sont chargées progressivement ; une erreur de galerie ne masque pas l'état du service. Les documents nécessaires à une décision restent accessibles avant son bouton de confirmation.

## 8. Carte des regroupements

| Aujourd'hui | Cible | Compatibilité à maintenir |
| --- | --- | --- |
| Accueil connecté + centre + travail courant par rôle | Centre opérationnel selon le rôle | `/dashboard` redirige vers la nouvelle entrée lorsque ses capacités sont intégrées. |
| Services, missions et demandes, avec listes parallèles | Mes demandes / Mes dossiers, filtres par activité | Anciennes URL gardées ; adaptation de `getRequestDetailPath` et des liens de notifications. |
| Tâches + tâches d'un service + preuves de tâche | Étapes et justificatifs dans le dossier | `/tasks`, `/services/:id/tasks`, `/tasks/:id/evidences` résolus vers le contexte autorisé et la bonne section. |
| Projets + gestion des projets | Même dossier de projet, commandes selon les droits | Création et administration restent autorisées selon les règles actuelles. |
| Biens + page « dossiers » actuelle | Mes biens, contexte durable distinct des demandes | Garder les biens, leurs propriétaires et leurs interventions sans créer de demande fictive. |
| Transactions générales + transactions par ressource + finance | Montants dans le dossier ; synthèse financière et gestion à part | Identifiants, écritures et périmètres conservés ; aucun double comptage. |
| Taxi / livraison / prestataire | Variantes de dossier et outils de terrain adaptés | Maintien du dispatch, du code de départ, de la position et des sous-missions. |
| Produits / catégories / métiers / offres | Catalogue administratif sous Gestion | Ces notions ne sont pas interchangeables ; regrouper l'accès sans fusionner leurs données. |
| Notifications + activités | Informations au centre et historique du dossier | Préserver la lecture personnelle, les événements et les protections déjà implémentées. |

Cette carte constitue une direction pour l'ensemble de l'application. Les détails de chaque écran spécialisé devront être revus dans son lot ; le présent audit ne prétend pas avoir validé chaque formulaire administratif.

## 9. Mise en œuvre par lots contrôlables

| Lot | Résultat concret | Critères de sortie |
| --- | --- | --- |
| 1 — Dossier service | Étapes et pièces accessibles dans le service, sans changer sa navigation globale. | Service simple réalisable sans tâche ; tâche existante modifiable et contrôlable selon les droits ; anciennes preuves accessibles ; dépenses intactes. |
| 2 — File commune | Centre « À faire / À suivre / Informations » et accès direct aux dossiers. | Groupement et pagination serveur exacts ; pas de travail perdu au-delà de 25 éléments ; tâche seule visible sans accès indu au parent ; compteurs distincts. |
| 3 — Navigation | Réduction des menus et retrait des écrans de tâches redondants du parcours courant. | Accès depuis anciennes URL et notifications, retours aux filtres, biens et interventions historiques couverts ; aucune fonctionnalité seulement masquée et devenue inaccessible. |
| 4 — Autres familles | Projets, commandes et transport dans le cadre commun. | Phases, documents, livraisons et sous-missions conservés ; raccordement Task.projectId clarifié ; aucun statut métier converti implicitement. |
| 5 — Gestion et finances | Outils secondaires regroupés, montants cohérents partout. | Même transaction dédupliquée ; droits par territoire, devises et justificatifs financiers conservés. |
| 6 — Recette terrain et publication | Parcours vérifiés avec des personnes représentatives, puis livraison contrôlée. | Résultat des essais, restauration, stockage durable et configuration de production vérifiés ; retour à l'interface précédente possible pendant la transition. |

Le lot 1 est le meilleur point de départ : il matérialise la relation service → étapes → preuves avant de retirer des menus. Les quatre lots précédents restent conservés dans le dépôt local. La refonte doit être livrée par modifications réversibles, avec backend compatible publié avant l'interface si un contrat est ajouté.

Ne pas introduire de nouvelle table universelle, déplacer de fichiers, effacer d'anciennes tâches ou réécrire les statuts pour réussir un premier écran. Une migration additive ne se justifie que si un besoin établi ne peut être représenté avec les liens actuels.

## 10. Recette et mesure de simplicité

Scénarios indispensables :

1. Service simple : agent → compte rendu et justificatifs directs → remise → confirmation du client, sans tâche créée.
2. Service avec étapes : responsables et agents différents ; étape terminée et contrôlée sans confirmer le service à la place du client.
3. Tâche liée seulement à un bien et tâche historique sans parent : accès maintenu, aucun faux service, aucune donnée de tiers exposée.
4. Projet : phases ou tâches ouvertes et pièce manquante correctement expliquées ; confirmation finale réservée au client.
5. Commande et transport : documents, expédition, preuve de remise, code de départ et sous-missions inchangés.
6. Droits : ancien exécutant, acteur affecté seulement à une tâche, changement de territoire, refus d'accès après ouverture.
7. Résilience : double clic, interruption d'envoi, réponse tardive, changement d'utilisateur, réouverture d'un brouillon.
8. Volumes : ancien dossier, plus de 25 dossiers et de nombreuses étapes ; regroupement avant pagination et compteurs exacts.
9. Finances et liens : transaction affichée une seule fois dans un total, ancienne URL de preuve, notification de tâche, retour aux filtres.

Objectifs à mesurer pendant une petite recette avec clients, agents et responsables : retrouver la prochaine action sans aide, joindre le résultat dans le dossier sans changement de module, comprendre qui doit confirmer, retrouver un ancien justificatif. Viser un seul écran de travail pour le service simple et au plus une ouverture de section supplémentaire pour ses étapes. Ces objectifs sont des critères de conception, pas des gains déjà mesurés.

## 11. Livrable visuel et limites

La [maquette interactive](design/teranga-unification.html) illustre le centre, le dossier, les étapes facultatives, les justificatifs et les rôles. Elle fonctionne hors connexion avec des exemples fictifs, sans authentification ni appels API. Elle permet de discuter la disposition avant de modifier l'application. Ses simulations ne valent pas validation des permissions du backend.

Vérification de la maquette effectuée dans Chromium : parcours de compte rendu → remise → confirmation client ; contrôle d'étape distinct ; création puis affectation d'une étape par le responsable ; accès à une intervention depuis un bien ; variante prestataire ; accès Gestion ; lecture des informations et recherche. Les captures du centre sur ordinateur et du dossier et des étapes sur téléphone ont été examinées. Aucun débordement horizontal aux formats vérifiés (1440 px et 360 px), aucune erreur JavaScript et aucun appel réseau HTTP n'ont été observés pendant cette vérification. Les variantes de projet, commande et transport sont des esquisses de disposition, pas des remplacements fonctionnels de leurs outils actuels.

Pour la parcourir : ouvrir le fichier HTML dans un navigateur. « Voir comme » change le rôle de lecture. « Rejouer la réalisation » prépare un service simple en cours pour l'agent : ouvrir la visite, préparer le compte rendu, utiliser une photo d'exemple, enregistrer puis remettre le résultat. Passer ensuite au rôle client pour le consulter et le confirmer. Recharger le fichier rétablit les données fictives initiales. Les mouvements financiers, l'assistance et la disponibilité sont explicitement présentés comme des emplacements de conception.

Les tests de l'application rapportés dans les bilans précédents restent ceux de ces implémentations. Cette intervention de conception ne les réexécute pas et n'annonce pas le nouveau système comme déjà développé ou déployé. La mise en œuvre suivante devrait porter sur le **lot 1 : le dossier service avec étapes et justificatifs intégrés**.
