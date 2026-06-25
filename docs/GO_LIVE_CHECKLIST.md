# Go-Live Checklist (Executable)

Date: 2026-02-20  
Scope: `backend` + `frontend`

Snapshot maturite actuelle (pour integrations futures):
- `docs/MATURITY_STATUS_2026-03-07.md`

## 1) Security Gate (Blocker)

Run these commands before any production deploy:

```powershell
cd backend
npm.cmd run validate:prod-config
```

Use these templates to prepare hosting secrets:
- `backend/.env.production.example`
- `frontend/.env.production.example`

Pass criteria:
- `JWT_SECRET` is strong (>= 32 chars, not default/weak value)
- `CORS_ORIGINS` is defined and does not contain `*`
- `METRICS_TOKEN` is set
- `BOOTSTRAP_ADMIN_ALLOW_DEFAULTS=false`
- No default bootstrap password configured

Operational checks:
- Use `NODE_ENV=production`
- Keep `BOOTSTRAP_ADMIN_ENABLED=false` by default
- If temporary bootstrap is needed, set `BOOTSTRAP_ADMIN_EXPIRES_AT` with a short deadline and disable after use

## 2) Quality Gate (Tests + Lint + Build)

Backend:

```powershell
cd backend
npm.cmd run lint
npm.cmd test
```

Frontend:

```powershell
cd frontend
$env:CI='true'
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Pass criteria:
- Backend lint green
- Backend tests green
- Frontend lint green
- Frontend tests green
- Frontend production build green

## 3) DNS and Domain Gate

Run the production DNS diagnostic before and after domain changes:

```powershell
powershell -ExecutionPolicy Bypass -File tools/check-production-dns.ps1
```

Expected public records for the Netlify frontend:
- Apex/root domain `teranga-diaspora.com`: `A` record to `75.2.60.5`
- `www.teranga-diaspora.com`: `CNAME` to `teranga.netlify.app`

Netlify production domain setting:
- Primary domain: `www.teranga-diaspora.com`
- Domain alias/redirect: `teranga-diaspora.com` -> `https://www.teranga-diaspora.com`

Current app endpoints:
- Frontend: `https://www.teranga-diaspora.com`
- Backend health: `https://teranga-backend.onrender.com/api/health`

If public DNS passes but Windows/Chrome shows `DNS_PROBE_FINISHED_NXDOMAIN`:
- Flush Windows DNS cache: `ipconfig /flushdns`
- Restart the router or change the router/adapter DNS resolver to a public resolver such as `1.1.1.1` or `8.8.8.8`
- Retest both the default resolver and public resolvers:

```powershell
Resolve-DnsName teranga-diaspora.com
Resolve-DnsName teranga-diaspora.com -Server 8.8.8.8
Resolve-DnsName www.teranga-diaspora.com
```

Pass criteria:
- Public DNS returns the expected apex `A` record and `www` CNAME
- Backend health returns `200`
- Local/default resolver is not returning NXDOMAIN for the primary `www` frontend domain
- `https://www.teranga-diaspora.com` returns `200`, not a redirect back to `https://teranga-diaspora.com`

## 4) Release Runbook

1. Prepare environment
- Verify production `.env` values on hosting platform
- Confirm DB credentials and connectivity
- Confirm SMTP, ImageKit and metrics token

2. Database rollout
- Run migrations (`npm.cmd run db:migrate` in `backend`)
- Validate seed/bootstrap strategy (no dev defaults)

3. Deploy backend
- Deploy API revision
- Confirm `/api/health` = `200`
- Confirm `/api/metrics` requires token

4. Deploy frontend
- Publish `frontend/build`
- Verify login, register, protected routes, upload flows

5. Smoke tests after deployment
- Authentication: login/logout/reset password
- Core flows: properties/services/tasks/orders
- Access control: unauthorized access returns 401/403
- Observability: request logs, slow requests, frontend error capture

6. Rollback readiness
- Keep previous backend image/version available
- Keep previous frontend artifact available
- Define rollback trigger: auth failure, >5xx spike, migration issue

## 5) Go/No-Go Decision Template

Mark each as PASS/FAIL:
- Security gate: PASS / FAIL
- Quality gate: PASS / FAIL
- DNS and domain gate: PASS / FAIL
- Smoke tests: PASS / FAIL
- Rollback plan validated: PASS / FAIL

Release only if all are PASS.
