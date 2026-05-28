# Migration Teranga vers DigitalOcean Managed MySQL

Ce runbook est la procedure de migration production de Teranga depuis
PlanetScale vers DigitalOcean Managed MySQL, sans perte des donnees reelles.

## Objectif

- Garder Netlify pour le frontend.
- Garder Render pour le backend.
- Remplacer uniquement la base PlanetScale par DigitalOcean Managed MySQL.
- Conserver toutes les donnees : users, services, tasks, evidences, orders,
  projects, transactions, notifications, migrations `SequelizeMeta`.
- Garder une possibilite de rollback pendant quelques jours.

## Architecture cible

```text
Netlify frontend
  -> Render backend Express/Sequelize
    -> DigitalOcean Managed MySQL
```

Le frontend Netlify ne change pas si l'URL publique Render reste la meme.

## Choix DigitalOcean

Configuration conseillee pour Teranga maintenant :

- Engine : MySQL 8.
- Plan : Basic / single node / 1 GB RAM.
- Region : la plus proche du backend Render, pas forcement la plus proche des
  utilisateurs. Si Render est en Europe, choisir `fra1` ou la region DO Europe
  disponible la plus proche.
- Database : `teranga`.
- App user : `teranga_app`.
- Admin/import user : `doadmin` fourni par DigitalOcean.

Ne pas prendre HA/standby tout de suite si le budget est la priorite. Le passage
a HA pourra se faire quand les pays/franchises et le volume justifieront le cout.

## Pre-requis locaux

Installer et verifier :

```powershell
pscale --version
mysql --version
node --version
npm --version
```

Le client MySQL doit etre compatible MySQL 8.

Creer un dossier de backup sans espace dans le chemin :

```powershell
New-Item -ItemType Directory -Force C:\teranga-backups
```

## Phase 1 - Etat initial

Avant toute exportation, noter :

- Nom de l'organisation PlanetScale.
- Nom de la database PlanetScale.
- Branche production PlanetScale, souvent `main`.
- URL Render du backend.
- Region Render du backend.
- Valeur actuelle de `DATABASE_URL` dans Render, sans la partager.

Depuis `backend`, prendre une photo des compteurs PlanetScale actuels :

```powershell
$env:NODE_ENV = "production"
$env:DATABASE_URL = "<DATABASE_URL_PLANETSCALE_ACTUEL>"
npm run db:check
```

Garder la sortie dans un fichier de migration interne. Elle servira a comparer
les compteurs apres import DigitalOcean.

Si `password_reset_tokens` est volontairement laisse en attente pour
DigitalOcean :

```powershell
npm run db:check -- --allow-pending-password-reset
```

Si `SequelizeMeta` est vide ou si une table attendue manque, verifier l'etat
des migrations sans rien modifier :

```powershell
npm run db:reconcile-migrations -- --allow-planetscale-target
```

Pour corriger l'etat avant l'export, uniquement apres validation humaine :

```powershell
npm run db:reconcile-migrations -- --apply --allow-planetscale-target
```

Dans l'etat actuel de Teranga, ce script sert a :

- renseigner `SequelizeMeta` avec les fichiers de migration deja presents dans
  le repo et deja materialises dans la base;
- laisser `20260207123000-create-password-reset-tokens.js` en attente si
  `password_reset_tokens` manque sur PlanetScale, car la branche production
  PlanetScale peut refuser le DDL direct.

Cela evite que DigitalOcean tente de rejouer toutes les migrations apres import.
Apres import DigitalOcean, `npm run db:migrate` appliquera la migration restee en
attente et creera `password_reset_tokens`.

## Phase 2 - Creer la base DigitalOcean

Dans DigitalOcean :

1. Ouvrir **Databases**.
2. Creer un cluster **MySQL**.
3. Choisir le plan **Basic / single node / 1 GB**.
4. Choisir la region proche de Render.
5. Attendre que le cluster soit `Online`.
6. Dans **Users & Databases**, creer :
   - database : `teranga`
   - user : `teranga_app`
7. Dans **Connection details**, telecharger le certificat CA.

DigitalOcean fournit `defaultdb` et `doadmin`; les conserver. Utiliser `doadmin`
pour l'import, puis `teranga_app` pour l'application Render.

Si le cluster est deja cree, initialiser la base applicative et le user depuis
le repo :

```powershell
npm run db:do:init -- --yes --ca-path C:\teranga-backups\do-ca.crt
```

Le script demande le mot de passe `doadmin`, puis le nouveau mot de passe de
`teranga_app`, sans les enregistrer dans le repo.

## Phase 3 - Acces reseau

DigitalOcean Managed MySQL accepte les connexions publiques par defaut. Pour un
durcissement propre :

1. Recuperer les outbound IP ranges du service backend Render :
   - Render dashboard
   - service backend
   - **Connect**
   - onglet **Outbound**
2. Dans DigitalOcean, ajouter ces ranges dans les trusted sources de la DB.
3. Ajouter aussi l'IP publique de ton poste local le temps de l'import.

Si l'ancien workspace Render ou ton plan ne donne pas de ranges utilisables,
garder temporairement l'acces public, mais obliger SSL et mot de passe fort.
Ne ferme pas les trusted sources avant d'avoir teste Render, sinon le backend ne
pourra pas se connecter.

## Phase 4 - Test de connexion DigitalOcean

Tester depuis ton poste :

```powershell
mysql --host <DO_HOST> --port 25060 --user doadmin --password --database teranga --ssl-ca C:\teranga-backups\do-ca.crt
```

Dans le prompt MySQL :

```sql
SELECT VERSION();
SELECT DATABASE();
SHOW TABLES;
```

`SHOW TABLES` doit etre vide ou presque vide avant import.

Si le client `mysql` n'est pas installe localement, utiliser le script Node de
verification apres avoir renseigne `DATABASE_URL` et le CA :

```powershell
$env:NODE_ENV = "production"
$env:DATABASE_URL = "mysql://teranga_app:<PASSWORD>@<DO_HOST>:25060/teranga"
$env:DB_SSL = "true"
$env:DB_SSL_REJECT_UNAUTHORIZED = "true"
$env:DB_SSL_CA_PATH = "C:\teranga-backups\do-ca.crt"
npm run db:check
```

## Phase 5 - Export PlanetScale

Choisir une periode calme et eviter les ecritures pendant l'export final.

Dump de rehearsal :

```powershell
pscale database dump <PLANETSCALE_DB_NAME> <BRANCH_NAME> --org <ORG_NAME> --output C:\teranga-backups\planetscale-rehearsal --output-format=sql
```

Dump final :

```powershell
pscale database dump <PLANETSCALE_DB_NAME> <BRANCH_NAME> --org <ORG_NAME> --output C:\teranga-backups\planetscale-final --output-format=sql
```

Verifier que le dossier contient des fichiers SQL de schema et de donnees :

```powershell
Get-ChildItem C:\teranga-backups\planetscale-final
```

Ne pas envoyer ces fichiers par email ou messagerie. Ils contiennent des donnees
personnelles et des hashes de mots de passe.

## Phase 6 - Import dans DigitalOcean

### Option A - Import via le script Node du repo

Cette option est recommandee si le client `mysql` n'est pas installe sur le
poste. Le script refuse par defaut d'importer vers PlanetScale ou vers une base
non vide.

Configurer la cible DigitalOcean :

```powershell
$env:NODE_ENV = "production"
$env:DATABASE_URL = "mysql://doadmin:<DOADMIN_PASSWORD>@<DO_HOST>:25060/teranga"
$env:DB_SSL = "true"
$env:DB_SSL_REJECT_UNAUTHORIZED = "true"
$env:DB_SSL_CA_PATH = "C:\teranga-backups\do-ca.crt"
```

Verifier l'ordre des fichiers sans executer :

```powershell
npm run db:import-dump -- --dir C:\teranga-backups\planetscale-final --dry-run
```

Importer :

```powershell
npm run db:import-dump -- --dir C:\teranga-backups\planetscale-final --yes
```

Si un premier import a cree les schemas puis a echoue sur les donnees, repartir
proprement :

```powershell
npm run db:import-dump -- --dir C:\teranga-backups\planetscale-final --yes --reset
```

Si la base contient deja des tables et que c'est intentionnel, sans reset :

```powershell
npm run db:import-dump -- --dir C:\teranga-backups\planetscale-final --yes --allow-nonempty
```

### Option B - Import via le client MySQL

Importer d'abord les schemas, puis les donnees :

```powershell
$env:MYSQL_PWD = "<DOADMIN_PASSWORD>"

Get-ChildItem C:\teranga-backups\planetscale-final -Filter "*-schema.sql" | Sort-Object Name | ForEach-Object {
  $sqlFile = $_.FullName.Replace('\', '/')
  mysql --host <DO_HOST> --port 25060 --user doadmin --database teranga --ssl-ca C:\teranga-backups\do-ca.crt --execute "SOURCE $sqlFile"
}

Get-ChildItem C:\teranga-backups\planetscale-final -Filter "*.sql" | Where-Object { $_.Name -notlike "*-schema.sql" } | Sort-Object Name | ForEach-Object {
  $sqlFile = $_.FullName.Replace('\', '/')
  mysql --host <DO_HOST> --port 25060 --user doadmin --database teranga --ssl-ca C:\teranga-backups\do-ca.crt --execute "SOURCE $sqlFile"
}

Remove-Item Env:\MYSQL_PWD
```

Si un fichier echoue, arreter et noter le nom exact du fichier et l'erreur. Ne
pas continuer l'import comme si tout allait bien.

## Phase 7 - Verification import

Configurer temporairement le repo local pour pointer vers DigitalOcean :

```powershell
$env:NODE_ENV = "production"
$env:DATABASE_URL = "mysql://teranga_app:<PASSWORD>@<DO_HOST>:25060/teranga"
$env:DB_SSL = "true"
$env:DB_SSL_REJECT_UNAUTHORIZED = "true"
$env:DB_SSL_CA_PATH = "C:\teranga-backups\do-ca.crt"
npm run db:check
```

Comparer les compteurs avec la sortie PlanetScale de la Phase 1 :

- `users`
- `services`
- `tasks`
- `evidences`
- `transactions`
- `orders`
- `projects`
- `SequelizeMeta`

Puis lancer :

```powershell
npm run db:migrate
```

Si `SequelizeMeta` a ete importee correctement, cette commande ne doit presque
rien appliquer. Si elle applique des migrations, noter lesquelles.

## Phase 8 - Bascule Render

Dans Render, mettre a jour les variables du backend :

```env
NODE_ENV=production
DATABASE_URL=mysql://teranga_app:<PASSWORD>@<DO_HOST>:25060/teranga
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

Important :

- Ne pas mettre `PLANETSCALE_DATABASE_URL` apres migration.
- Ne pas utiliser `doadmin` dans Render sauf urgence.
- Coller le certificat CA avec `\n` a la place des retours ligne, ou utiliser
  `DB_SSL_CA_PATH` si le certificat est monte comme fichier secret.

Redeployer le backend Render.

## Phase 9 - Verification applicative

Verifier dans cet ordre :

1. `https://<render-backend>/api/ready` retourne 200.
2. `https://<render-backend>/api/health` retourne `ok: true`.
3. Login admin.
4. Page dashboard.
5. Liste users.
6. Liste services.
7. Liste tasks.
8. Liste orders.
9. Liste projects.
10. Upload ou affichage medias si ImageKit est configure.
11. Creation d'une donnee de test non critique.
12. Suppression de cette donnee de test.

Surveiller les logs Render pendant au moins 30 minutes :

- erreurs `SequelizeConnectionError`
- erreurs SSL
- erreurs `Access denied`
- erreurs `Table ... doesn't exist`

## Phase 10 - Fenetre de rollback

Garder PlanetScale actif 3 a 7 jours.

Rollback si probleme majeur :

1. Remettre l'ancien `DATABASE_URL` PlanetScale dans Render.
2. Redeployer Render.
3. Verifier `/api/ready`.
4. Ne pas continuer a ecrire dans les deux bases en parallele.

Si des donnees ont ete creees sur DigitalOcean apres la bascule, il faudra les
reconcilier manuellement avant de revenir durablement sur PlanetScale.

## Phase 11 - Nettoyage final

Quand tout est stable :

1. Exporter un dump DigitalOcean de securite.
2. Supprimer `PLANETSCALE_DATABASE_URL` de tous les environnements.
3. Supprimer les anciennes credentials PlanetScale de tes notes/secrets.
4. Resilier PlanetScale seulement apres confirmation que DigitalOcean fonctionne.
5. Garder le dump final chiffre dans un stockage prive.

## Commandes utiles

Verifier la base pointee par `DATABASE_URL` :

```powershell
npm run db:check
```

Valider la configuration production :

```powershell
npm run validate:prod-config
```

Tester les migrations :

```powershell
npm run db:migrate
```

## Sources officielles

- DigitalOcean Managed Databases: https://docs.digitalocean.com/products/databases/
- DigitalOcean MySQL connection: https://docs.digitalocean.com/products/databases/mysql/how-to/connect/
- DigitalOcean MySQL import/export: https://docs.digitalocean.com/products/databases/mysql/how-to/import-databases/
- DigitalOcean MySQL users/databases: https://docs.digitalocean.com/products/databases/mysql/how-to/manage-users-and-databases/
- Render outbound IPs: https://render.com/docs/static-outbound-ip-addresses/
- PlanetScale database dump CLI: https://planetscale.com/docs/cli/database
