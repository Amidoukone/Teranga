# Vérifier le déploiement, les justificatifs et la restauration

Ces outils complètent la [préparation terrain](preparation-terrain.md). Ils ne changent ni les statuts des demandes, ni les rôles, ni les offres ouvertes. Les commandes s'exécutent depuis `backend` avec Node.js et les dépendances du projet. Les rapports ne contiennent ni mots de passe, ni lignes métier.

## Configuration et migrations

Le serveur, Sequelize et les contrôles utilisent le même chargement d'environnement : les variables du shell ou de l'hébergeur ont priorité ; en production, seul `backend/.env.production` peut compléter ces variables. Le fichier local `backend/.env` n'est pas chargé en production. Les modèles et les migrations de production utilisent toujours `DATABASE_URL`.

Depuis le shell du service hébergé, après disponibilité du code et sauvegarde :

```sh
NODE_ENV=production npm run validate:prod-config
NODE_ENV=production npm run migrations:check
```

`migrations:check` est en lecture seule : il compare les fichiers du déploiement à `SequelizeMeta`, sans créer cette table ni modifier son contenu. Un code d'échec signale des migrations en attente, des migrations inconnues de cette version, une table de suivi absente ou une connexion impossible. Ne pas réconcilier automatiquement le suivi ni ignorer une migration inconnue. Une table de suivi absente sur une base qui contient déjà des données exige une vérification de son historique.

Après examen des migrations en attente et validation de la sauvegarde, appliquer la procédure existante :

```sh
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run migrations:check
NODE_ENV=production npm run release:check -- --country=ML
# Seulement pour un périmètre régional réellement ouvert :
NODE_ENV=production npm run release:check -- --country=ML --region=123
```

`release:check` impose le contexte production et réunit la configuration, la politique de stockage, l'état des migrations et le contrôle terrain. Il refuse notamment un repli local sur disque éphémère, un chemin relatif de stockage ou une politique interdisant le seul stockage disponible. Le contrôle terrain ne démarre que si les migrations sont cohérentes avec le code. Il ne lance pas le moteur : les deux suivis doivent avoir tourné via le vrai serveur `backend/index.js`.

`readyForFieldTests: true` permet de passer aux essais réels ; `openingApproved` reste `false`. Conserver le rapport avec la référence exacte de la version du backend et du build de l'interface. Une configuration ne prouve pas la persistance d'un volume ni le fonctionnement réel d'ImageKit.

## Relire le même justificatif après redémarrage

Déposer une vraie photo ou un document depuis le compte de l'exécutant, puis le consulter depuis le compte client. Utiliser la référence enregistrée pour ce fichier : chemin `/uploads/...` ou URL HTTPS du domaine ImageKit configuré. Le contrôle n'accepte ni chemin hors du stockage, ni redirection HTTP vers un autre domaine. Il limite les lectures à 25 Mio.

Avant le redémarrage, enregistrer une référence dans un dossier privé **extérieur au volume de justificatifs** :

```sh
# Exemple avec stockage local persistant ; le dossier de sortie doit exister.
NODE_ENV=production npm run proofs:check -- --file=/uploads/mission-completions/fichier-reel.jpg --record=/chemin/prive/reference-preuve.json
```

Conserver cette référence hors du serveur ou dans les pièces de recette privées. Redémarrer ou redéployer le service, puis lui remettre le même fichier de référence et vérifier :

```sh
NODE_ENV=production npm run proofs:check -- --verify=/chemin/prive/reference-preuve.json
```

La taille et l'empreinte SHA-256 doivent correspondre. Un fichier manquant, vide, altéré ou inaccessible provoque un échec. Une référence existante n'est jamais écrasée. Pour ImageKit, passer l'URL complète au premier appel. Les paramètres ImageKit viennent du même environnement que le serveur.

`matches: true` constate l'égalité des octets à deux lectures. `requiresRestartConfirmation: true` rappelle qu'il faut conserver séparément la trace du redémarrage/redéploiement entre ces lectures. Pour un volume local, le contrôle lit le système de fichiers ; vérifier également le téléchargement effectif depuis le compte client après redémarrage.

## Restaurer une sauvegarde dans une base locale neuve

La restauration ne se connecte jamais à `DATABASE_URL`. Elle exige `RESTORE_DATABASE_URL`, soit dans le shell, soit dans le fichier privé `backend/.env.restore.local`. Le modèle [backend/.env.restore.local.example](../../backend/.env.restore.local.example) montre le format. L'adresse doit désigner MySQL sur `localhost`, `127.0.0.1` ou `::1`, **sans base dans l'URL**. Le serveur MySQL doit être local, sans tunnel ou proxy vers la production.

Utiliser un compte d'administration local autorisé à créer une base, créer un utilisateur, attribuer les droits sur cette seule base et supprimer cet utilisateur. Le script crée une nouvelle base `terangarestore...` et refuse tout nom de base fourni. Il importe les fichiers avec un compte temporaire limité à cette nouvelle base. Aucun SQL du dump n'est exécuté avec le compte d'administration. Les bases existantes ne sont ni réinitialisées ni supprimées. Le compte temporaire est retiré même si l'import échoue ; la copie reste disponible pour inspection.

Avant l'export, suspendre les écritures applicatives, y compris les tâches automatiques, et attendre les traitements en cours. Collecter les comptages source sur ce même état, puis produire une sauvegarde cohérente avec l'outil de l'hébergeur ou `mysqldump` :

```sh
# Sur le service source, pendant cette fenêtre sans écritures :
NODE_ENV=production npm run backup:counts -- --output=/chemin/prive/counts.json
```

Les comptages sont lus dans une transaction cohérente ; ils ne constituent pas la sauvegarde. Exporter sans `CREATE DATABASE` ni `USE` visant la base source. Les dumps avec `DELIMITER`, routines, événements, définition de comptes ou exigences de privilèges globaux ne sont pas supportés par cet import. Ne pas retirer des parties du dump pour masquer une erreur ; prévoir une restauration avec l'outil natif sur une instance distincte dans ce cas.

Copier le dump SQL et les comptages sur le poste de recette. Le dossier SQL contient uniquement les fichiers de cette sauvegarde, les fichiers `*-schema.sql` d'abord, puis les autres dans l'ordre alphabétique. Exécution locale PowerShell :

```powershell
npm.cmd run backup:rehearse -- --dir=../backups/export --expected=../backups/counts.json --report=../backups/restore-report.json
```

Le script contrôle les tables métier principales, le nombre de lignes de chaque table, les références de clés étrangères (y compris les clés composites), l'état des migrations et l'empreinte de chaque fichier SQL importé. Les noms de fichiers ne doivent pas changer pendant l'essai. Les données personnelles ne sont pas affichées. Sans comptages attendus, ou en cas d'écart, le processus termine en échec, même si une copie a été importée.

Exiger `restored: true`, `dataMatchesExpected: true`, `temporaryAccountRemoved: true`, l'absence d'`error`, puis relire des dossiers et leurs justificatifs sur la copie locale. Ne pas utiliser les accès du service hébergé pour cette relecture. La copie contient les données source mais doit rester fermée au réseau et ne doit démarrer aucun job ou envoi de notification. Les nombres de lignes seuls ne garantissent pas l'identité de toutes les données. `backupApproved` reste donc `false` : le responsable technique doit consigner son contrôle. Un schéma antérieur au déploiement peut avoir des migrations en attente ; la restauration ne les applique pas.

En cas d'arrêt brutal du processus ou de panne MySQL pendant le nettoyage, vérifier et supprimer sur le serveur local le compte indiqué par `temporaryAccount`. Ne jamais transformer un résultat `RESTORE_ACCOUNT_CLEANUP_FAILED` en succès. Les copies restent sur le poste tant que le responsable technique ne les a pas supprimées après sa revue.

La sauvegarde de la base ne sauvegarde pas les fichiers du volume local ni les objets ImageKit. Conserver une sauvegarde adaptée du stockage des justificatifs et vérifier sa restauration et les liens depuis les dossiers. Le retour arrière doit associer une version de code compatible, la base et ces fichiers ; ne pas lancer automatiquement `db:migrate:undo` sur la production.

La recette automatisée locale des outils est disponible avec :

```powershell
npm.cmd run backup:recipe
```

Elle exige MySQL local et les droits d'administration de recette. Elle vérifie un import réel, les comptages, les références orphelines et le refus d'une tentative de modification d'une autre base. Elle échoue si MySQL n'est pas disponible. Elle ne restaure pas la sauvegarde de production.

## Notifications et décision locale

Le contrôle terrain conserve cinq preuves externes : `TEST_PROOF_PERSISTENCE`, `TEST_NOTIFICATION_DELIVERY`, `TEST_BACKUP_RESTORE`, `TEST_COMPLETE_SERVICE`, `LOCAL_OPERATING_APPROVAL`. Pour chaque preuve, consigner la version, le territoire, la date, le responsable, les références de demandes et le résultat dans la [fiche de recette](../RECETTE_DEPLOIEMENT_MODELE.md).

Avec les comptes client, exécutant et responsable du territoire, créer une prestation de recette, l'affecter, la démarrer, lire une notification puis faire évoluer le dossier. Vérifier que l'étape suivante apparaît comme non lue, mène au bon dossier et ne révèle aucun dossier d'un autre territoire. Inclure une réaffectation et une coupure suivie de reconnexion. Les notifications sont internes à l'application ; les liens WhatsApp ne constituent pas une livraison automatique de messages.

Nommer le responsable local et son remplaçant, appeler l'assistance depuis un téléphone local et attribuer un responsable aux demandes sans réponse, aux refus et aux réclamations. L'ouverture reste une décision explicite du responsable local après ces essais.
