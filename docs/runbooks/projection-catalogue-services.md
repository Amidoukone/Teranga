# Projection du catalogue de services

## Préconditions

- migrations à jour ;
- projection territoriale appliquée ;
- une organisation opératrice active et principale par territoire ouvert ;
- devises pays vérifiées.

## Procédure

Depuis `backend` :

```powershell
npm.cmd run data:project-service-catalog:json
```

La projection peut être appliquée uniquement si `readyToApply` vaut `true` et si `blockingIssues` vaut `0` :

```powershell
npm.cmd run data:project-service-catalog:apply
```

Relancer immédiatement la même commande. Le second résultat doit indiquer zéro création et uniquement des mises à jour, sans augmentation du nombre de lignes.

## Interprétation des anomalies

- `CATALOG_COUNTRY_NOT_OPERATED` : avertissement ; le pays actif n’a pas encore d’opérateur et ne reçoit aucune offre.
- `CATALOG_TERRITORY_OPERATOR_AMBIGUOUS` : blocage ; plusieurs opérateurs principaux couvrent le territoire.
- `CATALOG_SCOPED_DEFINITION_WITHOUT_OPERATOR` : blocage ; une offre locale cible un territoire sans opérateur.
- `CATALOG_DEFINITION_WITHOUT_AVAILABILITY` : blocage ; une définition active ne serait disponible nulle part.

Ne pas corriger une ambiguïté en choisissant arbitrairement une organisation. Corriger d’abord les affectations territoriales, puis relancer la projection à blanc.

## Vérification côté client

Pour un pays actif ayant des offres projetées, `/api/v1/service-catalog?countryId=ID` renvoie `configured: true` et uniquement les offres actives, valides à la date de consultation, dont la définition, le territoire et l'opérateur sont actifs. Ajouter `regionId` pour vérifier les offres de la région et celles du pays. Le formulaire public et l'assistant de création filtrent les anciennes catégories et les types classiques à partir de ce résultat. Les API de devis et de création refusent avec le statut `409` un service absent du catalogue local actif.

Un pays historique sans aucune offre projetée renvoie `configured: false` : ses choix et ses créations de services existants restent disponibles pendant la transition. Projeter puis activer au moins une offre fait entrer le pays dans la règle locale ; toutes les autres offres doivent alors être activées explicitement. Vérifier les parcours client, invité et commande téléphonique après chaque activation ou désactivation d'offre.
