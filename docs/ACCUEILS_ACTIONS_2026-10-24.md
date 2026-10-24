# Accueils et actions principales — deuxième étape

Ce lot prolonge la [fusion du centre des opérations](FUSION_CENTRE_OPERATIONS_2026-10-24.md). Il simplifie les accueils client, agent, prestataire et responsable. Les affectations, transitions métier, justificatifs et validations restent contrôlés par les API existantes.

## Ce que voit l’utilisateur

| Rôle | Priorité de l’accueil | Accès secondaires |
| --- | --- | --- |
| Client | Vérifier les résultats remis avant de créer une nouvelle demande, lorsqu’une réponse est attendue. Trois résultats à vérifier et quatre demandes en cours au maximum dans l’aperçu. | Liste complète des résultats, toutes les demandes, taxi, livraison ; dossiers et paiements dans un panneau secondaire. |
| Agent | Disponibilité explicite, interventions en cours et prochaine action concrète : commencer ou préparer la remise au client. | Historique, détail du dossier et coordonnées du client ; missions supervisées accessibles séparément. |
| Prestataire | Propositions à accepter, puis interventions à poursuivre. Chaque carte comporte un lien d’action explicite. | Historique, disponibilité et choix du véhicule ; le compte rendu reste accessible après remise. |
| Responsable | Traiter les demandes depuis le centre commun. Les opérations taxi et livraison restent accessibles directement. | Équipe et dossiers regroupés ; chiffres du territoire et finances chargés seulement à l’ouverture du panneau correspondant. |

Les quatre espaces partagent une présentation d’accueil, un accès à l’aide et un accès au centre des opérations. Le responsable y accède par son action principale. La navigation nomme désormais la page « Accueil ».

Les boutons qui ouvraient deux fois le même dossier sont réduits. Les contacts des clients sont placés derrière une action explicite. Les réglages de disponibilité, les exigences de compte rendu et les justificatifs restent disponibles.

## Fiabilité et cohérence

- Les nouveaux filtres facultatifs `view=review|ongoing|all` de `GET /services/me` sont appliqués avant comptage et pagination. Un ancien résultat à vérifier reste donc visible même derrière plus de 100 nouvelles demandes.
- Le statut de mission prime sur le statut historique du service : une mission annulée dont l’ancien statut vaut encore `completed` n’est pas proposée à la validation du client.
- Le lien « Voir les résultats à vérifier » ouvre `/demandes?vue=a-verifier`, avec le même filtre serveur et la pagination existante. Les autres accès à la liste conservent leur comportement.
- Les résultats de l’accueil client sont séparés par utilisateur et périmètre sélectionné. Une réponse tardive d’un ancien compte ou périmètre est ignorée. Une actualisation échouée conserve les données déjà chargées dans le même périmètre ; une révocation d’accès les retire.
- Une panne du résumé financier ne bloque pas le centre des opérations. Une panne du profil de disponibilité d’un prestataire ne le renvoie plus à la connexion et laisse ses interventions accessibles.
- La page prestataire réutilise le compte vérifié par l’accueil. Les soumissions d’offres et de disponibilité possèdent un verrou contre les doubles clics.

Aucune migration, nouvelle dépendance ou variable d’environnement n’est ajoutée. Le backend doit être publié avant l’interface correspondante pour que les aperçus utilisent les nouveaux filtres.

## Vérifications

- 526 tests backend réussis, dont une recette MySQL avec plus de 100 demandes récentes, un résultat ancien à vérifier, des statuts de mission différents des anciens statuts, les limites de pagination et l’isolement des comptes.
- 208 tests interface réussis, dont les priorités de l’accueil, l’accès à la liste complète, les erreurs partielles, les réponses tardives et le maintien des interventions lors d’une panne du profil prestataire.
- 15 scénarios Chromium avec API simulées réussis : accueils sur mobile et ordinateur, disponibilité, historique, panne financière, centre commun et reprise après interruption.
- 9 scénarios Chromium avec vrai serveur et MySQL réussis, dont le parcours agent → justificatifs consultables → remise → validation client sur mobile.
- Captures des accueils client et responsable sur petit écran examinées ; absence de débordement horizontal vérifiée dans les scénarios concernés.
- Contrôles du code frontend et backend, compilation de production et recherche de secrets Gitleaks réussis.

Les modifications des deux premières étapes sont conservées localement, sans commit ni déploiement de ce lot. Les autres écrans détaillés n’ont pas encore fait l’objet de la même refonte : la prochaine étape cohérente est de simplifier la liste des demandes et leurs dossiers, en conservant les validations et les preuves.
