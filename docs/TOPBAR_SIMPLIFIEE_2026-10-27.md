# Barre supérieure simplifiée — 27 octobre 2026

## Résultat

La barre supérieure conserve une hauteur de 64 px. Le logo ramène à l’accueil commun. Sur ordinateur, les liens principaux restent visibles dans le même ordre que la navigation mobile et s’adaptent au rôle.

À droite, trois accès : territoire, informations à lire et compte. Le nom complet, le rôle, la langue et le badge de page ne surchargent plus la barre.

- **Territoire** : panneau pays/région. Le périmètre reste consultatif pour les comptes rattachés à un territoire ; seul l’administrateur global conserve les sélecteurs. Le pays est résumé dans la barre sur grand écran.
- **Informations** : cloche et compteur accessibles, ouvrant directement `/operations?vue=a-lire`. L’ouverture ne marque pas tout comme lu.
- **Compte** : identité, paramètres, sécurité, aide, langue, informations légales dépliables et déconnexion. Même accès sur ordinateur et téléphone.

Sur mobile, la barre du bas conserve les accès au travail et le menu Plus existants. Les repères accessibles distinguent désormais « Navigation principale » et « Navigation mobile ».

## Comportements vérifiés

Les commandes principales du compte, du territoire et des informations ont une cible d’au moins 44 × 44 px. Les panneaux disposent d’une fermeture explicite, se ferment avec Échap ou un clic extérieur et rendent le focus au déclencheur. Tab et Maj+Tab restent dans le panneau ouvert.

Un seul panneau est ouvert à la fois. Les panneaux se ferment à la navigation ou au changement de compte. Le défilement de la page reprend à leur fermeture. Le passage entre navigation mobile et ordinateur ferme le menu Plus devenu invisible. Les panneaux défilent intérieurement lorsque la hauteur disponible est faible.

Les libellés français et anglais et les thèmes clair et sombre sont conservés. Les règles de territoire, les droits des routes et les parcours métier restent ceux de l’application.

## Validation du lot

| Vérification | Résultat |
| --- | --- |
| Tests unitaires interface, `npm.cmd test` | 81 suites, 422 tests réussis |
| Lint interface, `npm.cmd run lint` | Réussi |
| Compilation, `npm.cmd run build` | Réussie |
| Navigateur : topbar, navigation, vues par rôle et authentification | 37 scénarios réussis |
| Vrais comptes locaux de Côte d’Ivoire | 4 parcours réussis : client, administrateur, agent et prestataire |

Les scénarios navigateur comprennent 16 cas dédiés à la barre : quatre rôles à 360, 768 et 1440 px, administrateur global à 1024 px, petit écran à 320 px et paysage, accès publics à 320 px, thème sombre et informations. Les 21 autres cas couvrent la navigation existante, les vues par rôle, la déconnexion et le changement de mot de passe avec API simulée.

Les quatre parcours réels utilisent l’interface `http://localhost:3000` et son API locale, sans simulation : connexion, accueil du rôle, territoire Côte d’Ivoire, compte, paramètres et déconnexion. Aucun changement métier n’est effectué. Ces contrôles navigateur ne remplacent pas les essais physiques sur téléphone.

Journaux et captures conservés dans `artifacts/` (ignoré par Git) : `topbar-unit-final.log`, `topbar-lint-final.log`, `topbar-build.log`, `topbar-browser-final.log` (36 cas), `topbar-dark-final.log` (1 cas), `topbar-local-result.json` et `topbar-local-*.png`. Les identifiants locaux restent dans les fichiers de test ignorés, hors de cette documentation.

## Fichiers et état

La composition est dans `frontend/src/components/NavBar.js`, avec le nouveau `TopbarAccountMenu.jsx`. `GeoSelector.jsx` fournit les variantes résumé et panneau ; `LanguageSwitcher.js` conserve la mise à jour de langue existante. Les traductions sont dans les dictionnaires français et anglais et la couverture navigateur dans `frontend/e2e/topbar.spec.js`.

Ce lot est uniquement local, non commité et non déployé, ajouté aux changements déjà présents. Aucune dépendance, migration ou variable d’environnement nouvelle. Les serveurs de développement lancés par l’utilisateur restent disponibles ; un rafraîchissement de la page permet de voir la nouvelle barre.
