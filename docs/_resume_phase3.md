# Reprise — Teranga Phase 3 (refonte design thinking)

## Contexte général
Projet piloté par `docs/DEV_SPEC_TERANGA_v3.md`. Lots 1-3 du cahier des charges confirmés en place,
Lot 2 (mission guidée + suivi) livré. Lot 4 (matching auto, commission dynamique, litiges, messagerie,
PWA, i18n multi-langues) confirmé non commencé — pas touché dans ce chantier.

Chantier en cours, décidé avec l'utilisateur en 3 volets après audit :
1. Géolocalisation non bloquante sur `properties`/`projects` — **fait**.
2. Correction d'un bug réel : une mission héritait du pays du COMPTE client au lieu du pays réel de
   l'adresse (routage + tarif) — **fait**.
3. Refonte visuelle/UX "design thinking" complète, itérative écran par écran, fondée sur des retours
   utilisateurs réels ("toute l'app est trop difficile à utiliser") — **en cours** (Tier 1 + Tier 2
   faits, Tier 3 pas commencé).

## Contraintes non négociables (rappelées plusieurs fois par l'utilisateur)
- Pas de réécriture architecturale, pas de réorganisation de `pages/`/`components/`/`services/`.
- Approche itérative écran par écran, un lot = un objectif vérifiable.
- Zéro régression : lint + tests + build doivent rester verts à chaque lot.
- Pas de vitrine publique pour les biens immobiliers (compte obligatoire).
- Pas de nouvelle dépendance npm sauf besoin fort justifié.

## Arrangement de travail en cours
**L'utilisateur lance lui-même `npm start` (frontend, port 3000) pour tester en direct et donner des
retours.** Ne pas démarrer/relancer le serveur dev frontend sans qu'il le redemande explicitement.
Vérification côté assistant = `npm run lint` / `npm test` / `npm run build` uniquement.
Le backend (port 5000, `node index.js` depuis `backend/`) reste ok à démarrer/relancer si besoin —
il faut qu'il tourne pour que le frontend de l'utilisateur fonctionne.

## Ce qui est fait et committé (10 commits cette session, du plus ancien au plus récent)
1. `721d206` — Lot 2 : création de mission guidée + suivi en direct (vérifié en navigateur, 132/132
   tests backend).
2. `f113b09` — Fondations UI : `frontend/src/components/ui/{Button,Card,Badge,Spinner,FormField,
   Modal}.jsx` + hook `frontend/src/hooks/useFocusTrap.js`, posés sur les tokens CSS existants. Fix des
   2 lacunes a11y bloquantes (ConfirmProvider en dialog accessible, labels de formulaire associés).
3. `7052dd9` — Géolocalisation non bloquante `properties` (déjà les colonnes, juste câblé
   `geocodeAddress`) + `projects` (nouvelle migration additive `address`/`city`/`latitude`/`longitude`).
4. `291ccc1` — **Correction transfrontalière** : nouveau helper `backend/src/utils/
   resolveMissionGeoScope.js`, `geocoding.service.js` étendu pour extraire pays/région depuis
   `address_components` Google. `missionRequest.controller.js` + `mission.controller.js` (create+estimate)
   + `priceEstimate.service.js` utilisent maintenant la destination géocodée, pas le compte.
5. `0e5596a` — Refonte `MissionRequestForm.jsx` (homepage) : révélation progressive au lieu d'un mur de
   champs (catégorie → détails mission → coordonnées avec explication du pourquoi).
6. `f4bae70` — `NavBar.js` : piège de focus clavier sur les 3 menus (via `useFocusTrap`). `WizardProgress.jsx` :
   `role="progressbar"` + annonce "Étape X sur N". Icônes décoratives `aria-hidden`.
7. `7b2a635` — Contraste `--color-text-muted` en mode clair corrigé (WCAG AA).
8. `28e7ecc` — Badges de statut unifiés (`Orders`/`Tasks`/`Properties`) via `Badge` + nouveaux helpers
   `getOrderStatusTone`/`getPaymentStatusTone`/`getTaskStatusTone` dans `utils/labels.js`. **Bug trouvé
   et corrigé** : une tâche annulée affichait un badge vert "succès" (mapping couleur incomplet).
   Lightbox `PropertiesPage.js`/`TaskEvidencesPage.js` : sémantique dialog + piège de focus ajoutés
   (celle de TaskEvidencesPage n'avait AUCUNE protection clavier avant).
9. `726fe04` — Idem pour `ProjectsPage.jsx`/`ProjectDetailPage.jsx` via `getProjectStatusTone`. **Bug
   trouvé et corrigé** : le badge de statut non-admin était codé en dur "bleu" peu importe le vrai
   statut.
10. `3d6ac86` — Badge de solde `DashboardPage.js` corrigé en mode sombre (couleur "rose" jamais
    remappée aux tokens dans `tailwind.config.js`). Lightbox preuves `OrderDetailPage.js` : focus trap
    ajouté (avait déjà `role="dialog"` mais pas d'Escape/piège de focus).

## Où on s'est arrêté (Tier 2 pas fini à 100%)
Restent des candidats **non traités** repérés mais pas encore migrés :
- Modales `fixed inset-0` non auditées : `AdminPropertiesPage.js`, `AdminProductsPage.jsx`,
  `ProductCatalogPage.jsx`, `ProductDetailPage.jsx` (probablement Tier 3/admin, ou à trancher avec
  l'utilisateur — Product* n'était pas explicitement dans le Tier 2 listé).
- Aucun composant `DataTable` extrait : les pages Tier 2 auditées jusqu'ici sont toutes en cartes, pas
  en `<table>` — la vraie duplication de tables vit dans les pages admin (Tier 3), à extraire là-bas.

## Tier 3 (pas commencé) — pages admin, en dernier (trafic interne)
`AdminAgentsPage.js`, `AdminPropertiesPage.js`, `AdminServicesPage.js`, `AdminUsersPage.js` (en
premier, déjà propre côté tokens — bon pilote), `AdminCategoriesPage.jsx`, `AdminProductsPage.jsx`,
`AdminProjectsPage.jsx`, `MissionPricingAdminPage.js`, `FinanceDashboardPage.js`.

## Piège technique à connaître pour la suite
- Tailwind : `emerald`/`red`/`amber` ne sont remappés aux tokens design QUE sur certaines teintes
  (400-700 selon la couleur) dans `tailwind.config.js` — `-100`/`-800` et toute autre palette
  (`rose`, `indigo`, ...) ne sont PAS remappées et cassent silencieusement en dark mode. Grep
  `bg-(rose|indigo|emerald-100|amber-100)` pour en trouver d'autres.
- Mocker `react-router-dom` dans un test (`jest.mock`) exige `{ virtual: true }` en 3ᵉ argument sinon
  Jest échoue à résoudre le module même pour le mock (v7 a un `exports` package.json que le résolveur
  Jest de CRA ne gère pas) — voir `NavBar.test.js` ou `MissionRequestForm.test.jsx` pour l'exemple.
- `userEvent` installé est en v13.5.0, PAS v14 : pas de `userEvent.setup()`, appeler directement
  `userEvent.click(...)`/`userEvent.type(...)` (avec `await`).

## Prochaine étape suggérée
Demander à l'utilisateur ses retours de test sur la homepage/formulaire de mission et la navigation
clavier de la NavBar avant de repartir sur la suite, puis reprendre soit le reste du Tier 2 (modales
produits), soit directement le Tier 3 (admin), selon sa priorité.
