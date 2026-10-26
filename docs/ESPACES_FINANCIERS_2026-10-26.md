# Paiements et dépenses : un espace commun

Lot local du 26 octobre 2026, après l'accueil connecté commun. Le centre indique le travail à faire ; les dossiers portent la réalisation ; le journal commun porte les écritures financières et leurs reçus.

## Constat et choix

Les pages Transactions, Transactions d'un service et Transactions d'une commande répétaient formulaires, historiques et présentation des justificatifs. Le projet avait un quatrième formulaire intégré. Plusieurs de ces listes filtraient et paginaient localement une première page reçue de l'API. Le bilan financier présentait beaucoup d'indicateurs et une autre liste des mêmes écritures.

Un seul ensemble de composants remplace ces variantes : `FinancialWorkspace`, `TransactionForm`, `TransactionCard` et `FinancialStatement`. Les modèles et contrôles serveur existants sont conservés. Une écriture, un justificatif de réalisation, un règlement, une livraison et une confirmation de résultat restent des notions distinctes.

## Parcours

| Entrée | Comportement |
| --- | --- |
| `/transactions` | Journal commun, intitulé « Mes paiements » pour le client, « Paiements et dépenses » pour le personnel |
| `/transactions?vue=bilan` | Bilan chargé à la demande, une devise à la fois, avec statuts et export CSV |
| `/finance` | Ancien favori redirigé vers le bilan commun, paramètres conservés |
| `/services/:id/transactions` | Journal du service, dossier vérifié avant affichage du formulaire |
| `/orders/:id/transactions` | Même journal et formulaire, liés à la commande |
| `/projects/:id/transactions` | Même journal et formulaire, liés au projet |
| `/transactions?taskId=:id` | Journal limité à l'étape ou à l'intervention autorisée |

La navigation agent et les outils de Gestion proposent une seule entrée financière. Le résumé compact de Gestion reste disponible à la demande ; son lien ouvre le bilan commun. Le projet conserve son budget et ses totaux par devise, puis ouvre le journal commun pour consulter ou saisir une écriture. Son formulaire et son tableau de transactions propres ont été retirés.

L'historique vient en premier. Le formulaire est fermé par défaut et s'ouvre avec « Enregistrer une opération ». Les cartes exposent montant, devise, statut, description, moyen de paiement, auteur, dossier et reçu. Un administrateur peut modifier ou contrôler une écriture ; les autres utilisateurs autorisés complètent les informations et le justificatif sans soumettre les champs financiers réservés. La suppression reste réservée à l'administrateur global, avec confirmation.

Les liens vers un dossier conservent la provenance du journal, sa recherche et sa pagination. Le retour depuis un dossier financier est nommé explicitement. Les étapes et interventions autonomes disposent elles aussi d'un accès à leurs frais et règlements.

## Droits et règles conservés

- Les contrôles d'accès et de territoire restent appliqués par les API existantes. Le prestataire ne reçoit pas d'accès financier supplémentaire.
- Le client consulte le journal d'un service ou d'un projet ; la saisie contextuelle reste réservée au personnel prévu par ces parcours. L'agent chargé du projet conserve sa saisie. Le client conserve l'enregistrement lié à sa commande et le parcours général existant.
- Le dossier fournit la devise par défaut. La sélection géographique de navigation n'impose pas sa région à une écriture d'un autre dossier autorisé. Les références complémentaires restent facultatives et sont contrôlées au serveur.
- Les montants décimaux sont envoyés comme chaînes normalisées, y compris la virgule française. Les montants signés des parcours projets/commandes et les ajustements restent possibles ; la refonte n'impose pas une nouvelle règle métier sur ces valeurs.
- Pour une commande, l'unicité historique par commande, propriétaire et nature reste appliquée : une nouvelle saisie de même nature remplace le montant, elle n'ajoute pas un acompte. Le formulaire l'indique.
- Les statuts restent attribués par les règles serveur existantes. Les clôtures manuelles nécessitant un reçu conservent cette obligation. Une écriture enregistrée ne marque pas automatiquement la commande comme payée et ne termine aucun travail.
- Un agent autorisé sur une étape seule peut ouvrir son journal sans lecture du service parent. Les anciens liens service + étape basculent vers l'espace limité après vérification que l'étape autorisée appartient bien au service demandé. Une création sur une étape conserve son lien au service lorsqu'il existe ; le journal limité présente les références de l'étape.

## Listes, bilan et interruption

Le journal utilise recherche, statut, nature, devise, dates, tri et pagination au serveur, vingt écritures par page. Les critères restent dans l'URL. Il ne charge plus tous les services pour afficher un formulaire fermé.

Le bilan utilise toutes les pages autorisées via `getAllTransactions`, y compris au-delà de 200 écritures. Il conserve un filtre de devise et un filtre de statut explicites ; le solde est celui des écritures sélectionnées, jamais un calcul de reste à payer. Une devise demandée sans écriture ne bascule pas silencieusement vers une autre. Les filtres principaux restent dans l'URL ; les filtres de rôle et de rattachement complètent l'analyse détaillée. L'export CSV reprend les lignes filtrées, avec devise, statut et références ; les textes pouvant être interprétés comme formules de tableur sont neutralisés.

Une panne de lecture ne devient pas une liste vide valide. Les écritures déjà chargées et le brouillon du même contexte sont conservés lors d'une panne du journal. Une révocation retire les données et le formulaire. Les réponses tardives d'un ancien compte, dossier, territoire ou filtre sont ignorées. Les montants du bilan ne sont pas présentés comme complets si leur chargement échoue.

La saisie, le justificatif et la requête de modification sont protégés contre les doubles soumissions. Effacer une description ou un moyen de paiement transmet désormais explicitement cette modification. Le téléchargement de justificatifs garde la compatibilité des anciens formats de métadonnées et des chemins locaux/CDN.

## Validation

- Suite complète interface : **351 tests réussis dans 75 suites**. Après le dernier ajustement de compatibilité des montants signés, la suite ciblée du journal a été rejouée.
- Navigateur : **64 scénarios réussis dans 14 fichiers**, dont sept scénarios financiers ; téléphone 360 px et ordinateur 1440 px, pagination, recherche au-delà de la première page, bilan au-delà de 200 écritures, devises, statuts, export, formulaires communs, interruption, accès limité à une étape et retours aux dossiers.
- Serveur réel et MySQL isolé : **quatre scénarios financiers distincts réussis**, lors des exécutions et rejeux ciblés : reçu de service visible par le client sans terminer le service ; écriture de projet avec sa devise et contrôle du statut séparé de son avancement ; saisie répétée d'une commande sans doublon ni marquage payé ; agent autorisé uniquement sur une étape avec conservation de cet accès limité.
- ESLint et compilation de production réussis. Captures des vues sur téléphone et ordinateur vérifiées. Contrôle des espaces Git réussi en tenant compte des fichiers CRLF du dépôt.

Le backend n'a pas été modifié dans ce lot ; les modifications backend locales des lots précédents ont été conservées. Son dernier passage complet documenté reste celui de **567 tests**. Les scénarios réels de ce lot utilisent ses API existantes. Les reçus de recette ont été vérifiés avec le stockage local de test ; cela ne valide pas le stockage de production.

Commandes principales depuis `frontend` :

```powershell
npm.cmd test -- --silent
npm.cmd test -- --runTestsByPath src/features/finance/FinancialWorkspace.test.jsx --silent
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test --workers=2
npx.cmd playwright test e2e-integration/financial-workspace.real.spec.js --config=playwright.integration.config.js --workers=1
```

## État et suite

Changements locaux et non commités, ajoutés aux lots navigation, dossiers et accueil déjà présents. Aucun push ni déploiement effectué. Aucune migration, dépendance ou variable d'environnement ajoutée.

**Clôture du 26 octobre :** ce lot est inclus avec les trois lots précédents dans le commit local demandé par l'utilisateur. Le [résumé complet de reprise](REPRISE_SESSION_2026-10-26.md) fait foi pour l'état de clôture ; aucun push ni déploiement.

La prochaine étape proposée est une recette utilisateur complète de la version de démonstration, par rôle : demande, coordination, réalisation, justificatifs, enregistrement financier et confirmation finale. Elle permettra d'identifier les derniers libellés et clics superflus avant une éventuelle publication, qui reste à décider séparément.
