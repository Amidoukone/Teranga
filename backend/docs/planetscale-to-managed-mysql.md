# Migration PlanetScale vers MySQL manage

Ce guide couvre la migration de Teranga depuis PlanetScale vers une base MySQL
managee moins chere, en gardant Netlify pour le frontend et Render pour le
backend.

## Situation du projet

- Frontend Netlify : pas de changement si l'URL Render de l'API reste identique.
- Backend Render : lit la base via `DATABASE_URL` quand `NODE_ENV=production`.
- ORM : Sequelize + `mysql2`.
- Migrations : `backend/migrations`, suivies par la table `SequelizeMeta`.
- Fichiers : les medias sont hors DB si ImageKit est utilise; sinon verifier
  `UPLOADS_ROOT` avant tout changement d'hebergement.

## Choix recommande

Rester sur MySQL 8 compatible. Une migration vers PostgreSQL demanderait de
changer le dialecte Sequelize, les types JSON/ENUM, les migrations et les
requetes SQL brutes. Pour reduire le cout sans toucher au domaine applicatif,
prendre un MySQL manage.

Options a regarder selon budget :

- Aiven MySQL Developer : interessant si la base est petite et que le budget
  cible est autour de quelques dollars par mois.
- Railway MySQL : simple et economique pour une petite production, facturation
  usage + abonnement.
- DigitalOcean Managed MySQL : plus previsible, souvent plus cher qu'Aiven ou
  Railway mais robuste pour une petite production classique.

## Variables Render apres migration

Garder :

```env
NODE_ENV=production
DATABASE_URL=mysql://user:password@host:3306/database
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

Ajouter seulement si le fournisseur donne un certificat CA :

```env
DB_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

ou :

```env
DB_SSL_CA_PATH=/etc/secrets/mysql-ca.pem
```

Supprimer apres validation :

```env
PLANETSCALE_DATABASE_URL
```

Ne mettre `DB_SSL=false` que si le fournisseur fournit explicitement un endpoint
prive non TLS et que Render peut y acceder de maniere securisee.

## Export PlanetScale

Depuis un poste local avec le CLI PlanetScale connecte :

```powershell
pscale database dump <PLANETSCALE_DB_NAME> <BRANCH_NAME> --org <ORG_NAME> --output ".\backups\teranga-planetscale-dump" --output-format=sql
```

En general, `<BRANCH_NAME>` vaut `main`. Le dump contient des fichiers
`*-schema.sql` et des fichiers de donnees `.sql`.

## Import dans le nouveau MySQL

Creer d'abord la base cible si le fournisseur ne l'a pas deja creee :

```powershell
mysql --host <HOST> --port <PORT> --user <USER> --password --ssl-mode=REQUIRED -e "CREATE DATABASE IF NOT EXISTS teranga CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

Importer d'abord les schemas, puis les donnees :

```powershell
$env:MYSQL_PWD = "<PASSWORD>"
Get-ChildItem ".\backups\teranga-planetscale-dump" -Filter "*-schema.sql" | Sort-Object Name | ForEach-Object {
  $sqlFile = $_.FullName.Replace('\', '/')
  mysql --host <HOST> --port <PORT> --user <USER> --ssl-mode=REQUIRED teranga --execute "SOURCE $sqlFile"
}
Get-ChildItem ".\backups\teranga-planetscale-dump" -Filter "*.sql" | Where-Object { $_.Name -notlike "*-schema.sql" } | Sort-Object Name | ForEach-Object {
  $sqlFile = $_.FullName.Replace('\', '/')
  mysql --host <HOST> --port <PORT> --user <USER> --ssl-mode=REQUIRED teranga --execute "SOURCE $sqlFile"
}
Remove-Item Env:\MYSQL_PWD
```

Pour un gros dump, utiliser `myloader` avec le dossier de dump PlanetScale.

## Verification avant bascule

Sur la nouvelle base :

```sql
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM properties;
SELECT COUNT(*) FROM services;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM SequelizeMeta;
```

Puis depuis `backend` avec `DATABASE_URL` pointant sur la nouvelle base :

```powershell
npm run validate:prod-config
npm run db:migrate
```

`db:migrate` doit normalement etre un no-op si `SequelizeMeta` a ete importee.
S'il applique des migrations, noter lesquelles et verifier les logs.

## Bascule Render

1. Mettre l'application en periode calme.
2. Export PlanetScale final.
3. Import final dans le nouveau MySQL.
4. Mettre a jour `DATABASE_URL` et les variables `DB_SSL_*` dans Render.
5. Redeployer le backend Render.
6. Verifier :
   - `/api/ready` retourne 200.
   - `/api/health` retourne `ok: true`.
   - login admin.
   - listes principales : utilisateurs, services, taches, projets, commandes.
   - creation simple puis suppression d'une donnee de test.
7. Garder PlanetScale actif quelques jours pour rollback.
8. Quand tout est confirme, supprimer les variables PlanetScale et resilier.

## Rollback

Si la nouvelle base echoue :

1. Remettre l'ancien `DATABASE_URL` PlanetScale dans Render.
2. Redeployer le backend.
3. Verifier `/api/ready`.
4. Ne pas ecrire de nouvelles donnees dans les deux bases en parallele sans plan
   de reconciliation.
