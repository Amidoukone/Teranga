# Unification des dossiers projets et commandes

Date : 25 octobre 2026. Suite du [lot navigation et interventions](NAVIGATION_INTERVENTIONS_2026-10-25.md). Implémentation locale ; aucun commit, push ou déploiement dans ce lot.

## Cadre commun

Les deux écrans utilisent désormais le même en-tête et la même disposition, sur téléphone comme sur ordinateur :

1. Référence typée, titre, état et personne chargée du travail.
2. « Ce qui se passe maintenant » : réalisation à poursuivre, attente expliquée ou résultat à examiner.
3. Réalisation : phases et étapes complémentaires du projet, ou articles de la commande.
4. Documents, justificatifs, compte rendu et action autorisée.
5. Montants et paiements, puis détails et outils secondaires, repliés par défaut.

Trois accès courts conduisent à la réalisation, aux justificatifs et aux montants. L'accès aux montants ouvre la section correspondante. Le retour conserve la file et sa recherche lorsqu'on vient du centre. Les anciennes URL restent compatibles. L'aide reste accessible dans la navigation générale et le pied de page.

Le formulaire d'ajout de phase, les ajouts de justificatifs et de mouvements financiers, les filtres documentaires et les outils administratifs sont secondaires. Leur actualisation ne réinitialise pas le brouillon du même dossier. Le résultat et ses justificatifs précèdent la confirmation client du projet. Si la lecture des documents échoue, l'interface demande de les recharger avant de confirmer.

## Différences métier conservées

| Sujet | Projet | Commande |
| --- | --- | --- |
| Réalisation | Phases facultatives et tâches existantes distinctes. | Articles, quantités et prix enregistrés dans la commande. |
| Remise | Compte rendu de 20 à 4 000 caractères, phases terminées et tâches non bloquantes, photo ou rapport ajouté par l'auteur de la remise. | Compte rendu de 20 à 4 000 caractères et justificatif de commande ajouté par l'auteur de la livraison. |
| Confirmation finale | Appartient au client propriétaire du projet. | La livraison est déclarée par l'équipe autorisée ; aucune confirmation de projet n'est ajoutée au client de la commande. |
| Paiement | Mouvements financiers et soldes par devise conservés. | État de paiement distinct de l'expédition et de la livraison ; livrer ne crée pas de règlement. |
| Dossier historique sans coordination | Outil administratif existant conservé dans les détails. | Outils administratifs existants conservés, avec explication du suivi historique. |

La progression d'une phase utilise l'endpoint existant. Seuls le responsable et le client dans sa fenêtre de modification déjà prévue peuvent la modifier. Les boutons de modification/suppression autrefois montrés à l'agent ont été retirés : le serveur refusait déjà ces opérations. La réalisation d'une tâche n'achève pas automatiquement le projet.

Les articles affichent leur nom enregistré lors de la commande, avant l'éventuel nom du produit courant. Le bouton « Annuler l'article » a été retiré de cet écran : le modèle OrderItem ne persiste pas le statut qu'il envoyait. Le retrait d'article existant et le recalcul serveur sont conservés. Aucun statut d'article ni nouveau comportement d'annulation n'a été inventé.

La frise qui plaçait « Payée » entre préparation et livraison a été retirée. Avancement du travail et paiement sont maintenant présentés séparément.

## Conditions de remise et autorisations

`GET /operations/work/:type/:id` conserve ses permissions et ajoute une lecture indicative des conditions de remise pour le personnel autorisé au stade concerné :

```json
{ "readiness": { "openPhases": 0, "openTasks": 0, "hasProof": true, "proofId": 123 } }
```

Les autres stades et les clients reçoivent `readiness: null`. Les conditions de lecture et d'écriture partagent la même fonction. L'envoi recontrôle les prérequis dans la transaction et garde les verrous existants. La lecture ne fait avancer aucun travail et n'enregistre aucun paiement. Le bouton de remise reste indisponible lorsque la lecture signale un prérequis manquant ; le texte du compte rendu reste saisissable.

Le dossier projet affiche les tâches complémentaires qui lui sont réellement rattachées et que l'utilisateur pouvait déjà consulter. `GET /tasks?projectId=…&workspace=true` applique le contexte et les autorisations **avant** pagination. Le mode workspace retire les objets service, bien et créateur de la représentation, et limite les informations de l'agent à son identifiant et son nom. Un rôle sur le projet ne donne pas automatiquement accès à toutes ses tâches. Le responsable peut connaître le nombre total d'étapes bloquantes sans dévoiler leurs détails aux autres personnes.

Les étapes s'ouvrent dans le dossier limité `/tasks/:id`, avec retour vers `#project-tasks`. Le filtre de projet n'ajoute pas de capacité de création de tâche projet ; les raccordements historiques existants sont conservés. Une réponse incompatible contenant des étapes d'un autre projet produit une erreur explicite dans le panneau.

## Actualisations et erreurs

- Les réponses d'un ancien dossier, compte, rôle ou territoire sont ignorées.
- Les actualisations du même dossier conservent les brouillons et les pièces déjà chargées en cas d'interruption ; une révocation retire les données concernées.
- Une panne des finances ou du catalogue produit n'efface pas le dossier principal. Une panne documentaire est visible et n'est pas présentée comme une absence de justificatifs.
- Les documents utilisent le territoire du dossier autorisé, afin qu'une ancienne sélection administrative ne masque pas les pièces d'un dossier situé dans un autre pays.
- Les devises distinctes restent séparées et les pièces ne sont ni copiées ni requalifiées automatiquement.

Le contrat est documenté dans [OpenAPI](../backend/openapi/openapi.json). Aucune migration, dépendance ou variable d'environnement supplémentaire.

## Validation locale

- Backend : **567 tests réussis**, dans 82 suites. Les tests MySQL couvrent les conditions de remise, le bon auteur et le bon usage du justificatif, les restrictions territoriales et la séparation livraison/paiement. Le filtre des étapes projet est vérifié avant pagination, avec occultation des objets parents.
- Interface : **308 tests réussis**, dans 70 suites. Les cas ajoutés couvrent les dossiers, leurs erreurs partielles, les anciens contextes, les pièces indisponibles avant confirmation, la conservation des brouillons et la consultation des étapes projet.
- Navigateur avec API simulée : **6 scénarios réussis**, dont projets et commandes à 360 et 1440 pixels, actualisation d'une phase sans perte du compte rendu et retour d'une étape vers son projet. Captures inspectées, absence de débordement horizontal vérifiée.
- Navigateur avec API réelle et MySQL de recette : **2 scénarios complets réussis**. Le premier crée un projet, actualise sa phase, envoie un rapport, remet le résultat puis le fait confirmer par le client. Le second crée une commande, envoie un justificatif, confirme la livraison et vérifie que le paiement reste impayé. Les URL du rapport et de l'image renvoient leur fichier avec un statut 200.

Les contrôles du code backend/interface, la compilation de production et la vérification des espaces Git (avec prise en compte des fins de ligne Windows) ont réussi. Les essais de fichiers locaux ne valident pas leur persistance ni la configuration de production. Les tests navigateur ont été rejoués après correction de leurs fixtures de coordination et de leurs sélecteurs, puis après les ajustements de présentation et d'accessibilité du formulaire documentaire.

## Reprise et publication

Les changements de navigation du même jour restent également dans le répertoire de travail. Ne pas les écraser lors d'une reprise. Le commit de base reste `2af8e61` ; ces lots supplémentaires ne sont pas encore commités.

Lors d'une publication ultérieure, publier le backend compatible avant l'interface : le dossier utilise le filtre projet, la représentation limitée des étapes et les conditions de remise. Vérifier ensuite les parcours et les URL des pièces sur Render et Netlify, puis la persistance du stockage dans la vraie configuration.
