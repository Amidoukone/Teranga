# ADR 0002 — Socle additif de gouvernance territoriale

- Statut : accepté
- Date : 2026-08-31
- Dépend de : ADR 0001

## Décision

Introduire quatre concepts sans remplacer immédiatement le modèle historique :

- `organizations` représente le siège, les masters pays, les structures régionales et les partenaires ;
- `territories` forme une hiérarchie pays, région, ville, district et zone ;
- `organization_territories` décrit les territoires couverts par chaque organisation ;
- `memberships` attribue à un utilisateur un rôle dans une organisation et, si nécessaire, un territoire.

Les colonnes historiques `country_id` et `region_id` restent la source utilisée par les routes actuelles pendant la phase de projection et de comparaison. Les nouvelles tables n'ajoutent donc aucune permission et ne changent aucun résultat d'API lors de leur création.

## Compatibilité et intégrité

Les associations Sequelize documentent les relations, mais cette première migration ne crée pas de clés étrangères physiques. Ce choix reste compatible avec les environnements MySQL actuels et permet de détecter les anomalies avant de rendre les contraintes bloquantes.

Les codes d'organisation et de territoire sont uniques et stables. Un territoire est toujours rattaché à un pays. Une affiliation garde des dates de validité et un statut afin de conserver l'historique des responsabilités.

## Ordre de mise en service

1. créer les tables ;
2. projeter pays, régions, franchises et administrateurs avec un script idempotent en mode simulation ;
3. comparer les scopes historiques et projetés ;
4. activer la lecture parallèle puis la nouvelle autorisation derrière un drapeau ;
5. seulement après convergence, rendre les contraintes physiques obligatoires et retirer les champs historiques redondants.

## Retour arrière

Tant que les routes lisent les champs historiques, le nouveau socle peut être désactivé sans effet fonctionnel. La migration descendante supprime les tables dans l'ordre inverse des dépendances.
