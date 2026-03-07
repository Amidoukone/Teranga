# Snapshot maturite actuelle (2026-03-07)

Perimetre: backend + frontend  
Objectif: refleter le niveau reel de maturite et cadrer les integrations futures.

## 1) Niveau actuel

Niveau courant: **Pre-Go-Live stabilise (integration possible avec garde-fous)**.

Lecture rapide:
- Les flux metier principaux sont operationnels.
- Le socle securite + observabilite est en place.
- La couverture de validation a ete etendue sans rupture fonctionnelle.
- Certaines capacites enterprise restent planifiees pour les lots suivants.

## 2) Ce qui est stable maintenant (confirme dans le code)

1. Stabilite API
- `/api` et `/api/v1` sont actifs en parallele.
- Endpoints de sante disponibles (`/health`, `/ready`, `/readiness`).

2. Securite
- Middleware de security headers applique globalement.
- CORS en mode allowlist, compatible prod.
- Auth avec access token, refresh token, rotation et blacklist.

3. Observabilite
- Metriques requetes + suivi des requetes lentes.
- Correlation des logs via `requestId`.
- Endpoint de capture des erreurs frontend pour diagnostic prod.

4. Validation d'entrees (lot P0 non regressif)
- Joi actif sur les routes d'ecriture sensibles.
- Extension recente route par route:
  - countries
  - regions
  - franchises
  - categories
  - project phases
  - transactions
- Inscription: `firstName` et `lastName` refusent les chiffres.

5. Qualite
- Lint et tests automatises passent sur la baseline courante.
- Test de contrat OpenAPI present dans la suite.

## 3) Decisions produit explicites (a respecter cote integration)

1. Recuperation de mot de passe
- Les endpoints self-service forgot/reset sont volontairement desactives.
- Politique officielle: reset manuel par master/admin.
- Les integrations doivent prevoir un flux support/admin, pas un flux email autonome.

2. SMTP
- SMTP reste optionnel dans l'etat actuel.
- Ne pas supposer l'envoi email de reset en production.

3. Non-regression payload
- Certaines nouvelles validations gardent `allowUnknown: true` et `stripUnknown: false`
  pour ne pas casser les clients existants pendant la transition.

## 4) Guide d'integration (prochaines integrations)

Base recommandee pour tout nouveau client/service:

1. Cibler `/api/v1` par defaut.
2. Integrer le parcours "reset manuel admin/master" comme workflow officiel.
3. Respecter les nouvelles regles d'inscription (pas de chiffres dans les noms).
4. Gerer proprement les erreurs de validation (`400 Validation error` + details).
5. Propager `X-Request-Id` dans les logs clients pour le support.

## 5) Ecarts de maturite restants (avant extension large)

1. Politique formelle de depreciation `/api` vs `/api/v1`.
2. Harmonisation stricte de validation sur 100% des routes ciblees.
3. Observabilite avancee (traces distribuees, alerting SLO automatise).
4. Gouvernance feature flags pour cadence de release plus elevee.

## 6) Statut pratique pour pilotage

Decision pour integrations futures: **GO controle, avec contraintes documentees**.

Approche recommandee:
- Integrer maintenant sur le contrat actuel.
- Garder la retro-compatibilite payload pendant les prochains lots.
- Refaire une revue de compatibilite a chaque vague P1/P2.
