# Teranga – Règles Multi-pays & Franchise (PlanetScale Safe)

## Objectif
Passer d’un système mono-pays (prod stable) à un système multi-pays / franchise
sans casser l’existant, avec une stratégie additive + rétro-compatible.

---

## Principes DB (PlanetScale / Vitess)
1. **Pas de contraintes FK en base**
   - PlanetScale/Vitess gère mal certaines contraintes FK.
   - Les relations sont **logiques** via Sequelize `belongsTo/hasMany`.

2. **Migrations uniquement via branches PlanetScale**
   - Toujours créer une branche (`dev-branche`)
   - Appliquer les changements de schéma dessus
   - Ouvrir une Deploy Request vers `main`

3. **Pas de `sequelize.sync()` en production**
   - Le schéma est géré par migrations / PlanetScale
   - `sync` doit rester désactivé

---

## Règles de nommage (cohérence actuelle)
Le projet est **hybride** (legacy + nouveaux modules) :

- `countries`, `regions`, `franchises` : colonnes DB en `snake_case`
  - ex: `regions.country_id`
- Tables core (legacy) : `camelCase` pour `countryId`, `regionId`
  - ex: `properties.countryId`
- Commerce : `snake_case` dans `products` / `orders`
  - ex: `products.country_id`

### Consigne
- Ne pas renommer les colonnes existantes (risque de régression)
- Toujours utiliser `field:` dans Sequelize lorsque la DB est en `snake_case`.

---

## Scope géographique (countryId / regionId)
Les colonnes suivantes sont ajoutées et **restent nullable** pour rétro-compatibilité :

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
### Default actuel (Prod)
- Pays: **Mali** (`iso_code = ML`)
- Région: **Bamako** (`code = BKO`)

### Règle
- Toute nouvelle colonne `countryId/regionId` est remplie par défaut
  via un backfill (Mali/Bamako) pour conserver le comportement existant.

---

## Index et unicité
- `countries.iso_code` doit être UNIQUE
- `regions` doit avoir un index UNIQUE sur `(country_id, code)`
  afin d’éviter toute ambiguïté de code entre pays.

---

## Bonnes pratiques de déploiement
1. Branch `dev-branche`
2. Schema changes (tables + colonnes + index)
3. Data backfill (INSERT IGNORE + UPDATE where NULL)
4. Vérifications (comptes NULL à 0)
5. Deploy Request vers `main`
6. Backfill prod si non inclus

---

## À venir (phase Franchise)
Quand les franchises seront activées :
- Filtrage par `countryId/regionId` selon rôle (admin franchise / régional)
- Héritage du scope depuis User/Franchise
- Sélection du scope par header / subdomain (selon architecture)
