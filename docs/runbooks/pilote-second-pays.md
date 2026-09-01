# Lot 6 — Ouverture progressive d’un pays ou d’une région

## Pré-vol technique

Exécuter `npm run pilot:readiness -- XX` puis corriger tous les blocages avant toute activation. Le contrôle est générique et vérifie le territoire, l’opérateur principal unique, le catalogue disponible et les rôles locaux (admin/master, agent, prestataire). Il ne crée aucune configuration particulière pour une ville.

## Déroulé recommandé

1. Semaine 0 : compléter la checklist d’ouverture et former l’équipe locale.
2. Semaine 1 : ouvrir un périmètre limité (une région, deux services, horaires support définis).
3. Semaines 2–4 : suivre quotidiennement les KPI et incidents ; aucun élargissement automatique.
4. Fin S4 : décision go/hold/rollback par opérations, qualité et sécurité.

## Seuils de décision

- go : zéro blocage territorial/sécurité, SLA ≥ 90 %, preuves complètes ≥ 95 % ;
- hold : KPI sous seuil ou incident critique non résolu ;
- rollback : fuite de données, double opérateur ou incohérence de périmètre.

Le pilote reste réversible : désactiver les disponibilités du catalogue avant de retirer les données historiques.
