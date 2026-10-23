# Configuration opérationnelle du Mali

Le contrôle de production du 23 octobre 2026 constate huit offres actives, sans délai ni résultat attendu renseignés. L'offre Électricité n'a pas de prestataire actif. Le pays, son opérateur Teranga, son responsable et son assistance sont configurés.

## Suspension de l'électricité

La suspension en attendant un prestataire a été demandée. Depuis `backend`, après déploiement du code compatible, vérifier la cible sans écriture puis appliquer :

```sh
NODE_ENV=production npm run data:suspend-offer -- --country=ML --availability=1
NODE_ENV=production npm run data:suspend-offer -- --country=ML --availability=1 --apply
```

L'identifiant `1` correspond à l'offre Électricité dans la sortie de production fournie. La commande contrôle l'appartenance de cette offre au Mali, ne modifie que son activation et peut être répétée. Elle conserve les prix, délais, règles et dossiers existants. Un identifiant appartenant à un autre pays est refusé. Dans l'interface, le Centre des opérations permet également de suspendre ou rouvrir une offre locale ; cette action est indépendante des champs de configuration encore vides.

## Délais validés provisoirement

Ces délais et résultats attendus ont été validés provisoirement par le responsable du projet le 23 octobre 2026. Ils sont conservés dans `backend/config/operating-offers/mali.json` et s'appliquent uniquement aux offres nationales du Mali. Ce sont des seuils internes de suivi **par étape**, en temps écoulé, pour déclencher une intervention en cas de dépassement. Ils ne représentent pas un engagement de terminer tout dossier dans ce délai. Le temps de traitement d'une administration ou d'un tiers doit être convenu séparément avec le client. Les dépassements ne valent ni réalisation, ni clôture automatique.

| Offre | Délai validé provisoirement | Résultat attendu |
| --- | --- | --- |
| Électricité | Suspendue ; délai à convenir avec le prestataire | Intervention convenue avec le client, compte rendu des travaux et justificatifs remis. |
| Livraison / Courses | 120 minutes | Colis remis au destinataire convenu, confirmation de réception et incident éventuel consignés. |
| Mobilité | 60 minutes | Trajet convenu réalisé et arrivée confirmée par le client. |
| Course / Commission | 240 minutes | Commission convenue exécutée, objets ou documents remis et compte rendu fourni. |
| Démarche administrative | 1440 minutes | Étape convenue du dossier réalisée, justificatif ou référence transmis et prochaine étape précisée. |
| Paiement | 120 minutes | Paiement demandé effectué au bénéficiaire convenu, montant et justificatif transmis au client. |
| Transfert d'argent | 120 minutes | Transfert demandé réalisé vers le destinataire convenu et justificatif de l'opération transmis. |
| Autre service | 1440 minutes | Étape et résultat convenus avec le client documentés, compte rendu et justificatifs adaptés remis. |

L'équipe locale devra réévaluer ces seuils avec les premiers retours terrain, les horaires, les limites de chaque prestation et les justificatifs adaptés. Le fonctionnement de nuit, les week-ends et les attentes de tiers doivent être pris en compte dans le choix des délais. Le suivi automatique de ces seuils dépend de l'activation de la coordination sur l'offre ou la demande.

## Enregistrement et contrôle

Après déploiement, depuis `backend` dans Render, vérifier le plan en lecture seule :

```sh
NODE_ENV=production npm run data:configure-mali-offers
```

Puis appliquer les valeurs validées et la suspension de l'électricité en une seule transaction :

```sh
NODE_ENV=production npm run data:configure-mali-offers -- --apply
```

La commande retrouve les offres par leur code de définition et leur territoire national ; elle ne dépend pas de leurs identifiants numériques. Elle renseigne les délais et résultats manquants des sept offres et suspend l'électricité si cela n'a pas encore été fait. Elle ne crée aucune offre et ne réactive pas une offre fermée. Les prix, devises, justificatifs, horaires, règles de recherche et dossiers existants sont conservés. Les offres régionales et celles des autres pays restent inchangées. Une répétition après application ne produit aucune nouvelle modification.

Une offre absente ou ambiguë, ou un délai, résultat ou délai de coordination existant différent de la configuration validée, bloque toute écriture. Le résultat fournit les anomalies à traiter sans écraser une configuration locale. Une erreur pendant l'enregistrement annule toutes les modifications de cette opération.

Depuis le compte administrateur du Mali, ouvrir `/admin/operations`, puis « Organisation des services locaux » pour consulter ou ajuster ensuite les valeurs et les justificatifs appropriés. L'activation de la recherche automatique est un choix distinct ; elle nécessite des exécutants réellement disponibles.

Après configuration, relancer :

```sh
NODE_ENV=production npm run field:check -- --country=ML
```

La suspension de l'électricité retire cette offre des contrôles sur les offres ouvertes. Les sept offres restantes doivent toujours être configurées. La validation des notifications, de la restauration de sauvegarde, d'une prestation complète et de l'organisation locale reste nécessaire avant le lancement.
