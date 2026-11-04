# Projets et biens : listes simples et actions dans leur contexte

Suite du parcours catalogue–commande et de l'ordre de simplification accepté le 26 octobre 2026. Ce lot porte sur les projets, la fiche centrale du bien et le départ d'une intervention depuis cette fiche. La liste universelle des demandes et la suite prestataire restent les prochains lots.

## Projets

Les pages `/projects` et `/admin/projects` utilisent le même espace. La liste ouvre un dossier par carte ; elle ne propose plus un second formulaire financier, des changements de statut, une affectation ou des commandes de modification dispersées. Recherche, avancement, tri et page restent dans l'URL. L'API projets renvoie actuellement l'ensemble autorisé : recherche, tri et pagination de présentation s'appliquent à cet ensemble, sans prétendre à une pagination serveur nouvelle.

La création est fermée par défaut. Le titre, le type, la description et le lieu constituent le formulaire courant. Le budget, la devise et les informations complémentaires sont secondaires ; la carte n'est chargée qu'à son ouverture. Les listes de clients et d'agents sont réservées au formulaire administratif ouvert. Après création, le dossier s'ouvre directement et conserve le retour à la liste.

Le dossier conserve ses phases, ses étapes facultatives, ses documents et son journal financier commun. La modification et la suppression sont dans ses informations secondaires. La suppression garde sa confirmation. Les droits du responsable et la fenêtre d'une heure du client propriétaire sont conservés. Un changement de titre ou de budget ne transmet aucun changement de statut ni d'affectation implicite.

Une affectation de projet coordonné utilise le contrat de coordination existant, pour conserver la cohérence entre l'agent du projet et son exécutant opérationnel. Une affectation commencée n'est pas modifiée par le formulaire. Un brouillon d'affectation devenu ancien après changement par un autre acteur doit être réexaminé.

La modification des informations et l'affectation restent deux appels distincts aux contrats existants. Un refus d'affectation, notamment pour capacité atteinte, conserve l'erreur et le formulaire ; il n'annule pas une modification d'informations déjà enregistrée. Aucun changement de statut n'est déduit de ces appels.

Le client consulte les finances du projet selon ses droits existants ; le responsable et l'agent autorisé disposent de leurs commandes financières. L'ancien formulaire financier de liste pouvait afficher au client une saisie que le journal commun ne lui autorise pas : il est retiré, sans élargissement des droits financiers.

Une correction serveur accompagne le formulaire : des coordonnées explicitement absentes lors d'une modification restent absentes. Elles ne deviennent plus une position `0, 0` par conversion de `null` en nombre. Le géocodage du projet reste facultatif.

## Biens

La liste personnelle devient une recherche paginée par le serveur, avec une seule action principale par bien : **Ouvrir le bien**. Ajouter un bien ouvre un formulaire fermé par défaut ; le passage d'aperçu obligatoire disparaît. Le titre, le type, l'adresse et la ville restent nécessaires ; les informations complémentaires et la carte sont secondaires.

Une fiche `/properties/:id` rassemble l'identité du bien, son adresse, ses photos/documents, ses demandes liées, ses interventions et ses commandes de gestion. Les historiques sont chargés à leur ouverture, vingt éléments à la fois, avec pages distinctes dans l'URL. Ouvrir une intervention puis revenir retrouve la fiche et sa page d'historique. Les interventions autonomes et les étapes historiques gardent leur rattachement et leurs droits ; aucun service artificiel n'est créé.

Les médias conservent les types et limites existants : images et PDF, dix fichiers et quinze Mo par fichier dans l'interface. Le remplacement et le retrait des médias existants passent par le contrat serveur de mise à jour. Une erreur conserve le formulaire et ses fichiers. Les commandes de modification/suppression gardent la fenêtre historique de l'interface pour le client et les accès administratifs. Les contrôles serveur de propriété et de territoire restent distincts de cette fenêtre d'interface.

L'écran administratif historique des biens conserve ses outils et dispose d'un accès à la nouvelle fiche. Sa réorganisation complète relève du lot Gestion ; il n'est pas supprimé dans cette étape. Le regroupement « Biens et projets » conserve ses accès, avec un compteur de biens fondé sur le total serveur.

## Intervention depuis un bien

**Bien → Demander une intervention → besoin et confirmation → dossier de la demande → historique du bien.**

Le parcours charge le bien autorisé avant d'ouvrir le formulaire. Il reprend son adresse, sa ville, son territoire et les coordonnées connues. Le brouillon est isolé par compte et par bien : une autre demande en cours ne remplace pas ce contexte. La demande conserve `propertyId` dans la base ; ce lien est également inclus dans l'empreinte de la requête utilisée pour sa reprise.

Le serveur refuse un bien inexistant, un autre propriétaire, un territoire inaccessible ou une intervention réalisée dans un territoire différent de celui du bien. Le parcours concerne les interventions ; les contrats spécialisés taxi/livraison ne sont pas convertis en interventions de bien. Les validations de lieu et de disponibilité du service restent actives.

Le retour depuis le dossier de demande ou l'intervention historique est limité aux chemins internes reconnus. Les documents d'un bien ne donnent pas accès aux dossiers ou étapes d'un autre utilisateur : chaque liste et chaque ouverture conserve ses propres autorisations.

## Repères techniques

- Projets : `frontend/src/features/projects/ProjectsWorkspace.jsx`, `ProjectEditor.jsx`, `ProjectManagement.jsx` ; exports compatibles des deux pages historiques.
- Biens : `features/properties/PropertiesWorkspace.jsx`, `PropertyEditor.jsx`, `PropertyHistory.jsx`, `pages/PropertyDetailPage.jsx`.
- Demande contextualisée : `pages/MissionCreatePage.js`, `features/mission-creation/MissionCreationWizard.jsx`, `utils/requestLifecycle.js`.
- API ajoutée : `GET /api/properties/:id`, client propriétaire ou administrateur dans son périmètre.
- Contrat enrichi : `POST /api/v1/missions`, `propertyId` facultatif, documenté dans OpenAPI.
- Aucun nouveau modèle, migration, paquet ou secret de configuration.

## Validation et reprise

Validations réussies :

- **576 tests backend, 83 suites**, passage complet incluant la consultation sécurisée du bien, son rattachement à une demande, les contrôles de propriétaire et les coordonnées absentes des projets.
- **386 tests interface, 80 suites**, passage complet, puis **21 tests ciblés** sur les projets et biens après le dernier ajustement du lien administratif d'historique. Ces rejeux ne s'ajoutent pas au total de tests distincts.
- **85 scénarios navigateur avec API simulée**, passage complet final, dont sept nouveaux scénarios projets/biens, avec couverture téléphone et ordinateur.
- **13 scénarios réels avec serveur et MySQL isolé**, réussis dans un même passage : les trois nouveaux parcours de création/modification/affectation et de bien lié, les remises de projets/commandes, les cinq scénarios financiers et les trois scénarios de file/historique.
- Compilation de production, ESLint interface, contrôle syntaxique backend sur 312 fichiers et contrôle des espaces Git réussis.

Les fichiers de recette sont `e2e/projects-properties.spec.js` et `e2e-integration/projects-properties.real.spec.js`. Les anciennes recettes d'historique du bien ont été adaptées au parcours intégré. Captures inspectées à 360 et 1440 pixels ; débordement horizontal vérifié dans les nouveaux parcours. Artefacts locaux : `frontend/test-results/projects-properties-final/` et `projects-properties-real-final/`.

Les premiers passages ont servi à corriger les attentes de tests qui confondaient consultation et saisie financière du client, à attendre l'ouverture réelle du dossier avant son retour, à préparer la capacité de l'agent de recette par son API autorisée et à compléter le choix de devises régionales. Un démarrage du serveur de développement a aussi dépassé son délai ; les contrôles ESLint ont ensuite été exécutés séparément du serveur de recette. Les passages échoués ou interrompus ne sont pas comptés comme validations réussies.

Le passage réel de demande liée au bien vérifie l'adresse préremplie puis réalise une vérification de documents sans destination physique. Les contrôles de géocodage restent conservés et sont testés séparément ; cette recette locale sans clé Maps ne valide pas le géocodage externe. Les fichiers de recette utilisent le stockage local de test, sans validation de l'hébergement des pièces.

Le dépôt contient aussi les lots précédents non commités. Le dernier commit reste `1cb0a6d`. Aucun commit, push ou déploiement n'est effectué ici. Pour publier ultérieurement, le backend compatible avec la consultation du bien et son rattachement aux demandes doit précéder l'interface.

La suite recommandée reste une véritable liste « Mes demandes » regroupant services, projets et commandes avec des filtres compréhensibles et une pagination complète. Viendront ensuite l'espace prestataire, la présentation commune des documents et de l'aide, puis la poursuite de l'allègement de Gestion. L'accessibilité et la reprise après interruption accompagnent chaque lot.
