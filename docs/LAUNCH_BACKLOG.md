# Teranga — Backlog priorisé (lancement grand public sans régression)

Objectif : transformer l’analyse de préparation au lancement en tickets actionnables,
priorisés et alignés avec la structure existante (multi‑pays/franchise, auth, dashboards),
en limitant toute régression fonctionnelle.

---

# 🧭 Principes d’exécution (non‑régression)
- **Changements atomiques** : 1 ticket = 1 objectif mesurable.
- **Feature flags** quand un changement peut impacter un flux existant.
- **Rétro‑compatibilité** par défaut (API et schéma DB).
- **Validation progressive** : tests ciblés + monitoring avant rollout complet.

---

# 🎯 P0 — Pré‑lancement (0–2 semaines)
> Objectif : sécuriser l’exploitation et réduire le risque d’incident en prod, **sans changer le comportement métier**.

## P0‑T1 — Verrouillage configuration prod (CORS & cookies)
**But** : éviter les blocages d’accès ou les failles d’exposition.
- **Changements**
  - Standardiser `CORS_ORIGINS` (allowlist) et documenter la config prod.
  - Vérifier l’usage cohérent de `FRONTEND_URL/CLIENT_URL` comme fallback.
  - Valider le mode cookie (secure/sameSite) selon l’environnement.
- **Risques** : coupure si allowlist incomplète.
- **Mitigation** : logs d’origine refusée + checklist de déploiement.
- **Acceptance criteria**
  - Origines autorisées passent.
  - Origines non listées refusées avec log.
- **Estimation** : S

## P0‑T2 — Hardening observabilité minimaliste (sans infra lourde)
**But** : capacité à diagnostiquer rapidement en prod.
- **Changements**
  - Finaliser l’export des métriques (ex. endpoint protégé + log structuré).
  - Ajouter corrélation `requestId` dans logs d’erreur et actions critiques.
  - Standardiser le format JSON des logs (niveau, requestId, userId, route).
- **Risques** : bruit de logs.
- **Mitigation** : niveaux `LOG_LEVEL` + sampling si besoin.
- **Acceptance criteria**
  - Chaque requête logguée avec `requestId`.
  - Erreurs critiques corrélées.
- **Estimation** : M

## P0‑T3 — Vérification RGPD & consentement analytics
**But** : conformité légale avant le grand public.
- **Changements**
  - Valider le bandeau consentement (opt‑in).
  - Vérifier l’absence de tracking tant que refus ou non‑choix.
  - Synchroniser les textes légaux avec les opérations réelles.
- **Risques** : non‑conformité juridique.
- **Mitigation** : revue juridique + audit tracking.
- **Acceptance criteria**
  - Aucun événement analytics sans consentement.
- **Estimation** : S

---

# 🎯 P1 — Gouvernance & fiabilité (2–6 semaines)
> Objectif : sécuriser la logique multi‑pays et la gestion admin/master.

## P1‑T1 — Enforcement scope master/admin global
**But** : éviter qu’un master opère hors de son pays/région.
- **Changements**
  - Middleware `requireScope` (countryId/regionId).
  - Audit des routes sensibles (pays, régions, franchises, promotions).
  - Feature flag pour rollout progressif.
- **Risques** : blocage d’actions existantes.
- **Mitigation** : tests ciblés + logging temporaire.
- **Acceptance criteria**
  - Master limité à son scope.
  - Admin global conserve accès complet.
- **Estimation** : M

## P1‑T2 — Durcissement sessions (refresh + blacklist)
**But** : fiabilité auth + réduction des risques de session compromise.
- **Changements**
  - Vérifier la rotation refresh en prod (TTL, blacklist).
  - Ajouter tests ciblés (refresh expiré / révocation).
  - Monitoring des erreurs auth (403/401).
- **Risques** : complexité auth.
- **Mitigation** : rollout progressif + fallback temporaire.
- **Acceptance criteria**
  - Token expiré => refresh valide.
  - Token révoqué => invalide immédiatement.
- **Estimation** : L

## P1‑T3 — Monitoring applicatif minimal (5xx / latence)
**But** : visibilité sur erreurs et performances.
- **Changements**
  - Dashboard minimal (latence moyenne, 4xx/5xx).
  - Alertes simples (ex. 5xx > X/min).
- **Risques** : surcharge outils monitoring.
- **Mitigation** : sampling et seuils.
- **Acceptance criteria**
  - Alertes fonctionnelles.
- **Estimation** : M

---

# 🎯 P2 — Qualité produit & UX (6–12 semaines)
> Objectif : stabilité long‑terme et UX robuste.

## P2‑T1 — Tests d’intégration critiques
**But** : prévenir les régressions sur flux clés.
- **Changements**
  - Tests API auth / commandes / preuves / projets.
  - CI qui bloque les régressions.
- **Risques** : coûts maintenance tests.
- **Mitigation** : focus sur flux critiques seulement.
- **Acceptance criteria**
  - Tests passent systématiquement en CI.
- **Estimation** : L

## P2‑T2 — Versionning API (v1)
**But** : évoluer sans casser les clients existants.
- **Changements**
  - Introduire `/api/v1` en parallèle de `/api`.
  - Migration progressive.
- **Risques** : doublonnage.
- **Mitigation** : dépréciation graduelle.
- **Acceptance criteria**
  - `/api` et `/api/v1` fonctionnent.
- **Estimation** : M

## P2‑T3 — Error boundaries frontend
**But** : éviter “écran blanc” en prod.
- **Changements**
  - Composant ErrorBoundary global.
  - Fallback UI + trace en dev.
- **Risques** : erreurs masquées en dev.
- **Mitigation** : stacktrace visible en dev.
- **Acceptance criteria**
  - Fallback visible en cas d’erreur React.
- **Estimation** : S

---

# 🎯 P3 — Maturité enterprise (12+ semaines)
> Objectif : déploiement industrialisé et scalabilité multi‑pays.

## P3‑T1 — Feature flags centralisés
**But** : déployer sans risque.
- **Changements**
  - Flags côté backend + frontend.
  - Standard d’usage documenté.
- **Risques** : complexité config.
- **Mitigation** : convention claire (naming + fallback).
- **Acceptance criteria**
  - Activation/désactivation sans redéploiement.
- **Estimation** : M

## P3‑T2 — Observabilité avancée (tracing distribué)
**But** : diagnostic complet en prod.
- **Changements**
  - OpenTelemetry + traces corrélées.
  - Sampling + correlation ID.
- **Risques** : coût infra.
- **Mitigation** : sampling + rollout progressif.
- **Acceptance criteria**
  - Traces corrélées aux requêtes utilisateur.
- **Estimation** : L

---

# ✅ Checklist de lancement (Go/No‑Go)
- CORS allowlist validée en prod.
- Consentement analytics validé (aucun tracking sans opt‑in).
- Monitoring minimal en place (5xx/latence).
- Tests critiques définis (même partiels).
- Plan de rollback documenté.

