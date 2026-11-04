# Vues par rôle simplifiées — 27 octobre 2026

Lot local réalisé avant la recette physique. Il complète [Mes demandes](MES_DEMANDES_UNIFIEES_2026-10-26.md), [l’espace prestataire](ESPACE_PRESTATAIRE_UNIFIE_2026-10-27.md) et [la cohérence transport](COHERENCE_TRANSPORT_2026-10-27.md).

## Organisation retenue

Le centre conserve les trois vues communes **À faire / À suivre / Informations**. Son titre et sa consigne indiquent ce que chaque rôle vient y faire. Le menu utilise le libellé court **Accueil** ; le raccourci des informations porte son propre nom.

| Rôle | Accueil | Accès au travail |
| --- | --- | --- |
| Client | Mon suivi | Mes demandes, création, résultats à vérifier et justificatifs dans le dossier. |
| Agent | Mon travail | Services confiés pour réaliser ; Missions supervisées pour suivre les prestataires. |
| Prestataire | Mon activité | Disponibilité, puis Mes interventions avec offres, travail en cours et historique. |
| Responsable | Pilotage | Dossiers à coordonner et Gestion pour les outils spécialisés. |

Les administrateurs de pays/région conservent leurs restrictions territoriales. Les outils réservés à l’administration globale restent filtrés.

## Changements de présentation

- Suppression du grand panneau décoratif autour des vues de travail. Les cartes de dossiers portent la hiérarchie ; les titres secondaires et les libellés de champs sont plus sobres.
- Recherche et choix du type réunis dans une barre compacte commune au centre, à Mes demandes et à Mes interventions. Les noms accessibles des champs restent explicites, y compris lorsque leurs étiquettes sont masquées visuellement sur petit écran.
- Onglets alignés sur une même rangée. Actions tactiles principales d’au moins 44 pixels ; filtres, pagination et contexte de retour conservés.
- Disponibilité agent/prestataire plus compacte : statut court près du titre, bouton visible et options secondaires dépliables. Sur ordinateur, elle occupe une colonne à côté de la file de travail.
- Accès administratif principal réduit à Accueil et Gestion. Taxi et livraison restent directement accessibles depuis les deux cartes de transport de Gestion.
- Les six catégories d’outils de gestion s’ouvrent séparément. Le résumé opérationnel et les montants restent chargés à la demande.
- Retours de dossier nommés selon leur destination : accueil, demandes, services confiés, missions supervisées ou interventions du prestataire.

Les services, projets, commandes et interventions partagent cette présentation. Leurs modèles, statuts, justificatifs et droits restent distincts. Paiements et avancement du travail restent séparés.

## Corrections fonctionnelles liées aux rôles

La liste des missions supervisées présentait des boutons d’acceptation d’offre à l’agent. Ils sont désormais réservés au prestataire. L’agent dispose de l’action **Superviser le dossier** ; les boutons de réalisation du suivi restent conditionnés par la qualité d’exécutant renvoyée par le serveur.

Un autre décalage concernait les liens taxi/livraison de l’agent : ils pouvaient ouvrir des routes réservées aux clients et prestataires. Le résolveur commun dirige désormais l’agent vers `/missions/:id/track`, déjà autorisée pour la supervision. Les routes client/prestataire et les autorisations serveur ne sont pas élargies.

Le contrôle mobile a également révélé que le panneau de disponibilité pouvait masquer le premier bouton de travail derrière le menu fixe. Le statut a été raccourci et regroupé avec le titre. La recette vérifie explicitement que le bouton du premier dossier de référence se trouve au-dessus de ce menu sur un écran de 360 × 900 pixels.

## Validation

- **Interface : 410 tests réussis dans 81 suites**, puis **18 tests de navigation réussis** après le dernier ajustement du libellé de contexte. Un passage intermédiaire sous charge avait dépassé l’attente d’un sélecteur asynchrone de projet ; le dernier passage complet réussit sans modification de ce test.
- **Navigateur simulé : 100 scénarios distincts couverts avec succès.** Le passage complet a réussi pour 98 scénarios. Les deux autres attendaient encore « Retour aux services » alors que le lien vers le centre porte désormais « Retour à l’accueil ». Après correction de cette attente, **22 scénarios ciblés ont tous réussi** : navigation, vues par rôle et file de travail, dont les deux retours concernés avec filtres conservés. Il ne s’agit pas d’un passage unique de 100 scénarios tous réussis.
- Les nouveaux contrôles couvrent les quatre rôles en **360 et 1440 pixels**, le bouton de travail au-dessus du menu mobile, l’absence de débordement horizontal, les noms accessibles des filtres, le panneau latéral de disponibilité sur ordinateur, la supervision sans écriture et le thème sombre.
- **Navigateur avec serveur et MySQL réels : sept scénarios réussis en un passage.** Gestion sans lecture financière inutile ; disponibilité agent sans changement de capacité ; parcours complets agent et prestataire avec demande, affectation, réalisation, justificatif, règlement et confirmation ; taxi avec code de départ ; livraison avec justificatif et montant déclaré distinct des paiements ; refus avec retour aux filtres et accès retiré.
- **ESLint, compilation de production et contrôle des espaces Git réussis** après les derniers ajustements. L’avertissement existant sur l’âge des données Browserslist reste présent.
- Le backend n’est pas modifié par ce lot d’interface : son dernier passage complet reste celui du lot transport, **598 tests dans 86 suites**. La recette réelle ci-dessus vérifie son intégration avec les nouvelles vues.

Les captures et journaux locaux sont conservés dans `artifacts/role-views-*`, ignoré par Git. Les captures de navigateur couvrent des fenêtres téléphone/ordinateur, pas des appareils physiques.

Exemples inspectés : [accueil agent sur téléphone](../artifacts/role-views-browser-replay/role-views-agent-primary-w-2ac13-isible-immediately-at-360px-chromium/home.png), [accueil prestataire sur ordinateur](../artifacts/role-views-browser-replay/role-views-provider-primar-c9453-sible-immediately-at-1440px-chromium/home.png) et [prestataire en thème sombre](../artifacts/role-views-browser-replay/role-views-compact-provide-ce868-ble-in-dark-mode-on-a-phone-chromium/provider-dark.png). Les accueils client/responsable, les offres et les dossiers issus de la recette réelle ont également été inspectés.

## État et suite

Aucune migration, dépendance ou configuration applicative nouvelle. Ce lot porte sur l’interface et son routage ; les changements backend déjà présents appartiennent aux lots précédents.

Les sept parcours avec serveur réel utilisent une base MySQL locale isolée. Les clés de cartographie et le stockage hébergé ne sont pas configurés dans cette recette. Elle ne mesure donc ni la précision du GPS en déplacement ni la réception de notifications sur des téléphones réels.

Les serveurs temporaires et le conteneur MySQL de recette ont été arrêtés après les vérifications.

Les changements restent locaux, sans commit, push ni déploiement. L’étape suivante est une revue des vues avec les personnes de chaque rôle, puis la recette physique : disponibilité, réception d’offre, déplacement, justificatif, confirmation et paiement suivi séparément.
