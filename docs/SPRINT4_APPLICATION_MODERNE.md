# Sprint 4 - Niveau application moderne

## 1) CI pipeline (lint + tests + build)

Workflow GitHub Actions: `.github/workflows/ci.yml`

- Job `backend`
- `npm ci`
- `npm run lint`
- `npm test`
- `npm run test:contract`

- Job `frontend`
- `npm ci`
- `npm run lint`
- `npm test -- --watchAll=false`
- `npm run build`

## 2) Contrat OpenAPI + tests contractuels

Contrat versionne:

- `backend/openapi/openapi.json`
- Expose via `GET /api/v1/openapi.json` (alias aussi via `/api/openapi.json`)

Tests contractuels:

- `backend/tests/contract/openapi.contract.test.js`
- Valident les schemas de:
- `GET /api/v1/health`
- `POST /api/v1/auth/login` (400 validation)
- `GET /api/v1/auth/me` (401 non authentifie)

Commande:

```bash
cd backend
npm run test:contract
```

## 3) Observabilite production

### Backend

- Endpoint metriques: `GET /api/v1/metrics`
- SLO latence calcule:
- `slo.latency.targetMs` (env `SLO_TARGET_LATENCY_MS`, defaut `800`)
- `slo.latency.targetCompliancePct` (env `SLO_TARGET_COMPLIANCE_PCT`, defaut `95`)
- `slo.latency.currentCompliancePct`
- `slo.latency.isMet`

- Ingestion erreurs frontend:
- `POST /api/v1/observability/frontend-errors`
- Header optionnel de protection: `X-Observability-Token`
- Token serveur: `FRONTEND_ERROR_TOKEN`

### Frontend

Capture active en production:

- `window.onerror`
- `window.unhandledrejection`
- erreurs React via `ErrorBoundary`

Fichier: `frontend/src/utils/errorReporter.js`

Variables:

- `REACT_APP_ENABLE_FRONTEND_ERROR_REPORTING` (`false` pour desactiver)
- `REACT_APP_OBSERVABILITY_TOKEN` (si `FRONTEND_ERROR_TOKEN` est configure cote backend)
- `REACT_APP_RELEASE` (version applicative pour correlation)

### Dashboard

La page admin existante `frontend/src/pages/AdminMetricsPage.jsx` expose maintenant:

- volume requetes
- erreurs 5xx
- latence moyenne/max
- conformite SLO latence
- total erreurs frontend + liste recente

Un template Grafana JSON API est fourni:

- `docs/observability/grafana-latency-slo-dashboard.json`
