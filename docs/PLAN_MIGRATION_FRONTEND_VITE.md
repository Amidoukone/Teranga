# Plan de migration frontend : CRA vers Vite

## Objectif

Retirer Create React App de la chaîne frontend pour réduire la dépendance à un outillage vieillissant, sans changer les parcours métier, les contrats d’API ni le comportement de publication.

## État vérifié le 9 novembre 2026

- Application React 19, React Router 7, JavaScript et JSX, actuellement compilée et testée par `react-scripts` 5.
- 84 fichiers de tests frontend utilisent Jest et les APIs `jest.mock`/`jest.fn`.
- 21 variables `REACT_APP_*` sont lues dans le code source. Elles couvrent les API, l’authentification, la télémétrie, Maps et plusieurs délais d’attente/polling.
- `frontend/playwright.config.js` lance `npm run start`; `playwright.integration.config.js` démarre directement `node_modules/react-scripts/scripts/start.js`. Le deuxième chemin doit être remplacé, pas oublié.
- `public/index.html` utilise `%PUBLIC_URL%` pour les icônes et le manifeste PWA.
- `src/index.js` enregistre `public/sw.js` uniquement en production, avec une portée `/`.
- Tailwind et PostCSS ont leurs propres configurations. Le lint utilise ESLint avec les presets `react-app` et `react-app/jest`.
- Vérification avant migration : 84 suites/444 tests frontend réussis, lint réussi, build de production réussi, Playwright de navigation réussi.
- `npm audit --omit=dev` rapporte zéro vulnérabilité après correction et reclassement des dépendances. Les vulnérabilités restantes concernent l’arbre de développement CRA/Jest, dont trois critiques.

## Principes de compatibilité

1. Garder React, les routes, les APIs, les traductions, les styles et le service worker identiques pendant le remplacement du serveur/build.
2. Migrer le runner de tests séparément. Ne pas convertir les 84 suites Jest dans le même changement que le build.
3. Ne jamais exposer `REACT_APP_OBSERVABILITY_TOKEN` au navigateur comme secret : toute valeur compilée côté client est publique. Vérifier son usage et sa politique avant de définir les variables Vite.
4. Préserver la publication à la racine du domaine et la réécriture SPA pour les routes profondes.
5. Garder un point de comparaison reproductible : suites unitaires, lint, build, e2e navigation, e2e authentification et recette d’intégration.

## Étapes proposées

### Étape 0 — Préparer et inventorier (ce document)

- Cartographier variables d’environnement, points d’entrée, assets publics, PWA, scripts et commandes Playwright.
- Confirmer quelles variables sont effectivement utilisées dans le navigateur, notamment les clés d’observabilité.
- Sauvegarder les résultats de référence déjà obtenus avant migration.

### Étape 1 — Remplacer le serveur et le build, conserver Jest

- Ajouter Vite et un `vite.config` explicite avec React, alias si nécessaires, port/proxy et variables publiques autorisées.
- Convertir `public/index.html` au format Vite et vérifier favicon, manifest, `base: '/'` et URLs du service worker.
- Remplacer les scripts `start` et `build`; remplacer les deux lancements CRA des configs Playwright par le serveur Vite.
- Conserver temporairement Jest, ses mocks et `setupTests.js`. Ajouter une configuration Jest explicite uniquement si la suppression de `react-scripts` l’exige ; ne pas réécrire les tests maintenant.
- Déplacer `react-scripts` hors du graphe de build une fois que les scripts et les configs n’en dépendent plus.

### Étape 2 — Basculer les variables d’environnement

- Introduire un module de configuration frontend validant et centralisant les variables publiques.
- Renommer progressivement les variables consommées en `VITE_*` dans les exemples, les configs Playwright et les environnements de déploiement.
- Rechercher toute lecture résiduelle de `process.env` et tout secret accidentellement inclus au build.

### Étape 3 — Migrer Jest vers Vitest (chantier séparé)

- Comparer les APIs de mocks et les modules ESM avant conversion.
- Migrer par familles de tests avec une validation continue des 84 suites.
- Retirer Jest et Babel CRA après couverture complète, puis refaire les audits npm.

## Critères d’acceptation

- Installation propre depuis le lockfile et commandes documentées reproductibles.
- Tests frontend complets, lint et build verts.
- Les deux configs Playwright fonctionnent sans `react-scripts`.
- Scénarios e2e de navigation, authentification, PWA et routes profondes verts.
- Le build fonctionne à la racine du domaine, sert correctement `/sw.js`, les icônes et le manifest.
- Aucune valeur sensible côté serveur n’est incorporée au bundle.
- Audit npm production reste à zéro vulnérabilité ; l’arbre de développement n’inclut plus CRA.

## Risques à traiter explicitement

- Le chemin serveur codé en dur dans `playwright.integration.config.js` contournerait Vite même si `npm start` est remplacé.
- CRA remplace automatiquement les variables et placeholders HTML ; Vite ne le fait pas avec les mêmes noms.
- Le service worker peut mettre en cache d’anciens chunks après déploiement. Le comportement de mise à jour doit être testé avant d’activer le nouveau build.
- Le reclassement de `react-scripts` en dev dépend de l’installation des dépendances de développement dans l’environnement de build ; le pipeline de publication doit être vérifié.
- Vite/Vitest n’est pas un remplacement transparent de Jest pour 84 suites qui utilisent le mocking Jest.

## Prochaine unité de travail

Étape 1, sous forme d’un changement isolé : ajouter Vite, mettre en place un point d’entrée HTML compatible et remplacer uniquement `start`/`build` et les deux serveurs Playwright. Garder Jest et les noms d’environnement CRA au moyen d’une couche de compatibilité temporaire. Lancer les validations avant de supprimer les dépendances CRA.

## Point d'avancement du 10 novembre 2026

L'étape 1 est en cours avec les deux parcours CRA et Vite disponibles en parallèle. Vite 7.3.6 et son plugin React 5.0.0 sont installés. Les commandes `start:vite`, `build:vite`, `preview:vite`, `e2e:vite` et `e2e:integration:vite` ont été ajoutées. Le staging garde `public/index.html` comme source canonique, copie les assets publics sans l'HTML CRA et refuse d'écraser un fichier d'entrée non reconnu. Vite respecte maintenant la variable `PORT`, y compris le port d'intégration Playwright.

CRA accepte le JSX dans des fichiers `.js`, contrairement au traitement Vite par défaut. Le point d'entrée est passé à `src/index.jsx`, une extension résolue par CRA, et une compatibilité Vite limitée à `src/**/*.js` traite le JSX restant. Les builds de production CRA (`npm run build`) et Vite (`npm run build:vite`) ont réussi. L'import Google Fonts a été placé avant les directives Tailwind pour éviter le rejet de la règle par PostCSS.

Le build Vite produit des chunks par page, mais son chunk d'entrée atteint environ 960 Ko avant gzip (293 Ko gzip); CRA affiche environ 299 Ko gzip pour son entrée. Les données Browserslist sont également anciennes de 13 mois. Les parcours Playwright sous Vite, les ressources PWA et les environnements de déploiement restent à valider avant de basculer les commandes par défaut ou de retirer CRA.

Prochaine unité : exécuter d'abord les tests Playwright de navigation avec Vite, puis les parcours d'intégration et les vérifications PWA avec le backend de test. Garder les scripts CRA comme retour arrière et vérifier les variables réelles de déploiement avant toute bascule.

## Résultats de validation du 10 novembre 2026

- `npm run build` (CRA) et `npm run build:vite` réussissent. Le build Vite transforme 2 386 modules. Il reste l'avertissement de chunk principal à 960,53 Ko (293,31 Ko gzip) et celui de Browserslist âgé de 13 mois.
- `npm run e2e:vite` réussit avec 119/119 scénarios et deux workers. Le scénario de territoire obsolète a été ajusté pour ouvrir le panneau de la barre supérieure et choisir `topbar-geo-country`/`topbar-geo-region`.
- `npm run e2e:integration:vite`, avec un worker et une base MySQL locale neuve, réussit 33 scénarios sur 36. La sérialisation est nécessaire : les tests partagent un chauffeur et des données de recette mutables. Les trois échecs restants sont le chargement initial du formulaire taxi public (« Impossible de préparer la commande »), le parcours réel de livraison qui expire avant la remise, puis le scénario de refus qui rencontre le chauffeur encore occupé après ce timeout. Le parcours mobilité réel, les authentifications, projets, dossiers, paiements et files de travail réussissent.
- Deux défauts du support d'intégration ont été corrigés : les comptes seedés disposent maintenant de téléphones uniques; la limite d'authentification passe à 100 uniquement sous `NODE_ENV=test` (15 en production). Les changements de périmètre commercial restent inchangés.
- Les quatre schémas MySQL locaux temporaires créés par ces essais ont été supprimés après vérification de leurs noms exacts et de l'hôte local.

### Prochaine unité de travail

Diagnostiquer et corriger les deux parcours d'intégration encore défaillants avant de qualifier l'étape 1 : instrumenter les réponses `/franchises/masters` et `/trade-categories` du formulaire taxi; faire remonter l'étape exacte du timeout livraison et garantir que le nettoyage du scénario libère le chauffeur même après échec. Ensuite, relancer l'intégration Vite sérialisée et valider les routes profondes, les ressources PWA et le service worker sur le build Vite. Garder CRA actif jusque-là.

### Mise à jour après diagnostic et validation complète

Le défaut taxi Vite a été localisé dans `TaxiRideRequestForm.jsx` : un `require()` CommonJS était appelé dans le navigateur, alors que Vite sert le code en modules ES. Il a été remplacé par un `import()` dynamique, avec le même garde d'exécution et la même gestion facultative des emplacements sauvegardés. Le scénario isolé « mobilite reelle: commande » passe désormais.

Après les corrections précédentes du scénario livraison (ouverture de la section de remise et libération garantie du chauffeur pendant le nettoyage), la suite d'intégration Vite complète a été relancée avec un seul worker sur une base dédiée : **36/36 scénarios réussis en 4,2 minutes**. La navigation Vite passe aussi **119/119**. Le build Vite passe après la correction.

Il reste des avertissements attendus en recette locale sans clés externes (géocodage, matrice de distance et ImageKit), et deux avertissements de maintenance/optimisation du build : données Browserslist âgées de 13 mois et chunk d'entrée d'environ 960,57 Ko (293,30 Ko gzip). Ils n'ont pas fait échouer les validations. Avant de remplacer CRA par défaut, il reste à valider les routes profondes, le manifest, les icônes et le service worker sur l'aperçu du build Vite, puis à vérifier les variables et paramètres du déploiement. CRA et Jest restent en place comme voie de retour et runner de tests.
