# Dossier service : étapes et justificatifs intégrés

Premier lot d'implémentation de la [refonte proposée](REFONTE_UNIFICATION_2026-10-24.md), après les quatre étapes de simplification précédentes. Les modifications restent locales à l'issue de ce travail.

## Ce que l'utilisateur peut faire

- Un service simple conserve son démarrage, son compte rendu avec justificatifs directs, sa remise et sa confirmation par le client. Aucune tâche n'est créée automatiquement.
- Le dossier propose une section secondaire « Étapes de réalisation » lorsqu'il contient des tâches. Une personne autorisée peut organiser le travail en étapes si nécessaire.
- Le client et le responsable créent une étape depuis le dossier, avec son titre et ses précisions. Le type, la priorité, l'échéance, le coût estimé et la devise restent dans les options avancées. Par défaut, la devise est héritée du service au serveur.
- La création n'affecte pas implicitement l'agent du service. Le responsable choisit l'intervenant de chaque étape.
- L'intervenant autorisé commence puis termine son étape sur place. Le responsable peut la contrôler séparément. Ces actions ne terminent ni ne confirment le service.
- Les justificatifs d'une étape se consultent et s'ajoutent dans sa carte. Les frais et règlements conservent leur accès lié à cette tâche.
- Un service historique dont le compte rendu est facultatif ne présente plus un texte affirmant qu'un compte rendu inexistant a déjà été enregistré.

Le compte rendu final reste présenté séparément. Un justificatif d'étape ne satisfait pas automatiquement les pièces attendues du résultat final. La fin de toutes les étapes ne change pas le statut du service ; les étapes ouvertes n'introduisent pas de nouvelle interdiction de finalisation d'un service classique.

## Droits et cas particuliers

La réponse serveur indique, pour chaque étape, les possibilités de démarrage, de fin, de contrôle, d'affectation et d'accès aux preuves. L'interface utilise ces capacités ; chaque écriture reste contrôlée par les endpoints existants.

Un agent supervisant le service peut voir des étapes confiées à un autre agent, mais n'obtient pas le droit de les faire avancer. Une affectation reçue pendant la modification d'un choix impose de relire l'intervenant actuel avant d'enregistrer. Ce dernier contrôle concerne les changements observés par l'interface, sans ajout d'un verrou transactionnel aux anciennes routes.

Les justificatifs de tâche utilisent une politique d'accès commune à leur contrôleur et aux capacités affichées. Les règles géographiques existantes sont conservées, y compris la restriction des justificatifs de tâche pour un client dont le périmètre est hors du pays d'exécution. Le présent lot ne modifie pas cette politique ; il ne faut pas confondre cette restriction avec l'accès au résultat final régi par le service.

L'ancienne URL `/services/:id/tasks` affiche le même composant, avec ses actions et preuves intégrées. Un agent affecté seulement à une tâche conserve cet accès sans obtenir un nouveau droit sur le service parent. Le lien de retour au dossier n'est proposé que lorsque le serveur confirme cet accès. Les anciennes pages générales de tâches et de justificatifs restent disponibles. Les tâches liées uniquement à un bien et les données historiques ne sont pas déplacées.

### Lien avec le centre des opérations

Une information relative à une tâche ouvre désormais une entrée ciblée avec `etape=<id>`. Une information relative à un justificatif de tâche ajoute `pieces=1`. Le serveur vérifie le service parent et les droits sur l'étape avant de décider de l'accès au dossier complet. Le client ou l'agent autorisé rejoint le dossier sur cette étape ; un agent limité à la tâche reste dans l'entrée restreinte. Les transports et les accès administratifs de mission gardent une entrée adaptée plutôt que de rediriger vers un suivi incompatible.

Le filtre serveur facultatif `taskId` s'applique avant la pagination, avec les mêmes droits et le même service parent. Une ancienne étape reste donc accessible même lorsqu'elle se trouve au-delà de la première page. Les pièces ciblées s'ouvrent directement ; un lien permet de revenir à toutes les étapes. Une référence devenue inaccessible reste explicite, sans présenter une autre étape à sa place. Le défilement vers cette section n'intervient qu'à l'ouverture ciblée, sans interrompre ensuite la saisie lors des actualisations. Le retour vers le centre conserve son contexte d'origine.

Les services classiques et le suivi des missions hors transport intègrent cette section. Les parcours taxi et livraison conservent leurs outils spécifiques ; ils ne chargent pas cette section générique. Le compte prestataire ne reçoit pas de droits supplémentaires sur les tâches.

## Chargement et interruptions

- La liste intégrée charge vingt étapes par page, avec un total autorisé exact et un ordre stable. Les clients historiques de la route sans le paramètre de dossier gardent leur réponse complète.
- Les listes d'agents et les pièces ne sont chargées qu'à l'ouverture du contrôle correspondant. Une erreur de section ne masque pas le dossier du service.
- L'actualisation des étapes ouvertes intervient toutes les trente secondes lorsque la page est visible, ainsi qu'au retour de la connexion. Les réponses d'un ancien dossier, compte, territoire ou numéro de page ne remplacent pas la vue courante.
- Une interruption réseau conserve les données du même contexte ; un refus de consultation les retire. Les brouillons de création et de pièces résistent aux actualisations. Fermer puis rouvrir le panneau de justificatifs conserve la sélection de fichiers et les notes tant que sa carte reste dans la page.
- Les doubles clics sont bloqués pendant les écritures. Les anciennes routes de création et d'upload de tâches ne reçoivent pas une nouvelle garantie d'idempotence : aucun renvoi automatique n'est ajouté en cas de résultat réseau incertain.
- Un ajout partiel de pièces affiche un avertissement et garde seulement les fichiers que le serveur indique comme manquants. Le quota, les formats et les règles de suppression restent ceux du module de preuves existant.
- Les pièces ont leur propre actualisation. Un refus de suppression ne retire pas le droit de consultation : l'interface recharge les droits de lecture et conserve la galerie lorsqu'ils restent valides.

## Contrat et publication

`GET /tasks/service/:serviceId?workspace=true&page=1&limit=20` ajoute une réponse de dossier, avec un filtre facultatif `taskId` :

- `tasks`, avec les capacités propres à chaque étape ;
- `pagination.total`, calculé après les droits et filtres ;
- `viewer` et `canCreate` ;
- `serviceContext`, présent uniquement lorsque l'utilisateur a accès au service parent.

Les appels sans `workspace=true` gardent leur contrat. Le contrat OpenAPI décrit cette option. Les écritures réutilisent les routes de tâches et justificatifs existantes. Aucune migration, variable de production ou dépendance n'est ajoutée. Publier le backend compatible avant l'interface lorsque ces modifications seront publiées.

## Validation

Les nouveaux scénarios couvrent la pagination complète, l'affectation distincte de celle du service, les droits du superviseur et de l'agent limité à une tâche, le contrôle administratif, les justificatifs partiels et les réponses tardives.

- Backend : suite complète de 543 tests réussie, dont huit tests de dossier service vérifiant également le ciblage d'une ancienne étape et l'absence d'extension des droits sur son parent.
- Interface : suite complète de 249 tests réussie. Les dix-sept tests du nouveau composant couvrent notamment les doubles clics, les brouillons, les refus de consultation et de suppression, la modification concurrente d'affectation et l'ouverture ciblée des pièces. Quatre tests supplémentaires couvrent le choix de destination après vérification du contexte.
- Huit scénarios navigateur avec API simulées réussis, dont les étapes et preuves sur téléphone et ordinateur, les anciens liens et le retour aux filtres de demandes.
- Onze scénarios navigateur avec vrai serveur et MySQL réussis. Le nouveau scénario crée une étape depuis le dossier client, l'affecte depuis le compte responsable, la démarre et la documente depuis le compte agent sur téléphone, puis la contrôle sans terminer le service. La preuve enregistrée est consultable par le client. Les scénarios précédents de remise directe, de validation client, de transport et de coordination restent réussis.
- Après ajout de la liaison depuis le centre, le scénario réel des étapes a été rejoué avec succès et vérifie aussi l'ouverture de la preuve depuis son information au centre des opérations, jusque dans le dossier ciblé.
- Capture du dossier et de l'étape sur petit écran examinée ; absence de débordement horizontal vérifiée.
- Contrôles du code, compilation de production, contrat OpenAPI et recherche de secrets dans les fichiers publiables vérifiés.

La recette du transport a mis en évidence un appel aux étapes depuis le suivi taxi lors d'un changement de compte. L'intégration générique a été retirée des vues de transport et les onze scénarios réels ont ensuite été rejoués avec succès.

## Suite de la refonte

Le prochain lot porte sur la file de dossiers « À faire / À suivre / Informations » du centre des opérations. Le retrait des menus de tâches attend l'intégration de leurs autres contextes, notamment les biens et les interventions historiques. Les projets, commandes, transports et finances conservent leur lot de refonte spécifique.
