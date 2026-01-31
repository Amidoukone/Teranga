# Audit de préparation au lancement public — Teranga

## 1) Périmètre & méthodologie
- **Périmètre** : front React (CRA), API Node/Express, docs métier & plan d’exécution.
- **Sources** :
  - Backend (configuration, middleware sécurité, routes/auth, upload, logging).
  - Frontend (routing, analytics, auth, client API).
  - Documentation (plan d’exécution, règles multi‑pays).

### Commandes utilisées
- `ls`
- `ls -a`
- `cat README.md`
- `cat docs/PLAN_EXECUTION.md`
- `cat backend/docs/multi-country-rules.md`
- `cat backend/package.json`
- `cat frontend/package.json`
- `sed -n '1,200p' backend/index.js`
- `sed -n '200,400p' backend/index.js`
- `sed -n '1,200p' backend/src/controllers/auth.controller.js`
- `sed -n '240,480p' backend/src/controllers/auth.controller.js`
- `sed -n '480,720p' backend/src/controllers/auth.controller.js`
- `sed -n '1,200p' backend/src/middleware/auth.middleware.js`
- `sed -n '1,200p' backend/src/middleware/securityHeaders.middleware.js`
- `sed -n '1,200p' backend/src/middleware/metrics.middleware.js`
- `sed -n '1,200p' backend/src/middleware/requestContext.middleware.js`
- `sed -n '1,200p' backend/src/middleware/rateLimit.middleware.js`
- `sed -n '1,200p' backend/src/middleware/roles.middleware.js`
- `sed -n '1,200p' backend/src/middleware/validate.middleware.js`
- `sed -n '1,200p' backend/src/middleware/uploadEvidence.middleware.js`
- `sed -n '1,200p' backend/src/routes/auth.routes.js`
- `sed -n '1,200p' backend/src/routes/order.routes.js`
- `sed -n '1,200p' backend/src/routes/user.routes.js`
- `sed -n '1,200p' backend/src/routes/service.routes.js`
- `sed -n '1,200p' backend/src/routes/task.routes.js`
- `sed -n '1,200p' backend/src/routes/evidence.routes.js`
- `sed -n '1,200p' backend/src/routes/project.routes.js`
- `rg -n "validateBody" backend/src/routes`
- `sed -n '1,200p' frontend/src/App.js`
- `sed -n '200,400p' frontend/src/App.js`
- `sed -n '400,800p' frontend/src/App.js`
- `sed -n '1,200p' frontend/src/components/AnalyticsConsentBanner.js`
- `sed -n '1,200p' frontend/src/utils/analytics.js`
- `sed -n '1,200p' frontend/src/services/api.js`
- `sed -n '1,200p' frontend/src/services/auth.js`

---

## 2) Résumé d’architecture (constaté)
### Backend (Express + Sequelize)
- API Express avec CORS configurable, Request ID, logs structurés, gestion d’erreurs, healthcheck, **headers de sécurité globaux** et **métriques applicatives basiques** via `/api/metrics` (optionnellement protégé par token). Le serveur charge un grand nombre de routes métiers (auth, services, transactions, projets, commerce, etc.).
- Auth JWT avec cookies httpOnly, refresh tokens en base, rotation, blacklist, et vérification CSRF quand les cookies sont utilisés.
- Rate limiting sur endpoints sensibles (auth/refresh/write) et validation d’entrées basée sur Joi désormais étendue aux routes sensibles (users, services, tasks, evidences, projects).
- Uploads : limitation taille, types de fichiers autorisés, stockage mémoire (prêt ImageKit).

### Frontend (React + CRA)
- App React (CRA) avec routage protégé, SEO, analytics conditionnels au consentement, et pages admin/agent/client.
- Client API axios avec base URL adaptative, injection du token bearer, `withCredentials`, et en‑tête CSRF.
- Auth côté front **supporte un mode cookie** (via `REACT_APP_AUTH_STORAGE=cookie`) pour éviter le stockage localStorage, tout en conservant un fallback “offline” via cache user.

### Documentation métier
- Plan d’exécution “améliorations pro sans régression”, priorisé P0‑P3.
- Règles multi‑pays & franchise (PlanetScale safe, conventions DB, backfill pays/région).

---

## 3) Verdict “go/no‑go” pour un lancement grand public
### ✅ Points solides pour un **beta public contrôlé**
- Auth moderne avec refresh tokens + blacklist + CSRF si cookies, et rate limit dédié à l’authentification.
- CORS en allowlist configurable et request tracing via `X‑Request‑Id`.
- Consentement analytics explicite côté frontend.
- **Headers de sécurité globaux** actifs (CSP, HSTS en prod, X‑Frame‑Options, etc.).
- **Option cookie‑only auth** disponible pour éviter le stockage JWT en localStorage.

### ⚠️ Bloquants/risques si lancement “grand public” **sans durcissement complémentaire**
- **Fiabilité & Observabilité** : monitoring applicatif avancé (alerting, dashboards consolidés) et tests d’intégration automatisés restent nécessaires.

**Conclusion** : lancement grand public **possible après corrections P0 restantes (validation + observabilité + conformité)**, sinon risque élevé pour la confiance et la stabilité.

---

## 4) Points forts (déjà en place)
### Sécurité & Auth
- JWT avec rotation et blacklist + contrôle CSRF si cookie. Cookies `httpOnly`, `secure` en prod, `sameSite=lax`.
- Rate limiting sur `/auth`, `/refresh` et endpoints d’écriture.
- Headers HTTP globaux (CSP minimal, HSTS en production, COOP/CORP, etc.).
- Mode auth cookie‑only disponible pour réduire l’exposition JWT côté client.

### Architecture & Gouvernance
- Découpage multi‑pays documenté, conventions DB claires, backfill prévu pour éviter les régressions.

### Frontend & UX
- Routage protégé et séparation stricte des parcours public/auth/admin/agent.
- Consentement analytics intégré avec activation conditionnelle de GA4.

---

## 5) Axes d’amélioration pour être “pro & efficace”
### A. Sécurité (P0 — avant ouverture grand public)
1) ✅ **Durcir les headers HTTP** : CSP, HSTS, X‑Frame‑Options, Referrer‑Policy (déployé globalement).
2) ✅ **Réduire l’exposition du JWT côté front** : mode cookie‑only disponible (`REACT_APP_AUTH_STORAGE=cookie`).
3) ⏳ **Réviser la gestion des erreurs** : uniformiser les messages d’erreur pour éviter de divulguer des infos sensibles.

### B. Validation & cohérence API (P0/P1)
1) ✅ **Étendre la validation Joi** aux routes sensibles (users, services, tasks, evidences, projects).
2) **Normaliser les réponses API** : mêmes formats d’erreur et de succès sur tous les modules.

### C. Observabilité & fiabilité (P0/P1)
1) ✅ **Métriques basiques** (latence, 4xx/5xx, volumes) via `/api/metrics` + **token optionnel**.
2) ⏳ **Alerting & dashboards** (Prometheus/Grafana ou équivalent) pour industrialiser.
3) **Journalisation corrélée** (requestId déjà présent) + logs centralisés.

### D. Qualité & tests (P1/P2)
1) **Tests d’intégration** pour auth, commandes, preuves, projets.
2) **Scénarios de non‑régression** par module avant chaque release.

### E. Frontend & Produit (P1/P2)
1) **Error boundary global** pour éviter les écrans blancs.
2) **Performance** : analyser bundle CRA (suspense/lazy‑load) et métriques Web Vitals.
3) **Internationalisation (i18n)** : structure multi‑langues (FR/EN) en vue du public diaspora.

### F. Ops/Scalabilité (P2/P3)
1) **Feature flags** pour activer des nouveautés sans risque.
2) **Traces distribuées** (OpenTelemetry) pour debug production.

---

## 6) Plan de priorisation recommandé (aligné avec le plan existant)
| Priorité | Objectif | Pourquoi | Délai conseillé |
|---|---|---|---|
| P0 | Sécurité & conformité | Prévenir incidents et risques légaux | 0‑2 semaines |
| P1 | Gouvernance & fiabilité | Stabiliser rôles, scopes, monitoring | 2‑6 semaines |
| P2 | Qualité produit & DX | Tests, error boundaries, versionning | 6‑12 semaines |
| P3 | Maturité enterprise | Feature flags, observabilité avancée | 12+ semaines |

---

## 7) Recommandation de lancement
- **Oui pour un beta public contrôlé** (nombre d’utilisateurs limité, monitoring renforcé, support réactif).
- **Non pour un lancement large** avant P0 (sécurité + validation + observabilité). Le niveau “pro & efficace” attendu grand public dépend surtout de ces chantiers.

---

## 8) Checklist “grand public” (sans régression)
### Backend
- ✅ Headers sécurité globaux actifs (CSP minimal, HSTS prod, COOP/CORP).
- ✅ CORS configuré via allowlist.
- ✅ Validation Joi étendue aux routes sensibles (users, services, tasks, evidences, projects).
- ✅ Metrics basiques via `/api/metrics` (token optionnel).
- ⏳ Monitoring/alerting avancé + dashboards.

### Frontend
- ✅ Consentement analytics (GA4) conditionnel.
- ✅ Mode cookie‑only auth disponible (`REACT_APP_AUTH_STORAGE=cookie`).
- ⏳ Error boundary global pour éviter l’écran blanc.

### Ops
- ⏳ Tests d’intégration sur flux critiques.
- ⏳ Rollout progressif (feature flags / toggles).

---

## 9) Plan de livraison par étapes (sans régression)
**Étape 1 — P0 finalisation (1–2 semaines)**  
- Déployer validation étendue (déjà en place) + ajuster messages d’erreur uniformes.  
- Activer `/api/metrics` avec `METRICS_TOKEN` en prod.  

**Étape 2 — Observabilité opérationnelle (2–4 semaines)**  
- Brancher dashboards + alerting (Prometheus/Grafana ou équivalent).  
- Définir seuils SLO (latence, taux d’erreurs).  

**Étape 3 — Tests d’intégration ciblés (4–6 semaines)**  
- Auth, commandes, preuves, projets.  
- CI minimal : exécuter les tests critiques à chaque déploiement.  

**Étape 4 — Lancement large**  
- Rollout progressif + feature flags.  
- Monitoring renforcé pendant les 2 premières semaines.

---

## 10) Références internes
- Plan d’exécution : `docs/PLAN_EXECUTION.md`.
- Règles multi‑pays : `backend/docs/multi-country-rules.md`.
