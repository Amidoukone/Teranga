# Modèle générique des rôles territoriaux

Le même modèle s’applique à tous les pays et régions. Une ville ou une région ne reçoit pas de logique métier spéciale : elle hérite du pays et peut préciser son opérateur, son catalogue et ses équipes.

| Acteur | Responsabilité principale |
|---|---|
| Administrateur | gouvernance, sécurité, arbitrage et supervision |
| Master | pilotage d’un pays ou d’une région |
| Agent | qualification, affectation et suivi des demandes |
| Prestataire | exécution du service et transmission des preuves |
| Client | expression du besoin, validation et satisfaction |

Les permissions sont accordées par capacité et limitées au périmètre territorial de l’utilisateur. Les variantes `global_admin`, `country_admin` et `region_admin` restent des niveaux de portée, pas de nouveaux parcours produit.
