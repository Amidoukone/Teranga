# Teranga : simplicité des parcours et efficacité des services

Date : 24 octobre 2026. Analyse du dépôt local et corrections des parcours ; aucune certification de l’exploitation en production.

Suite de cet audit : les accueils par rôle, la file commune, l’assistance et la reprise après interruption sont désormais décrits dans le [lot de simplification des espaces de travail](SIMPLIFICATION_PARCOURS_2026-10-24.md). Les limites et résultats ci-dessous correspondent au premier lot.

## La promesse à organiser

« Je décris mon besoin. Teranga organise sa réalisation. Je suis l’avancement et je confirme le résultat. »

La valeur de Teranga se mesure au service effectivement rendu, à son délai, à son coût et à sa qualité. Une demande envoyée n’est pas encore un service réalisé. Le système doit rendre explicites le responsable, la prochaine action, son échéance et les justificatifs attendus.

Conserver les concepts existants : clients locaux et diaspora, agents, prestataires, responsables territoriaux, siège, services classiques, métiers, taxi, livraison, biens et projets. Adapter l’interface au rôle plutôt que demander au client de comprendre cette organisation.

## Ce qui existe effectivement dans le code

| Domaine | Constat et conséquence |
| --- | --- |
| Coordination | Les moteurs `missionCoordination` et `workCoordination` organisent la recherche, les échéances, les reprises et les escalades. Le traitement planifié est exécuté chaque minute, sauf désactivation. Il faut surveiller son exécution réelle après déploiement. |
| Réalité humaine | La disponibilité d’un agent expire. Les nouvelles affectations automatiques ont une échéance de démarrage et peuvent être réattribuées avant démarrage. Préserver ces garanties. |
| Territoires | Le catalogue local et les organisations territoriales existent désormais. L’audit d’août décrit un état antérieur : ses constats de fondations absentes ne doivent pas être repris comme état actuel. La configuration et la couverture doivent rester vérifiées territoire par territoire. |
| Résultat | Les comptes rendus, justificatifs et validations existent. Un délai dépassé ne doit pas être interprété comme une réalisation ou une acceptation client. |
| Accès assisté | Les commandes saisies par un opérateur existent. Les liens téléphone et WhatsApp ouvrent un contact ; ils ne prouvent pas qu’une conversation est automatiquement enregistrée comme une demande. |
| Réseau | La protection contre les créations répétées existe au niveau des requêtes. La saisie d’adresse peut fonctionner sans suggestions. Une création exige toujours une réponse du serveur ; cela ne constitue pas un mode hors connexion. |
| Paiements | Les transactions et le suivi de justificatifs existent. Consulter le runbook de preuve de paiement externe ; ne pas présenter ce suivi comme une intégration de paiement mobile effectivement activée. |

## Corrections apportées dans ce lot

| Parcours | Avant | Après |
| --- | --- | --- |
| Accueil | La demande générale était présentée comme une autre demande, après les actions spécialisées. | Une action « Demander un service » précède les offres spécialisées. Taxi, livraison et immobilier restent accessibles. |
| Client connecté | Quatre étapes : catégorie, lieu, description, confirmation. | Trois étapes : service, besoin et lieu, confirmation. La confirmation et l’estimation restent présentes. |
| Informations complémentaires | Description, photo et message vocal occupaient l’écran principal de l’assistant. | Les éléments facultatifs sont regroupés dans un panneau dépliable. Le besoin en une phrase reste visible. |
| Localisation | Les cartes étaient montées dès l’affichage du lieu ; les suggestions chargeaient le SDK au montage du champ. | Les cartes sont ouvertes sur demande et les suggestions démarrent au focus. Le GPS conserve ses coordonnées si la recherche de nom d’adresse échoue. |
| Transport | L’assistant pouvait poursuivre sans les deux lieux avant un rejet ultérieur. | Le départ et la destination sont contrôlés avant estimation et confirmation ; aucun nouveau champ imposé aux services sans lieu. |
| Envoi | Plusieurs clics pouvaient lancer des estimations simultanées ; la clé d’une demande précédente pouvait être conservée après « nouvelle demande ». | Verrous pendant estimation et envoi ; la nouvelle demande réinitialise sa clé. Les champs du formulaire public sont verrouillés pendant l’envoi. |
| Pièces jointes | L’échec après création était silencieux. | La création reste confirmée et un message demande de transmettre les pièces à Teranga avec la référence. |
| Suivi public | Un service classique créé renvoyait à toute la liste des services. | Le bouton ouvre directement son détail. Les destinations de suivi sont partagées entre création et liste. |
| Prochaine action client | Le client pouvait lire « ajouter la preuve d’exécution » pendant le travail. | Le message indique ce que Teranga ou l’intervenant fait ; le client intervient pour consulter et confirmer le résultat ou signaler un problème. Annulation et litige ont des messages distincts. |
| Changement de pays public | Un choix précédent pouvait rester visible pendant le chargement des nouveaux services. | Les anciens choix et lieux sont retirés immédiatement et l’envoi attend le nouveau catalogue. |
| Prestataire | Les services généraux étaient dans « Plus », derrière taxi et livraison. | Les services sont directement accessibles sur ordinateur et mobile ; l’accueil du prestataire les met en premier. |
| Responsable | Le centre de coordination était dans le menu secondaire ; les réglages d’offres étaient toujours développés. | Le centre des opérations est accessible directement ; les réglages sont dépliables. Les missions ouvrent les pages de gestion autorisées au responsable. |
| Accessibilité | Certains libellés de lieux n’étaient pas reliés à leurs champs personnalisés. | Identifiants et descriptions d’aide sont transmis ; les libellés de l’assistant sont associés aux champs. |
| Passage entre étapes | La position de défilement et le focus pouvaient rester au bas de l’étape précédente. | Le début de l’assistant revient à l’écran et le titre de l’étape reçoit le focus. |

Les machines d’état, permissions serveur, prix, périmètres d’accès et règles de validation ne sont pas modifiés par ce lot.

## Organisation cible par acteur

| Acteur | Question à laquelle son écran doit répondre | Action essentielle |
| --- | --- | --- |
| Client | Où en est ma demande, qui agit, et dois-je faire quelque chose ? | Demander, consulter, confirmer le résultat ou signaler un problème. |
| Agent | Quelles demandes me sont confiées et que dois-je faire maintenant ? | Déclarer sa disponibilité, démarrer, exécuter, justifier. |
| Prestataire | Quel travail m’est proposé et quelle est la prochaine étape ? | Accepter ou refuser, exécuter, transmettre le résultat. |
| Responsable local | Qu’est-ce qui bloque et qui doit intervenir ? | Prendre en charge une exception, affecter ou réaffecter dans son périmètre. |
| Siège | Où la qualité ou la capacité se dégrade-t-elle ? | Superviser les territoires, les incidents et la viabilité du service. |

Les réglages de catalogue, de capacité et de délais restent nécessaires, mais ne doivent pas occuper le parcours quotidien d’une personne qui vient simplement exécuter une demande.

## L’autonomie opérationnelle à vérifier sur le terrain

Le système automatise les transitions autorisées, les recherches et les relances. L’exécution reste humaine. Pour chaque offre ouverte, il faut un résultat attendu compréhensible, une zone réellement couverte, un exécutant éligible, un responsable et un remplaçant, un délai réaliste et une règle de traitement des incidents.

Avant ouverture d’un territoire, réaliser les scénarios existants de préparation terrain : demande acceptée puis réalisée ; aucun exécutant ; refus ou absence avant démarrage ; délai dépassé ; réseau interrompu après envoi ; pièces non transmises ; résultat contesté ; paiement à rapprocher. Vérifier la réception réelle des alertes et la capacité du remplaçant à prendre le relais.

Les relances internes sont déjà présentes. La réception d’un SMS ou d’un message WhatsApp automatique n’est pas attestée par ce travail. L’intégration de ces canaux doit avoir ses accusés de livraison, ses reprises et son budget d’exploitation avant d’être annoncée aux utilisateurs.

Références opérationnelles : [préparation terrain](runbooks/preparation-terrain.md), [coordination résiliente](runbooks/coordination-resiliente.md), [cycle de service](runbooks/sop-cycle-service.md), [preuve de paiement externe](runbooks/preuve-paiement-externe.md).

## Adapter chaque territoire à ses utilisateurs

L’Afrique ne constitue pas un seul marché d’usage. Valider les choix avec les clients, opérateurs et exécutants de la zone pilote, puis refaire cette validation avant extension.

- **Accès** : commencer sur un téléphone d’entrée de gamme, garder le contact téléphonique visible et permettre la prise de demande par un opérateur. Tester aussi avec une personne peu à l’aise avec les formulaires.
- **Réseau et données** : mesurer le poids des écrans et des photos, les temps d’attente et la reprise après coupure. Une confirmation d’envoi doit correspondre à une réponse du serveur. Tester le chargement effectif du SDK quand le champ adresse reçoit le focus : les cartes facultatives ne suppriment pas tout coût de données.
- **Lieu** : quartier, ville et point de repère sont des aides de saisie ; vérifier leur résolution effective. Si le serveur ne reconnaît pas le lieu, utiliser le repère GPS ou l’assistance humaine. Ne pas annoncer que toute adresse informelle est automatiquement exploitable.
- **Langues et compréhension** : français et anglais existent ; choisir les langues supplémentaires selon les usages observés. Le message vocal de l’assistant est utile, mais ne suffit pas à rendre tout le parcours vocal.
- **Prix et paiement** : afficher clairement estimation, montant convenu, frais et justificatif. Choisir les moyens de paiement disponibles et soutenables dans la zone ; vérifier les intégrations réellement opérationnelles avant de les afficher comme disponibles.
- **Confiance** : présenter l’intervenant et le contact local, protéger les coordonnées et conserver l’historique des décisions. Vérifier en exploitation que les personnes présentées comme vérifiées ont bien achevé les contrôles prévus.

Ces priorités s’appuient notamment sur les obstacles d’accès aux appareils et de compétences numériques décrits par la [GSMA, Mobile Economy Africa 2026](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-economy/africa/), et sur la place du mobile money observée par la [Banque mondiale, Global Findex 2025](https://www.worldbank.org/en/news/press-release/2025/07/16/mobile-phone-technology-powers-saving-surge-in-developing-economies). Elles restent des choix de conception à valider localement.

## Mesurer le service rendu

Suivre par offre et territoire les délais de première prise en charge et de réalisation, le taux de réalisation confirmé, les réaffectations, les annulations, les litiges, les justificatifs manquants, les écarts de paiement et le coût opérationnel par service réalisé. Séparer temps d’attente client, temps d’exécution et temps de traitement d’incident.

Définir les cibles après une période pilote mesurée. Le nombre de comptes et de demandes créées ne suffit pas à démontrer la qualité ou l’autonomie. Recueillir aussi le nombre d’appels d’assistance nécessaires pour terminer chaque parcours et les motifs de ces appels.

## Limites et travail restant

Contrôles effectués : 51 suites / 159 tests frontend et 72 suites / 454 tests backend réussis ; lint frontend et compilation de production réussis. Après l’ajustement du focus, les quatre tests de l’assistant ont été rejoués avec succès, ainsi que la compilation et le lint. Cinq scénarios Playwright réussis couvrent la création en trois étapes à 360 et 1 440 pixels, les opérations à 390 et 1 440 pixels, et le changement de territoire Mali/Côte d’Ivoire. Ces scénarios navigateur utilisent des API simulées. Les captures de confirmation ont été examinées. La vérification des différences ne relève pas d’erreur d’espacement en tenant compte des fins de ligne CRLF existantes.

Cette correction couvre les entrées principales, la création, les indications de suivi et l’accès à la coordination. Les modules historiques volumineux, les écrans financiers et les configurations de chaque offre ne sont pas tous réécrits. Les conserver permet de préserver les concepts et les fonctions existants ; leur simplification ultérieure doit partir de tâches réelles observées.

La priorité suivante est une recette de bout en bout avec les acteurs du pilote et les moyens de paiement et de communication effectivement disponibles. Elle doit inclure un appareil modeste, une connexion instable, la réalisation humaine du service et la vérification des justificatifs. Les tests automatisés et les réponses API simulées ne remplacent pas cette recette.

Aucune modification de données de production, activation d’offre, migration ou publication n’est effectuée dans ce lot.
