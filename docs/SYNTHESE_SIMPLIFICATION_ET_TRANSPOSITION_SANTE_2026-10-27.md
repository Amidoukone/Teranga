# Synthèse de la simplification de Teranga et principes transposables à la santé

## Principe directeur

**Un centre pour savoir quoi faire, un dossier pour agir, des étapes seulement lorsque le travail le nécessite.**

La refonte relie les espaces qui répétaient une partie du même parcours : accueil, activités, notifications, services, tâches, projets, commandes, justificatifs et finances. Elle simplifie les entrées et les actions tout en conservant les règles métier, les données et les droits propres à chaque activité.

## 1. Un centre des opérations commun

L’accueil connecté devient le point de départ du travail. Il comporte trois vues :

| Vue | Question traitée | Contenu |
| --- | --- | --- |
| À faire | Que dois-je traiter maintenant ? | Dossiers demandant une action de la personne connectée, avec la prochaine action et son motif. |
| À suivre | Qu’est-ce qui avance ou attend une autre personne ? | Travail en cours, personne responsable et attente expliquée. |
| Informations | Quelles nouveautés dois-je consulter ? | Notifications personnelles et historique de lecture. |

Les activités et notifications ont été rapprochées pour éviter de présenter plusieurs copies du même événement. Les étapes d’un dossier accessible sont regroupées sous sa carte. Un accès limité à une intervention reste limité : il n’ouvre pas les informations du dossier parent.

Le centre oriente vers le bon dossier et la bonne étape. La consultation ne change pas le travail. Lire un message, terminer une étape, confirmer un résultat et enregistrer un paiement restent des actions distinctes.

La file commune applique droits, regroupement, recherche, tri et pagination au serveur. Les compteurs décrivent l’ensemble autorisé et filtré. Le retour depuis un dossier conserve la vue, les filtres et la page.

## 2. Le dossier comme lieu de réalisation

Le dossier présente la référence, l’état, le responsable, la prochaine action, la réalisation, les justificatifs et les accès aux montants, à l’historique et à l’aide.

Un service simple peut recevoir directement un compte rendu et ses justificatifs. Aucune tâche artificielle n’est nécessaire. Les tâches utiles deviennent des étapes facultatives du dossier : responsabilité distincte, échéance, travail intermédiaire ou contrôle particulier. L’historique et les anciennes interventions restent accessibles.

Les justificatifs sont consultables et ajoutés dans leur contexte. Leur origine reste explicite : document initial, preuve d’étape, résultat final ou reçu financier. Une présentation commune n’efface pas leurs usages et leurs autorisations.

## 3. Des espaces cohérents selon le rôle

| Rôle Teranga | Accueil | Organisation du travail |
| --- | --- | --- |
| Client | Mon suivi | Mes demandes réunit services, projets et commandes ; création adaptée au type ; accès direct à Mes biens. |
| Agent | Mon travail | Services confiés pour réaliser et missions supervisées pour suivre les prestataires. |
| Prestataire | Mon activité | Disponibilité au centre ; Mes interventions réunit offres, travail en cours et historique. |
| Responsable | Pilotage | Coordination au centre et outils spécialisés regroupés dans Gestion. |

Les boutons suivent les capacités de l’utilisateur. Un superviseur n’obtient pas les commandes de l’exécutant. Le territoire et les contrôles serveur restent appliqués.

## 4. Des parcours continus

- Catalogue et fiche produit utilisent le même formulaire de commande ; la demande créée ouvre directement son dossier.
- Projets : liste commune, création simple, phases et documents dans le dossier, gestion secondaire dans son contexte.
- Biens : fiche centrale avec documents, demandes et historique ; une intervention créée depuis le bien reprend ses informations connues.
- Finances : journal et formulaire communs, accessibles depuis les dossiers ; bilan et export disponibles selon les droits.
- Prestataire : offre, acceptation ou refus, réalisation, compte rendu, justificatifs et historique s’enchaînent avec des retours conservés.
- Taxi et livraison gardent leurs outils spécifiques, notamment les contrôles de départ, de collecte et de remise.

## 5. Actions et présentations retirées ou regroupées

- Plusieurs points d’entrée concurrents vers le même suivi ont été réunis.
- Les formulaires financiers répétés ont été remplacés par des composants communs.
- La création d’une tâche pour déposer le résultat d’un service simple a été évitée.
- Les justificatifs sont accessibles dans le dossier ou l’étape concernés, sans imposer une succession de pages.
- Les formulaires secondaires sont fermés par défaut et les options avancées dépliables.
- Les informations déjà connues du contexte sont reprises lorsque le parcours le permet.
- Les accès de modification, d’affectation et de réalisation sont placés dans leur contexte et selon le rôle.
- Les filtres ne sont plus à reconstruire au retour d’un dossier dans les parcours refondus.
- La barre supérieure retire les répétitions du rôle, du nom et de la page active ; territoire, informations et compte disposent d’accès clairs.

Les contrôles utiles, les confirmations nécessaires et les particularités métier sont conservés. Un cadre d’interface commun ne nécessite pas de fusionner toutes les tables ni tous les statuts.

## 6. Qualité de l’expérience et fiabilité

La hiérarchie des écrans privilégie une action principale par contexte. La navigation reste cohérente sur ordinateur et mobile. La barre supérieure regroupe compte, langue, sécurité et aide ; les panneaux gèrent clavier, fermeture et petits écrans.

Les réponses tardives d’un ancien compte ou dossier sont ignorées. Les données déjà chargées et les brouillons sont conservés lors des interruptions lorsque le parcours le prévoit. Une panne ne devient pas une fausse absence de travail. Une révocation retire les données concernées. Les doubles soumissions sont empêchées dans les parcours protégés, sans prétendre ajouter une garantie serveur universelle.

Les lots ont été vérifiés par tests backend, interface, navigateur simulé et parcours locaux avec serveur réel. Le dernier lot de barre supérieure a validé 422 tests interface, 37 scénarios navigateur, quatre parcours avec les comptes locaux de Côte d’Ivoire, le lint et la compilation. Ces nombres décrivent ce lot, sans additionner les passages antérieurs. Les changements récents restent locaux, non commités et non déployés. Les bénéfices d’usage doivent encore être confirmés avec les utilisateurs et les appareils physiques.

## 7. Transposition possible dans une application de santé

Cette correspondance est une proposition à confronter aux rôles, aux données et aux parcours de l’autre application ; elle n’affirme pas que ces modules y existent.

| Principe Teranga | Application possible en santé |
| --- | --- |
| Centre des opérations | Accueil de travail adapté au patient, au soignant, à l’accueil ou au responsable, selon les rôles existants. |
| À faire / À suivre / Informations | Actions autorisées attendues de l’utilisateur, prises en charge suivies et nouveautés personnelles. |
| Dossier de demande | Consultation, demande d’examen ou épisode de prise en charge avec sa prochaine action. |
| Étapes facultatives | Actes, examens ou validations nécessaires à ce parcours, avec responsables et règles propres. |
| Justificatifs contextualisés | Documents, résultats et comptes rendus rattachés au bon épisode et à leur auteur. |
| Mes demandes | Suivi personnel des rendez-vous et demandes, si leurs contrats permettent une présentation commune. |
| Gestion | Organisation des équipes, des établissements et des outils autorisés. |
| Finances séparées | Facturation et règlements suivis sans modifier implicitement l’avancement clinique. |

Le dossier patient longitudinal reste le contexte de référence. Une consultation ou une demande d’examen a son propre cycle de vie ; la terminer ne clôture pas le dossier patient.

La lecture d’un résultat ne vaut pas validation médicale. Une étape administrative ne vaut pas acte réalisé. Les règles de priorité, les validations professionnelles, la confidentialité, les responsabilités et la traçabilité existantes doivent être identifiées avant de modifier les parcours. Les documents utiles au patient et les informations réservées aux professionnels ne deviennent pas visibles à tous du fait d’une nouvelle vue commune.

## Brief réutilisable

> Analyse cette application de santé pour simplifier et unifier ses parcours selon les rôles. Commence par examiner le code, les écrans, les modèles, les droits et les règles métier existantes. Identifie les points d’entrée concurrents, formulaires répétés, ressaisies et actions sans valeur utile.
>
> Propose un centre des opérations avec À faire, À suivre et Informations, adapté aux rôles réels de l’application. Chaque entrée doit expliquer la prochaine action ou l’attente et ouvrir le bon dossier. Définis ce qui constitue le dossier de travail — consultation, examen ou épisode — en conservant le dossier patient longitudinal comme contexte.
>
> Regroupe actions, étapes utiles, documents, résultats, comptes rendus et historique dans leur contexte. Rends les étapes facultatives lorsque le métier le permet. Simplifie les formulaires et la navigation mobile, conserve les filtres et les retours, et garde facturation, lecture d’informations et avancement clinique distincts.
>
> Préserve les validations médicales, les priorités définies, les responsabilités, la confidentialité, les droits et la traçabilité. Distingue les changements de présentation des changements métier à décider explicitement. Produis un état des lieux, une organisation cible, une liste précise de ce qui est conservé, fusionné ou retiré, puis un plan de mise en œuvre progressif avec validation de chaque rôle et des parcours complets.

## Sources locales

- [Conception de l’unification](REFONTE_UNIFICATION_2026-10-24.md), proposition initiale.
- [File commune du centre des opérations](FILE_COMMUNE_OPERATIONS_2026-10-24.md).
- [Dossier service, étapes et justificatifs](DOSSIER_SERVICE_ETAPES_2026-10-24.md).
- [Mes demandes unifiées](MES_DEMANDES_UNIFIEES_2026-10-26.md).
- [Paiements et dépenses](ESPACES_FINANCIERS_2026-10-26.md).
- [Projets et biens](PROJETS_BIENS_SIMPLIFIES_2026-10-26.md).
- [Espace prestataire](ESPACE_PRESTATAIRE_UNIFIE_2026-10-27.md).
- [Vues selon le rôle](VUES_PAR_ROLE_SIMPLIFIEES_2026-10-27.md).
- [Barre supérieure](TOPBAR_SIMPLIFIEE_2026-10-27.md).
