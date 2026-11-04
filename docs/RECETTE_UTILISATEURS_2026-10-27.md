# Revue utilisateurs et essais sur téléphones — 27 octobre 2026

**État : préparation locale. Les essais avec des personnes et des appareils physiques ne sont pas encore réalisés.**

Cette fiche suit les [vues par rôle simplifiées](VUES_PAR_ROLE_SIMPLIFIEES_2026-10-27.md). Elle sert à observer une même demande entre plusieurs comptes, jusqu’au résultat et au règlement suivi séparément.

## Environnement recommandé

Prévoir une version de recette accessible en **HTTPS**, avec base, fichiers et comptes de test séparés. Utiliser les quatre rôles réels de l’application et un seul pays/région de référence pour le premier passage. Le même lien doit fonctionner depuis un ordinateur, un téléphone en Wi-Fi et un téléphone en données mobiles.

La [configuration de publication HTTPS](RECETTE_HTTPS_2026-10-27.md) propose maintenant un service de recette distinct, avec interface, API et fichiers sur une même origine. L’espace d’hébergement, l’URL attribuée et la base dédiée restent à raccorder. Aucun déploiement n’est effectué par ces lots. Le serveur automatique d’intégration et sa base `teranga_e2e_*` restent réservés aux tests automatisés ; ils ne constituent pas une démonstration persistante.

HTTPS permet de demander les permissions GPS dans les conditions normales du navigateur. Le W3C prévoit un refus de géolocalisation dans un contexte non sécurisé. La position ne garantit pas à elle seule une adresse exacte et ses mises à jour dépendent de la visibilité du document. Voir la [spécification Geolocation](https://www.w3.org/TR/geolocation/#request-a-position).

| Repère à renseigner avant la séance | Valeur |
| --- | --- |
| URL HTTPS de recette et version présentée | À renseigner |
| Pays, région et devise | À renseigner |
| Responsable de la séance et contact local | À renseigner |
| Compte client / compte agent / compte prestataire / compte responsable | À renseigner, mots de passe transmis séparément |
| Téléphone Android, navigateur et version | À renseigner |
| iPhone, navigateur et version, si disponible | À renseigner |
| Origine et persistance des justificatifs | À vérifier sur cet environnement |

Ouvrir une session distincte par rôle. Vérifier que le responsable voit son périmètre, que les exécutants sont éligibles et que le contact local appartient au territoire du dossier. Les offres, le véhicule, la position récente et le traitement automatique doivent être configurés pour les essais de transport automatisé.

Pour préparer cette version, partir des exemples de configuration backend/frontend du dépôt en remplaçant **toutes** les adresses de production par celles de recette. Les URL d’API, de fichiers, les origines autorisées et les liens de connexion doivent viser le même environnement. Conserver les réglages de sécurité prévus pour le déploiement. Déployer le backend compatible et ses migrations avant l’interface. Les commandes `validate:prod-config`, `migrations:check` et `release:check -- --country=ML` du backend permettent ensuite de constater la configuration de recette ; elles ne remplacent pas les essais humains ni une décision d’ouverture. Voir le [guide de vérification du déploiement](runbooks/verification-deploiement.md).

## Première revue : comprendre sans explication préalable

Demander à chaque personne de réaliser les actions ci-dessous. Le facilitateur note le premier choix, les hésitations et l’aide nécessaire avant d’expliquer un écran.

| Rôle | Consigne à donner | Observation attendue |
| --- | --- | --- |
| Client | « Retrouvez votre demande et ce qu’il vous reste à faire. » | Mes demandes ou Mon suivi mène au bon dossier ; une confirmation attend des justificatifs consultables. |
| Agent | « Retrouvez le travail qui vous est confié, puis une mission que vous supervisez. » | Services confiés et Missions supervisées sont compris ; la supervision ne propose pas d’accepter l’offre du prestataire. |
| Prestataire | « Rendez-vous disponible, retrouvez une offre, puis un ancien compte rendu. » | Disponibilité dans Mon activité ; offres, interventions et historique dans Mes interventions. |
| Responsable | « Organisez une demande, puis retrouvez la gestion des livraisons. » | Pilotage mène à la coordination ; Gestion donne accès aux outils spécialisés. |

Pour chaque rôle : « Que signifie ce statut ? », « Quelle serait votre prochaine action ? », « Où chercheriez-vous de l’aide ? ». Consigner les réponses spontanées, sans déclarer la vue validée sur la seule base d’une démonstration guidée.

## Parcours communs à exécuter

Conserver les mêmes références de dossier entre les comptes. Ajouter un libellé de séance dans les titres pour retrouver les données.

| Essai | Enchaînement | Résultat attendu |
| --- | --- | --- |
| A — Service agent | Client : nouvelle demande → responsable : prise en charge et affectation → agent : démarrage, compte rendu et photo, remise → client : lecture puis confirmation. | Une seule demande ; photo accessible au client ; confirmation distincte de la remise. |
| B — Service prestataire | Disponibilité → affectation → déplacement/arrivée selon le service → travail → justificatifs → remise → confirmation. | Le prestataire retrouve le dossier et son historique ; l’agent superviseur consulte sans agir à sa place. |
| C — Taxi | Client : départ et destination → offre/affectation → chauffeur : acceptation et déplacement → contrôle du code client → fin → confirmation. | Le bon véhicule et le bon dossier ; mauvais code refusé ; position réelle constatée pendant l’utilisation de l’écran. |
| D — Livraison | Client : destinataire et colis → affectation → acceptation → retrait → remise et preuve → confirmation. | Données du destinataire lisibles ; justificatif consultable ; éventuel montant reçu clairement présenté comme déclaration à rapprocher. |
| E — Règlement | Depuis le dossier : journal → écriture et reçu → retour. | Le reçu est retrouvé ; enregistrer un paiement ne termine pas le travail et terminer le travail ne crée pas un paiement. |
| F — Projet, commande, bien | Créer un projet et une commande depuis Mes demandes ; ouvrir une intervention liée à un bien ; consulter les justificatifs et revenir à la liste filtrée. | Chaque type garde ses règles ; filtres et références conservés ; une intervention autonome ne dévoile pas un service inaccessible. |

Dans A ou B, passer par **Besoin d’aide ? → Aide pour cette demande → Retour au dossier**, puis revenir à la liste. Vérifier le numéro de demande, le contact local et les filtres. Depuis **Informations**, ouvrir également une livraison et une intervention autonome : chaque lien doit retrouver la même ressource que la liste.

## Reprises et cas particuliers

1. Refuser le GPS, puis réessayer après autorisation : les messages doivent refléter le résultat réel ; les actions qui permettent de poursuivre restent accessibles.
2. Couper le réseau pendant la saisie du compte rendu, rétablir la connexion et réessayer : vérifier la saisie et l’absence de double remise. Un fichier non confirmé comme envoyé doit être renvoyé explicitement.
3. Mettre le téléphone en arrière-plan ou verrouiller l’écran, puis revenir : observer l’actualisation et la fraîcheur de la position. Ne pas assimiler le suivi web à une garantie de GPS continu en arrière-plan.
4. Refuser une offre : retrouver les mêmes filtres, constater la libération de la prise en charge et l’absence d’accès ultérieur au dossier retiré.
5. Changer de session : retrouver le travail du nouveau compte, sans données ni brouillon de l’ancien compte.
6. Après redémarrage du serveur de recette, consulter la même preuve et le même reçu avec le client. Constater séparément la réception des informations internes et toute notification externe effectivement configurée.

## Fiche d’observation à copier pour chaque essai

| Champ | À remplir |
| --- | --- |
| Essai, date, appareil, navigateur, réseau | |
| Rôles et références des dossiers | |
| Consigne donnée | |
| Ce que la personne a fait et compris | |
| Résultat attendu / résultat constaté | |
| Aide nécessaire et écran concerné | |
| Capture ou référence du justificatif, sans identifiants de connexion | |
| État : non essayé / réussi / à corriger / impossible dans cet environnement | Non essayé |
| Correction attendue, responsable et résultat du nouvel essai | |

Une erreur d’accès, une mauvaise référence, une double écriture ou une preuve perdue doit être corrigée et rejouée avant d’élargir la séance. Les problèmes de compréhension sont consignés même lorsque le parcours technique réussit. La décision d’ouverture du service demeure distincte de cette revue.

## Corrections préparatoires et validation locale

Les informations utilisent désormais le même résolveur de dossier que les listes : vue propre au rôle, livraison distincte du taxi, intervention autonome ouverte à sa référence exacte. Les notifications de livraison portent le type de colis à la création, à l’affectation et au changement de statut. Les anciennes notifications sans ce contexte conservent leur suivi générique compatible.

L’assistance conserve le dossier, ses paramètres et son contexte de retour ; elle sait lire le suivi de mission et propose les accès adaptés au rôle. Les retours externes ou dirigés vers un autre dossier sont refusés. Le contact est toujours lu sur la ressource autorisée, sans reprise silencieuse du téléphone du pays du compte en cas d’échec.

- **Interface complète : 422 tests réussis dans 81 suites.**
- **Backend ciblé : quatre tests réussis** sur le contexte des notifications à la création, à l’affectation et au changement de statut. La suite backend complète du lot précédent n’a pas été rejouée ; ne pas présenter ses 598 tests comme un nouveau résultat de ce lot.
- **Navigateur avec serveur et MySQL réels : 36 scénarios réussis en un dernier passage complet**, sans reprise ciblée nécessaire dans ce passage. Ils couvrent authentification, catalogue/stock, commandes, services, projets, biens, étapes, finances, transmission entre les rôles, taxi, livraison, refus et retours filtrés. Les nouvelles vérifications d’assistance contrôlent aussi la réponse HTTP 200 du suivi et l’absence de changement de statut après consultation.
- Le premier passage réel s’était arrêté après trois échecs : deux attentes de libellés de recette, puis un quota de connexion atteint après redémarrage du worker. Les attentes ont été corrigées ; le dernier passage complet réussit avec les limites d’authentification existantes, sans les assouplir.
- **ESLint interface, contrôle backend de 318 fichiers, compilation de production et contrôle des espaces Git réussis.** L’avertissement existant sur l’âge des données Browserslist reste présent.

Les journaux et captures de ce lot se trouvent dans `artifacts/handoffs-*`, ignoré par Git. Exemples inspectés : [assistance téléphone](../artifacts/handoffs-real/handoffs.real-delivery-inf-ef34d-correct-workspaces-at-360px-chromium/assistance-context.png) et [assistance ordinateur](../artifacts/handoffs-real/handoffs.real-delivery-inf-15e6d-orrect-workspaces-at-1440px-chromium/assistance-context.png). Les contacts du jeu de données local ne sont pas tous renseignés ; le repli explicite est vérifié, et le bon contact territorial est couvert par les tests d’interface.

Cette validation locale ne vaut pas retour d’utilisateurs ni essai physique. GPS réel, notifications externes et persistance du stockage hébergé restent à constater sur la version HTTPS choisie. Aucune migration ni nouvelle dépendance. Les serveurs temporaires et la base de recette sont arrêtés après les vérifications.

Les changements restent locaux, sans commit, push ni déploiement.
