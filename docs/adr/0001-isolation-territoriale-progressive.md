# ADR 0001 — Isolation territoriale progressive

- Statut : accepté
- Date : 2026-08-31
- Décideurs : produit, opérations, architecture Teranga

## Contexte

Le modèle historique porte `countryId` et `regionId` directement sur les
utilisateurs et les principales ressources. Ces colonnes sont souvent nullable
pour préserver les données du pilote Mali. Le filtrage régional inclut aussi,
par défaut, les ressources sans région lorsque leur pays correspond.

Ce comportement évite de masquer les données historiques, mais il ne constitue
pas une isolation suffisante pour contractualiser l'accès d'un franchisé à son
seul territoire.

## Décision

Teranga adopte les invariants suivants :

1. Toute nouvelle opération terrain doit avoir un pays d'exécution vérifié.
2. Une ressource avec une région doit toujours avoir un pays cohérent avec
   cette région.
3. Une ressource sans région n'est jamais attribuée implicitement à toutes les
   régions de son pays en mode strict.
4. Une donnée ambiguë est mise en quarantaine pour traitement par le siège.
5. Le frontend peut demander un filtre, mais le backend dérive toujours le
   périmètre autorisé depuis l'identité et les adhésions de l'utilisateur.
6. Toutes les lectures, mutations et exportations doivent appliquer la même
   politique d'autorisation.
7. L'activation du mode strict est précédée d'un audit, d'un backfill et de
   tests matriciels rôle × action × territoire.

## Déploiement sans régression

Le changement est progressif :

1. `GEO_SCOPE_STRICT_MODE=false` conserve le comportement existant.
2. `npm run data:audit-geo` mesure les incohérences et l'impact du mode strict.
3. Les données ambiguës sont corrigées ou explicitement placées dans un scope
   pays.
4. Le mode strict est testé en répétition, puis activé par environnement.
5. Après stabilisation, le mode strict deviendra la valeur par défaut et le
   fallback historique sera supprimé.

## Conséquences

- Avantage : activation réversible sans migration destructive.
- Avantage : visibilité quantitative avant chaque changement de politique.
- Coût : maintien temporaire de deux comportements.
- Coût : les ressources historiques sans région doivent être qualifiées avant
  l'activation stricte pour ne pas disparaître des vues régionales.

## Étape suivante

Introduire de façon additive `organizations`, `territories`,
`organization_territories` et `memberships`, puis migrer les domaines un par un
vers une politique d'autorisation centrale.

