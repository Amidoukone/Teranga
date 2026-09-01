# ADR 0003 — Séparer la définition d’un service de sa disponibilité locale

- Statut : accepté
- Date : 2026-08-31

## Contexte

Le référentiel historique `trade_categories` mélange l’identité d’une offre et son périmètre géographique. Les services classiques sont, eux, codés dans l’application. Cette organisation ne permet pas d’ouvrir un pays, de modifier un SLA ou de désactiver une offre locale sans toucher au code ou à la définition globale.

## Décision

Le catalogue cible comporte deux niveaux additifs :

1. `service_definitions` porte l’identité stable, la famille, le profil d’exécution, les preuves et le schéma d’admission ;
2. `service_availabilities` porte l’organisation opératrice, le territoire, la devise, le prix, le SLA, les horaires, les champs locaux et l’activation.

La projection initiale conserve les liens vers `trade_categories` et les types de services classiques. Les créations de missions continuent d’utiliser les contrats historiques tant qu’un basculement explicite et testé n’a pas été décidé.

Un territoire sans organisation opératrice ne reçoit aucune disponibilité. Une offre explicitement rattachée à un territoire non opéré bloque la projection. Un pays actif mais non encore opéré produit un avertissement et reste sans catalogue local.

## Conséquences

- Le catalogue peut évoluer par configuration locale et par version.
- Une offre globale ne devient pas automatiquement commandable dans un pays non opéré.
- La projection est relançable et idempotente.
- Les tables historiques restent la source active pendant la période de double lecture.
