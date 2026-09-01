# Runbook — Migration vers la gouvernance territoriale

Ce runbook s'exécute environnement par environnement. Il ne faut jamais activer le scope régional strict avant que les deux audits soient verts.

## 1. Sauvegarde et migration du schéma

1. confirmer qu'une sauvegarde restaurable de la base existe ;
2. exécuter les migrations avec le mécanisme habituel de l'environnement ;
3. vérifier la présence de `organizations`, `territories`, `organization_territories` et `memberships` avec `npm run db:check`.

La migration est additive : les routes existantes continuent de lire `country_id` et `region_id`.

## 2. Audit des données historiques

```text
npm run data:audit-geo:json
```

Conserver la sortie comme preuve de migration. Corriger notamment les pays obligatoires absents, les régions inconnues et les couples région/pays incohérents.

Le contrôle bloquant est :

```text
npm run data:audit-geo:gate
```

## 3. Simulation de la projection

```text
npm run data:project-territories:json
```

La commande ne modifie aucune donnée. Elle doit retourner `readyToApply: true`. Une affiliation d'administrateur ambiguë est bloquante et doit être résolue dans les franchises ou le scope historique avant de continuer.

## 4. Application idempotente

```text
npm run data:project-territories:apply
```

L'écriture s'effectue dans une transaction. Les enregistrements projetés ont des codes stables (`TERANGA-HQ`, `LEGACY:COUNTRY:*`, `LEGACY:REGION:*`, `LEGACY:FRANCHISE:*`) ; relancer la commande met à jour la projection sans créer de doublons.

Après l'application, relancer la simulation et archiver la sortie avec le journal de déploiement.

## 5. Activation progressive

Le drapeau `GEO_SCOPE_STRICT_MODE` reste à `false` tant que les comparaisons entre l'ancien scope et les affiliations ne sont pas validées sur les listes, détails et exports.

L'activation se fait d'abord sur un environnement de test, puis sur un pays pilote et enfin globalement. En cas d'écart, remettre le drapeau à `false` ; les colonnes historiques restent disponibles pendant toute la transition.
