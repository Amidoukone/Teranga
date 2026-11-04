# Commandes et paiements : agir dans le dossier

Lot local du 26 octobre 2026, après la recette par rôle. Les changements précédents sont conservés. Aucun commit, push ou déploiement dans ce lot.

## Organisation retenue

**La commande porte l'achat et sa réalisation. Son espace de paiement porte les écritures et leurs reçus. Le journal global permet de retrouver l'ensemble des écritures.**

Le regroupement concerne l'expérience utilisateur. Les modèles Order et Transaction, leurs identifiants, leurs permissions et leurs différences de statut sont conservés.

| Besoin | Parcours actuel |
| --- | --- |
| Suivre une commande | Commandes → Ouvrir la commande → réalisation, articles et justificatifs |
| Consulter un reçu | Dossier → Montants et paiements, avec les reçus affichés sur place |
| Saisir un paiement ou une dépense | Même section → Ajouter un paiement ou une dépense → formulaire → enregistrement sur place |
| Contrôler le règlement global d'une commande | Même section → Contrôle du règlement, réservé au responsable autorisé |
| Retrouver une écriture entre plusieurs dossiers | Mes paiements / Paiements et dépenses → journal et recherche |
| Examiner le bilan | Onglet Bilan du même espace global, par devise et statut |

Le détour par une page financière séparée, puis son bouton de retour au dossier, disparaît du parcours courant. Les anciennes pages financières restent compatibles pour les favoris et les anciens liens.

## Commandes

La liste propose une action principale par carte : ouvrir le dossier. Les montants, l'avancement et l'état du paiement restent visibles ; les identifiants internes et la répétition des informations du client sont retirés de la présentation courante. La suppression reste secondaire, réservée à l'administrateur global et soumise à confirmation.

La liste s'ouvre sans formulaire et sans charger le catalogue. « Nouvelle commande » ouvre un formulaire commun : choisir un article et sa quantité, ou décrire une commande personnalisée. La case supplémentaire « Ajouter un article » disparaît. Le client ne saisit plus un prix que le serveur remplaçait déjà par le prix du catalogue ; l'administrateur conserve son adaptation de prix dans les options. Une commande vide n'est pas envoyée sans article ni description. L'agent conserve la consultation et la réalisation, sans bouton de création que l'API lui refuse.

La recherche porte sur le code ou la description, selon le contrat serveur existant. Recherche, filtres, tri et pagination sont transmis au serveur et conservés dans l'URL. Le retour depuis un dossier conserve la liste d'origine. Une panne conserve les résultats et le brouillon du même contexte ; une révocation les retire. Les réponses d'un ancien compte, territoire ou filtre sont ignorées.

## Paiements intégrés

`DossierFinanceSection` intègre le journal commun aux commandes et aux projets. `RequestAmounts` utilise ce même espace dans les services classiques et les services prestataires accessibles au client. Le personnel autorisé retrouve également les écritures dans le service classique. Les prestataires ne reçoivent aucun droit financier supplémentaire ; les espaces limités aux étapes restent disponibles.

Le journal est chargé à l'ouverture de la section ou via son lien direct. Il vérifie le dossier auprès du serveur avant d'afficher ses écritures et ses commandes. Son titre de page, ses liens vers le dossier courant et ses boutons de retour ne sont pas répétés à l'intérieur du dossier. Une carte financière ne propose pas de rouvrir le dossier dans lequel elle est déjà affichée.

Le formulaire expose la nature, le montant, le moyen de paiement, la description et le reçu. La devise du dossier est indiquée ; ses modifications et les références complémentaires sont dans les options. Les filtres du journal sont repliés. Replier la section conserve le brouillon déjà ouvert. Les paramètres `paiements_*` isolent la recherche et la pagination du journal de celles du dossier et permettent de retrouver les résultats au rechargement.

Dans le dossier, le libellé courant « Paiement » remplace « Revenu » pour l'écriture de nature `revenue` ; son type stocké et les classifications du bilan global restent inchangés. Les montants utilisent le code de la devise, comme le journal. La section de pièces de commande est nommée « Justificatifs de réalisation » ; les reçus de paiement se consultent dans la section financière.

Les services n'affichent plus de ligne de prix convenu ou de reste à payer lorsque ces valeurs ne sont pas fournies. Aucun montant manquant n'est transformé en zéro et aucun reste à payer n'est calculé à partir d'une simple estimation.

Les justificatifs de réalisation d'une commande ne sont plus présentés deux fois dans une galerie puis dans une liste. Une seule liste conserve l'aperçu, l'ouverture du fichier, les notes, l'auteur et les droits de suppression. Les reçus financiers restent dans la section des paiements.

## Règles financières préservées

- Les paiements sont effectués hors de Teranga. Une saisie financière ne livre ni ne confirme un dossier.
- La confirmation administrative d'une commande payée envoie uniquement `paymentStatus: paid`. Elle conserve son avancement, y compris pour une commande historique sans coordination, et garde la synchronisation financière existante du serveur.
- Une nouvelle saisie de même nature sur une commande conserve l'unicité existante par commande, propriétaire et nature. Elle remplace le montant ; elle ne crée pas un nouvel acompte. Le formulaire l'indique.
- Les montants signés des projets et commandes, les devises distinctes, les justificatifs et les contrôles administratifs restent disponibles.
- Un client complète les informations et le reçu d'une écriture selon ses droits ; il ne transmet pas les champs financiers réservés à l'administrateur lors d'une modification.
- Les doubles soumissions de paiement, de création de commande et de confirmation du règlement sont protégées dans l'interface.

Aucune nouvelle API, migration, dépendance ou configuration. Les règles métier du backend ne sont pas modifiées.

## Validation

- **360 tests interface réussis dans 76 suites**, après adaptation du test du projet à son journal intégré, puis **21 tests ciblés réussis** sur le journal, la commande et les montants.
- **25 scénarios réels réussis dans un passage complet**, avec serveur local et MySQL isolé : création de commande, paiements dans les commandes et projets, contrôle administratif, accès limité à une étape, et parcours continus client–responsable–agent/prestataire avec consultation du reçu dans le dossier.
- **71 scénarios navigateur avec API simulée réussis**, puis **13 scénarios ciblés réussis** après harmonisation des libellés et de l'affichage des devises, et **7 scénarios ciblés réussis** après le dernier libellé « Paiement » du journal intégré. Ces rejeux ne constituent pas des scénarios distincts à additionner.
- ESLint interface, compilation de production et contrôle des espaces Git réussis.

Les premières exécutions ont permis de corriger les tests qui attendaient encore une page financière séparée. Un passage navigateur a aussi été interrompu après l'apparition de l'écran de compilation du serveur de développement pendant une modification ; seul le passage sur la version stabilisée est retenu pour le bilan final.

Les pièces réelles de recette utilisent le stockage local de test. Cette validation ne remplace pas la vérification de l'hébergement, des notifications externes et du stockage durable lors d'une publication.

## Repères et reprise

- Commandes : `frontend/src/features/orders/OrdersWorkspace.jsx`, export compatible depuis `pages/OrdersPage.js`.
- Journal intégré : `features/finance/DossierFinanceSection.jsx`, `FinancialWorkspace.jsx`, `useFinancialParams.js`.
- Formulaires et cartes communs : `TransactionForm.jsx`, `TransactionCard.jsx`.
- Recette ciblée : `frontend/e2e/payments-in-dossiers.spec.js` et `frontend/e2e-integration/financial-workspace.real.spec.js`.

Le dépôt contient également le lot précédent de recette par rôle, encore non commité. Le dernier commit reste `1cb0a6d`. Consulter `git status --short` et ce bilan avant la reprise ; ne pas interpréter l'état propre de la clôture précédente comme l'état actuel.
