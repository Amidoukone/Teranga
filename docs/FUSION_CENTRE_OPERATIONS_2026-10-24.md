# Un seul centre des opérations

Première étape de la nouvelle simplification demandée le 24 octobre 2026 : réunir le centre des activités, les notifications et la coordination dans un même espace, sans changer les règles des prestations.

## Parcours

Un seul intitulé « Centre des opérations » apparaît dans la navigation. Le raccourci avec compteur ouvre les informations à lire, sans les marquer automatiquement comme lues.

| Vue | Usage | Accès |
| --- | --- | --- |
| À lire | Consulter les nouvelles informations et ouvrir le dossier concerné. | Chaque utilisateur, pour ses propres informations. |
| Tout le suivi | Retrouver les étapes passées, y compris les informations déjà lues. | Chaque utilisateur, pour ses propres informations. |
| Demandes à coordonner | Prendre en charge, affecter et suivre les services, projets et commandes du territoire autorisé. | Administrateurs, selon les autorisations existantes. |

L’administrateur arrive sur les demandes à coordonner ; les autres rôles arrivent sur les informations à lire. Les filtres, le nettoyage et les réglages de coordination restent disponibles dans des panneaux secondaires. Les formulaires de coordination restent montés lors du passage vers une autre vue afin de conserver la saisie en cours ; ce maintien ne constitue pas une sauvegarde après fermeture du navigateur.

Chaque information propose une action explicite : ouvrir le service, le projet, la commande, la tâche ou le justificatif. Une alerte de coordination ouvre la demande concernée avec son type et sa référence. Le périmètre géographique reste vérifié au serveur.

Marquer une information comme lue ne termine pas une prestation. Retirer une information ne supprime ni dossier ni justificatif. Le nettoyage garde les informations non lues, celles récemment lues ou actualisées, et les dossiers métier.

## Compatibilité et données

- `/operations` est l’entrée commune.
- `/notifications` redirige vers `/operations?vue=a-lire`.
- `/activities` redirige vers `/operations?vue=historique`.
- `/admin/operations` conserve sa restriction administrateur et redirige vers `/operations?vue=coordonner`.
- Les anciennes API restent disponibles. Le nouveau suivi personnel utilise `/api/v1/operations/updates` ; les suppressions et le nettoyage sont limités au destinataire connecté.
- Notifications et activités sont rapprochées avant filtrage et pagination : la dernière copie d’une même étape apparaît une seule fois ; les étapes antérieures restent consultables. Les anciens changements de statut qui conservent l’auteur initial de la notification sont également rapprochés.
- Une empreinte de la version affichée protège la lecture et la suppression individuelles contre une nouvelle information arrivée entre-temps. Les suppressions des deux copies sont transactionnelles.
- La date de lecture est séparée de la date de l’information. Les anciennes notifications déjà lues et dépourvues d’activité utilisent leur date `updatedAt` existante ; aucune date historique manquante n’est reconstituée.
- Une actualisation échouée conserve les informations déjà chargées dans le même périmètre. Un changement de compte, de filtre ou une révocation d’accès ne réaffiche pas les données précédentes.

Aucune migration, nouvelle dépendance ou variable d’environnement n’est nécessaire. Publier le backend correspondant avant la nouvelle interface, car elle utilise la nouvelle API de suivi.

## Validation locale

- 523 tests backend réussis, dont les scénarios MySQL de rapprochement des sources, pagination, droits des cinq rôles, changements d’auteur, dates de lecture, nettoyage, versions périmées et annulation transactionnelle.
- 201 tests interface réussis, dont la navigation commune, les droits, la conservation des brouillons de coordination et les réponses tardives après changement de compte.
- 13 scénarios Chromium ciblés réussis : anciens liens, lecture et historique, comptes client et prestataire sur mobile et ordinateur, coordination et changement de territoire.
- 9 scénarios Chromium avec vrai serveur et MySQL réussis : authentification, demandes, tâches, centre des opérations, commandes, justificatifs et validation client sur mobile, mobilité.
- Contrôles du code et compilation de production réussis.

Les changements de ce lot sont locaux. Une vérification avec les utilisateurs sur leurs téléphones reste utile pour choisir la prochaine étape de simplification.
