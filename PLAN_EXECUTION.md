# Plan d’exécution – Améliorations pro sans régression

Ce plan convertit les recommandations en tickets actionnables, priorisés et estimés. Objectif : **améliorer la qualité sans casser l’application** en procédant par petites itérations sécurisées.

## Principes d’exécution (non‑régression)
- **Petits changements atomiques** : 1 ticket = 1 objectif mesurable.
- **Feature flags** quand une nouveauté peut impacter un flux existant.
- **Rétro‑compatibilité API** (pas de breaking change sans versionning).
- **Validation progressive** : tests ciblés + monitoring avant déploiement complet.

## Échelle d’estimation
- **S (0,5–1 j)**, **M (1–3 j)**, **L (3–5 j)**, **XL (5–8 j)**.

---

# 🎯 Priorité P0 — Sécurité & stabilité immédiate (0–2 semaines)
> Focus : limiter les risques en production, sans modifier le comportement fonctionnel.

## P0-T1 — CORS par allowlist configurable
- **Objectif** : remplacer `origin: true` par une allowlist (ENV) pour éviter les accès non autorisés.
- **Changements** :
  - Ajouter `CORS_ORIGINS` dans `.env` (liste d’origines séparées par virgule).
  - Adapter la config CORS pour accepter uniquement les origines listées (ou `*` en mode dev).
- **Estimation** : S
- **Risques** : blocage d’origines légitimes si la liste est incomplète.
- **Mitigation** : journaliser l’origine refusée + guide de configuration.
- **Acceptance criteria** :
  - Accès autorisé depuis les origines listées.
  - Accès refusé depuis une origine non listée.

## P0-T2 — Logger structuré + Request ID
- **Objectif** : améliorer la traçabilité sans impact fonctionnel.
- **Changements** :
  - Ajouter un middleware qui injecte un `requestId` (UUID) dans chaque requête.
  - Remplacer `console.log` par un logger structuré (pino ou winston).
- **Estimation** : M
- **Risques** : bruit de logs accru.
- **Mitigation** : niveaux de logs (info/warn/error) + rotation en prod.
- **Acceptance criteria** :
  - Chaque requête a un `requestId` en log.
  - Les erreurs corrèlent `requestId` dans les logs.

## P0-T3 — Consentement analytics (GA4)
- **Objectif** : se conformer aux bonnes pratiques RGPD sans bloquer le parcours utilisateur.
- **Changements** :
  - Ajouter un bandeau de consentement.
  - Conditionner l’initialisation GA4 au consentement.
- **Estimation** : M
- **Risques** : baisse de tracking si non‑consentement.
- **Mitigation** : copywriting clair + stockage du choix (localStorage).
- **Acceptance criteria** :
  - Pas de tracking tant que le consentement n’est pas donné.

## P0-T4 — Validation d’entrées sur endpoints sensibles
- **Objectif** : éviter les entrées invalides et erreurs silencieuses.
- **Changements** :
  - Ajouter un layer de validation (Zod/Joi) sur auth, user, orders, products.
- **Estimation** : M
- **Risques** : rejet de requêtes jusque‑là tolérées.
- **Mitigation** : validations progressives + messages d’erreur clairs.
- **Acceptance criteria** :
  - Payloads invalides renvoient 400 avec erreurs détaillées.

---

# 🎯 Priorité P1 — Gouvernance & fiabilité (2–6 semaines)
> Focus : renforcer la logique master/admin et la robustesse backend.

## P1-T1 — Enforcement du scope master/admin global
- **Objectif** : appliquer la logique “master = admin scoped” côté routes critiques.
- **Changements** :
  - Ajouter un middleware `requireScope` (countryId/regionId).
  - Adapter routes sensibles (création/modif pays/régions, franchises, promotions).
- **Estimation** : M
- **Risques** : blocage d’actions non prises en compte dans le scope.
- **Mitigation** : audits d’accès + feature flag.
- **Acceptance criteria** :
  - Un master ne peut pas opérer hors de son scope.
  - Un admin global conserve accès complet.

## P1-T2 — Hardening JWT (refresh + blacklist)
- **Objectif** : améliorer la gestion de session sans rupture.
- **Changements** :
  - Introduire refresh tokens.
  - Blacklist des tokens compromis ou révoqués.
- **Estimation** : L
- **Risques** : complexité auth.
- **Mitigation** : rollout progressif, fallback sur l’ancien flux.
- **Acceptance criteria** :
  - Tokens expirés renvoient un refresh valide.
  - Un token révoqué est immédiatement invalide.

## P1-T3 — Monitoring applicatif minimal
- **Objectif** : visibilité sur latence, taux d’erreurs, usage routes.
- **Changements** :
  - Exposer métriques (Prometheus ou équivalent) ou logs enrichis.
- **Estimation** : M
- **Risques** : surcharge si métriques mal configurées.
- **Mitigation** : sampling / filtres.
- **Acceptance criteria** :
  - Dashboards sur 5xx / 4xx / latence moyenne.

---

# 🎯 Priorité P2 — Qualité produit & DX (6–12 semaines)
> Focus : réduire la dette technique, améliorer la stabilité long terme.

## P2-T1 — Tests d’intégration critiques
- **Objectif** : sécuriser les flux clés (auth, commandes, preuves, projets).
- **Changements** :
  - Ajouter tests API (supertest / jest).
- **Estimation** : L
- **Risques** : temps de maintenance tests.
- **Mitigation** : focus sur flux critiques uniquement.
- **Acceptance criteria** :
  - Pipeline CI avec tests clés passe systématiquement.

## P2-T2 — Versionning API (v1)
- **Objectif** : préparer les évolutions sans casser les clients.
- **Changements** :
  - Introduire `/api/v1` et conserver `/api` en alias temporaire.
- **Estimation** : M
- **Risques** : doublonnage de routes.
- **Mitigation** : migration progressive.
- **Acceptance criteria** :
  - Les deux chemins fonctionnent en parallèle.

## P2-T3 — Error boundaries frontend
- **Objectif** : éviter “écran blanc” et améliorer UX.
- **Changements** :
  - Ajouter un composant ErrorBoundary global.
- **Estimation** : S
- **Risques** : masquage d’erreurs en dev.
- **Mitigation** : afficher stacktrace en mode dev.
- **Acceptance criteria** :
  - UI fallback visible en cas d’erreur React.

---

# 🎯 Priorité P3 — Maturité enterprise (12+ semaines)
> Focus : industrialisation et scalabilité.

## P3-T1 — Feature flags centralisés
- **Objectif** : déployer des nouveautés sans risque.
- **Changements** :
  - Mettre en place un système de flags (env ou service tiers).
- **Estimation** : M
- **Risques** : complexité de configuration.
- **Mitigation** : définir un standard d’usage.
- **Acceptance criteria** :
  - Activation/désactivation de features sans redéploiement.

## P3-T2 — Observabilité avancée (traces)
- **Objectif** : diagnostiquer rapidement en prod.
- **Changements** :
  - OpenTelemetry + tracing distribué.
- **Estimation** : L
- **Risques** : coût opérationnel.
- **Mitigation** : sampling.
- **Acceptance criteria** :
  - Traces corrélées aux requêtes utilisateur.

---

# Calendrier indicatif (exemple)
| Période | Focus | Livraison clé |
|---|---|---|
| S1–S2 | P0 | Sécurité + logging + consentement GA |
| S3–S6 | P1 | Scope master/admin + JWT + monitoring |
| S7–S12 | P2 | Tests + API v1 + error boundaries |
| 12+ | P3 | Feature flags + observabilité avancée |

---

# Gouvernance & suivi
- **Rythme** : release hebdomadaire ou bi‑hebdo.
- **KPIs d’exécution** : bugs critiques, rollback rate, taux de tests passés.
- **Qualité** : chaque ticket doit inclure validation manuelle + log d’impact.

