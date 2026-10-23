# Lot 6 — Ouverture progressive d’un pays ou d’une région

## Premier pays visé : Côte d’Ivoire

Créer un brouillon « Côte d’Ivoire » avec ISO2 `CI`, devise `XOF`, langue `fr` et fuseau `Africa/Abidjan`. Reprendre les définitions du catalogue existant : leurs offres locales sont créées inactives tant que le pays est en préparation. Configurer et activer explicitement les services réellement disponibles, les responsables, les prix et les délais avant d'ouvrir le pays. La liste des régions de lancement et les contacts opérationnels restent à préciser.

## Création du pays

Dans « Pays & MASTER », renseigner le code ISO2, la devise ISO 4217, la langue par défaut et le fuseau IANA du pays d'exécution. Le pays est créé inactif : il n'apparaît pas dans la liste ordinaire des pays tant que l'équipe globale ne l'active pas. Ajouter ensuite les régions, l'opérateur local, les rôles et les disponibilités du catalogue avec leurs prix et délais propres. Une région peut définir son propre fuseau IANA ; sans cela, elle hérite du fuseau du pays dans la projection territoriale. La projection du catalogue refuse une devise manquante au lieu de supposer XOF. L'interface est actuellement traduite en français et en anglais : une autre langue peut être préparée, mais son pays ne peut pas être activé avant l'ajout de sa traduction.

La troisième étape de l'onboarding demande la raison sociale de l'opérateur principal et crée sa franchise `MASTER` avant le compte administrateur local. En cas d'échec de création du compte, relancer l'étape réutilise l'opérateur déjà créé. Une franchise principale inactive ou plusieurs franchises principales pour le même pays demandent une résolution manuelle.

À l'inscription, la langue du pays devient celle du nouveau compte si le client n'a pas choisi explicitement le français ou l'anglais. Un choix explicite du client reste prioritaire.

Les nouvelles demandes de service et les nouveaux projets prennent la devise du pays d'exécution si aucune devise n'a été envoyée. Les anciens flux commerce, immobilier et paiement ont encore des valeurs historiques à auditer avant une ouverture complète.

Les formulaires de création de services et de projets ne forcent plus XOF quand aucune devise n'est choisie. Les tâches héritent de la devise du service, ou du pays du bien lorsqu'elles sont liées uniquement à un bien. Les transactions héritent de leur service, tâche, commande ou projet ; sans lien, elles prennent la devise du pays résolu. Une devise explicitement renseignée reste prioritaire. La validation des transactions accepte les codes à trois lettres configurables pour les pays, même s'ils n'ont pas encore de libellé traduit (par exemple GHS ou GNF).

Dans les écrans de tâches et de transactions de service, « Devise du service » conserve cet héritage ; la devise du service est affichée quand elle est connue. La remise à zéro du formulaire conserve ce choix automatique. Les transactions générales et celles des projets et commandes proposent également la devise de l'opération par défaut. Modifier la devise d'un pays ne convertit ni ne réécrit les montants des services existants : leurs tâches et transactions continuent d'hériter de la devise enregistrée sur le service. Le bilan financier sélectionne une devise à la fois ; le détail d'un projet présente des bilans séparés par devise. Les créations de produits, commandes et annonces immobilières conservent encore des paramètres historiques à auditer séparément.

Projeter la gouvernance territoriale et le catalogue pendant que le pays est encore inactif. Le contrôle de préparation accepte ce pays en pré-ouverture et vérifie un opérateur principal unique, au moins une offre active appartenant à cet opérateur, un administrateur local, un agent et un prestataire actif du pays. Les agents et prestataires existants comptent même si leurs adhésions territoriales modernes ne sont pas encore projetées. L'API refuse l'activation du pays si ce contrôle signale un blocage. Avant d'activer le pays, vérifier les éléments ci-dessous et exécuter le contrôle de préparation. Après activation, contrôler au moins une demande de service avec la devise locale, une disponibilité de service dans la bonne région et les permissions d'un responsable local. Les données historiques restent inchangées ; les anciens pays sans fuseau doivent en recevoir un avant une réactivation.

Les offres limitées à une région active du pays peuvent satisfaire le contrôle de préparation. Les offres, affectations d'opérateurs et adhésions expirées ou futures ne comptent pas. Un pays peut être encore inactif pendant ce contrôle. L'activation ou la désactivation du pays met à jour le territoire utilisé par le catalogue dans la même transaction SQL ; une erreur de synchronisation annule également le changement du pays. Une modification du fuseau pays actualise les territoires des régions qui héritent de ce fuseau. Les modifications d'une région mettent à jour son territoire et son fuseau effectif. Les administrateurs nationaux peuvent consulter les offres nationales et régionales de leur pays.

Une création de service ou de projet refuse un pays ou une région inactifs ainsi qu'une région d'un autre pays. Changer le pays d'exécution ne conserve pas la région du client et ne sélectionne pas arbitrairement la première région. Le client peut consulter ses propres tâches et transactions d'une opération exécutée dans un autre pays ; cette relation ne lui donne pas accès aux opérations des autres clients. Les responsables locaux restent limités à leur périmètre, y compris pour les filtres de rapports, les créations de transactions et leurs déplacements.

Les clients du nouvel endpoint public `/api/v1/service-catalog` doivent envoyer `countryId` et, si besoin, `regionId`. Une région d'un autre pays, un pays inactif, un opérateur inactif et une offre hors de sa période de validité ne doivent pas apparaître. Ce catalogue est le nouveau référentiel local ; les écrans historiques qui utilisent encore les anciennes tables doivent être vérifiés séparément avant un lancement complet.

Dans l'assistant de mission connecté, le client choisit le pays où le service sera rendu avant de voir les catégories disponibles. Il peut préciser la région pour voir ses offres locales. Ce pays et cette région sont transmis au devis et à la création, y compris pour les services sans adresse. Si l'adresse géocodée indique un autre pays que celui choisi, ou une autre région reconnue que celle explicitement choisie, l'API refuse la demande et le client doit corriger son choix ou le lieu. Sans choix explicite de région, une filière limitée à une région conserve sa règle historique de routage. Vérifier le parcours avec un compte d'un autre pays avant d'ouvrir le pilote.

Changer le pays ou la région dans l'assistant efface le lieu précédemment choisi. La recherche d'adresse est limitée au pays sélectionné et la carte se centre sur le territoire avant la pose d'un repère. Après un déplacement du repère, vérifier dans la confirmation les coordonnées GPS affichées ; l'ancienne adresse et l'ancien lieu enregistré ne doivent plus être envoyés.

Pour un point posé directement sur la carte sans adresse, l'API vérifie le pays à partir des coordonnées avant d'établir le devis ou de créer la mission. Si cette vérification est indisponible, elle demande un lieu vérifiable au lieu de router la mission dans un pays supposé.

Lorsqu'un appel JSON, une recherche ou un formulaire multipart précise un autre pays que la sélection mémorisée, l'interface ne lui ajoute plus l'ancienne région. Les alias `country_id` et `region_id` ont la même priorité que `countryId` et `regionId`. Le calcul du devis n'hérite pas de la région du compte quand un autre pays est explicitement choisi ; une région explicitement nulle demande la tarification nationale. Si la lecture des tarifs échoue après résolution du pays, le devis manuel conserve sa devise locale.

Une projection répétée ajoute les offres absentes sans écraser les prix, délais, horaires ou activations locales déjà réglés. Si la devise d'un pays change, revoir et mettre à jour explicitement chacune de ses offres locales : aucune conversion automatique des prix n'est effectuée.

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

## Vérification des devises et des héritages territoriaux

Depuis `backend`, définir `$env:REQUIRE_INTEGRATION_DB = 'true'`, puis exécuter `npm.cmd test -- tests/integration/local-currency-flows.test.js tests/unit/localCurrency.controllers.test.js tests/unit/priceEstimate.service.test.js`. Ce mode strict exige une base MySQL de test accessible et vérifie réellement les créations de service, tâche, projet et transaction en GHS, une transaction explicitement en GNF et la conservation de la devise historique après changement de la devise du pays. Il crée puis supprime ses données de test. Sans ce mode, le scénario conserve le comportement historique de la CI : les assertions SQL ne s'exécutent pas si aucune base n'est accessible. Retirer ensuite la variable avec `Remove-Item Env:REQUIRE_INTEGRATION_DB`.

Depuis `frontend`, exécuter `npm.cmd test -- --runTestsByPath src/services/geo.test.js src/services/localCurrency.test.js src/pages/LocalCurrencyFlows.test.jsx`. Vérifier ensuite manuellement une demande depuis un compte d'un autre pays, une saisie de transaction en devise locale et un changement de pays après sélection d'une région. Ces contrôles complètent le contrôle de préparation et ne valent pas activation du pays.
