# Teranga - Regles Multi-pays & Franchise

## Objectif

Passer d'un systeme mono-pays stable a un systeme multi-pays / franchise
sans casser l'existant, avec une strategie additive et retro-compatible.

---

## Principes DB MySQL

1. **Relations logiques dans l'application**
   - Les relations restent definies dans Sequelize avec `belongsTo` / `hasMany`.
   - Les migrations actuelles n'ajoutent pas de contraintes FK en base afin de
     rester compatibles avec l'historique PlanetScale et les imports MySQL.

2. **Migrations Sequelize uniquement**
   - Le schema est gere par les fichiers dans `backend/migrations`.
   - Appliquer les changements via `npm run db:migrate`.
   - Ne pas utiliser `sequelize.sync()` en production.

3. **Portabilite fournisseur**
   - La production utilise `NODE_ENV=production` + `DATABASE_URL`.
   - Les options SSL sont pilotees par `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`,
     `DB_SSL_CA` ou `DB_SSL_CA_PATH`.
   - Le code ne doit pas dependre d'un fournisseur MySQL specifique.

---

## Regles de nommage

Le projet est hybride (legacy + nouveaux modules) :

- `countries`, `regions`, `franchises` : colonnes DB en `snake_case`
  - ex: `regions.country_id`
- Tables core legacy : `camelCase` pour `countryId`, `regionId`
  - ex: `properties.countryId`
- Commerce : `snake_case` dans `products` / `orders`
  - ex: `products.country_id`

### Consigne

- Ne pas renommer les colonnes existantes sans migration dediee et testee.
- Toujours utiliser `field:` dans Sequelize lorsque la DB est en `snake_case`.

---

## Scope geographique

Les colonnes suivantes restent nullable pour retro-compatibilite :

- `properties.countryId`, `properties.regionId`
- `services.countryId`, `services.regionId`
- `tasks.countryId`, `tasks.regionId`
- `evidences.countryId`, `evidences.regionId`
- `transactions.countryId`, `transactions.regionId`
- `projects.countryId`, `projects.regionId`
- `products.country_id`, `products.region_id`
- `orders.country_id`, `orders.region_id`

---

## Seed / Backfill

### Default actuel

- Pays: **Mali** (`iso_code = ML`)
- Region: **Bamako** (`code = BKO`)

### Regle

Toute nouvelle colonne `countryId` / `regionId` doit etre remplie par defaut
via un backfill Mali/Bamako lorsque c'est necessaire pour conserver le
comportement existant.

---

## Index et unicite

- `countries.iso_code` doit etre unique.
- `regions` doit avoir un index unique sur `(country_id, code)` afin d'eviter
  toute ambiguite de code entre pays.

---

## Bonnes pratiques de deploiement

1. Export ou backup avant changement.
2. Migration schema : tables, colonnes, index.
3. Data backfill : `INSERT IGNORE` + `UPDATE ... WHERE ... IS NULL`.
4. Verification des comptes `NULL` et des index attendus.
5. Deploiement backend Render.
6. Verification `/api/ready`, login, tableaux de bord et creation de donnees.

---

## A venir

Quand les franchises seront activees :

- Filtrage par `countryId` / `regionId` selon role.
- Heritage du scope depuis `User` / `Franchise`.
- Selection du scope par header ou sous-domaine selon l'architecture retenue.
