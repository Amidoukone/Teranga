# Audit de cohérence et de fiabilité — 3 novembre 2026

## Contexte et méthode

Cet audit répond à une demande d'analyse experte de l'application dans son ensemble, à la recherche d'erreurs silencieuses, de bugs, d'incohérences et de défauts, après plusieurs lots de simplification. Le périmètre couvert est l'état actuel du dépôt, **y compris le lot de simplification non commité** (111 fichiers modifiés, net -6350/+1520 lignes, plus des fichiers nouveaux comme `clientRequests.*`), car c'est la zone la plus récente et la plus susceptible de régressions fraîches.

Cinq analyses approfondies en parallèle ont couvert : (A) le noyau mission/exécution/coordination, (B) le commerce, les finances et les biens, (C) la plateforme, la sécurité et le multi-pays, (D) le frontend des changements récents, (E) les tests et la cohérence transverse (OpenAPI, scripts, code mort).

**Mise à jour du 3 novembre 2026 (suite à la clôture) :** les 11 constats critiques (lot 1) ont été corrigés, testés (nouveaux tests unitaires et d'intégration contre une vraie base) et validés par la suite complète (647 tests backend, 423 tests interface, tous passants). Détail en fin de document, section « Suivi des corrections — lot 1 ».

**Mise à jour du 4 novembre 2026 :** les 54 constats restants (lots 2 à 4) ont été traités selon la même discipline — corrigés et testés, ou retirés quand l'investigation a montré que le constat initial était inexact. Validation finale : **680 tests backend (98 suites) et 442 tests interface (84 suites), tous passants**. Détail en fin de document, section « Suivi des corrections — lots 2 à 4 ». Deux points restent ouverts par choix (couverture e2e/Playwright non exécutée dans cette session, et une décision produit sur le devenir de `DossiersPage.jsx`).

**Note de méthode :** certains constats (notamment ceux liés aux workflows métier) s'appuient sur les règles décrites dans `docs/REPRISE_SESSION_2026-10-26.md` et les documents de simplification associés, confrontées systématiquement au code réel — pas prises pour argent comptant. Le volet E a explicitement écarté plusieurs hypothèses qui se sont révélées fausses après lecture complète du code ; l'ensemble du lot de simplification est globalement bien couvert par les tests qui l'accompagnent.

## Synthèse — ce qui compte le plus

Quatre défauts méritent une attention immédiate parce qu'ils touchent à l'argent, à la sécurité ou à la confiance utilisateur de façon large :

1. **Le justificatif de réalisation avant clôture n'est, en pratique, jamais exigé** pour une mission affectée manuellement (le cas normal) — l'exigence documentée « un justificatif n'est pas un reçu, mais il doit exister » n'est câblée que pour l'affectation automatique, désactivée par défaut (constat A3).
2. **Le dashboard financier additionne des montants de devises différentes** dans un seul total (constat B2), et plusieurs écritures financières ne sont jamais remises à jour ou dédupliquées correctement (B1, B3), ce qui fausse silencieusement les bilans.
3. **Toute coupure réseau déconnecte faussement l'utilisateur** sur plusieurs écrans (missions, commandes, finances, sélecteur de territoire) parce que `me()` confond « pas de session » et « panne réseau » (constat D1-D4).
4. **La posture de sécurité de production dépend d'une égalité exacte sur `NODE_ENV`** : toute variante ou absence de cette variable désactive silencieusement tous les garde-fous (CORS ouvert, secrets non vérifiés) sans même un avertissement dans les logs (constat C1).

Le reste du document détaille l'ensemble des constats, classés par sévérité puis par thème.

---

## Constats critiques

**1. Clôture de mission sans justificatif réellement exigé** — `backend/src/services/missionCoordination.service.js:18,79`, `backend/src/services/missionCompletion.service.js:28,33-40`, `backend/src/controllers/mission.controller.js:676-900`
`completionReportRequired` dépend de `policy.enabled`, qui est en réalité le flag d'**affectation automatique** (`DEFAULT_POLICY.enabled: false`). Le flux d'affectation manuelle (`POST /missions/:id/assign`, utilisé par un admin dans la quasi-totalité des cas réels) ne configure jamais `coordination.enabled`. Résultat : `assertCompletionReady` ne bloque jamais `COMPLETED` pour ces missions — le justificatif devient optionnel en pratique, à l'encontre de l'exigence métier documentée.

**2. Transition de litige « à refaire » sans issue** — `backend/src/services/missionStatus.service.js:12-25`, `backend/src/constants/missionStatus.js:31`, `backend/src/services/agentCapacity.service.js:11`, `backend/src/services/missionCoordination.service.js:17,219-222`, `backend/src/controllers/dispute.controller.js:17-21,182-188`
`RESOLVED_REDO` n'est la cible d'aucune transition de sortie : cul-de-sac définitif. Il est pourtant classé « historique » côté client (masqué comme terminé) alors qu'`agentCapacity.service.js` le compte toujours comme charge active pour l'agent, et que la supervision le considère non-fermé. Un master qui choisit « à refaire » sur un litige bloque l'agent à vie si sa capacité max est atteinte, tout en faisant croire au client que le dossier est réglé, et génère des alertes de supervision sans fin.

**3. Comptes dupliqués par numéro de téléphone (race condition)** — `backend/src/controllers/auth.controller.js:80-97`, `backend/models/user.js:69-93`, `backend/migrations/20260603190000-allow-phone-or-email-auth.js:20-24`
L'unicité du téléphone n'est vérifiée qu'en applicatif (`User.findOne`), sans contrainte UNIQUE en base (contrairement à l'email). Deux requêtes concurrentes avec le même numéro (inscription, commande téléphonique) créent deux comptes distincts avec le même téléphone, rendant la connexion/récupération ultérieure non déterministe.

**4. Déconnexions fantômes sur simple panne réseau** — `frontend/src/services/auth.js:479-535`, répercuté sur `frontend/src/pages/MyMissionsPage.jsx:74-98`, `frontend/src/features/orders/OrdersWorkspace.jsx:101-106`, `frontend/src/contexts/GeoContext.jsx:54-60,93-100`
`me()` ne rejette jamais sur erreur réseau : sans utilisateur en cache, elle résout avec `{ user: null }`, indiscernable d'une session absente. Un agent/client avec une coupure momentanée est éjecté vers `/login` ou voit le sélecteur de territoire se vider silencieusement, sans aucun message d'erreur réseau explicite — alors que c'est un comportement explicitement exigé par l'équipe produit.

**5. Dédoublonnage des transactions inopérant hors commande** — `backend/src/controllers/transaction.controller.js:372`
La règle « une transaction par nature, montant remplacé en cas de ressaisie » (`Transaction.findOne({ orderId, userId, type })`) n'est appliquée que si `order` existe. Pour une transaction liée à un projet/service/étape, aucune déduplication n'a lieu : chaque ressaisie crée une nouvelle ligne, doublant le bilan.

**6. Sommes multi-devises mélangées au dashboard** — `backend/src/controllers/dashboard.controller.js:346-406`
Le calcul `SUM(CASE WHEN type=...)` n'est pas groupé par devise, contrairement à `financialSummary.service.js:23-55` (utilisé par `/transactions/summary`). Un admin dont le périmètre couvre plusieurs pays/devises voit un total XOF+GHS+NGN additionné sans aucun sens.

**7. Montant d'une transaction de paiement jamais resynchronisé** — `backend/src/services/orderLifecycle.service.js:79-128`
Quand une transaction de paiement existe déjà pour une commande, seul `status` passe à `completed` ; `amount` n'est jamais réécrit. Si le total de la commande change ensuite (ajout d'article, taxe), le journal financier reste figé sur l'ancien montant.

**8. Endpoint de liste des articles de commande cassé** — `backend/src/controllers/orderItem.controller.js:351` vs `backend/models/orderItem.js:78`
La requête trie par `createdAt`, mais le modèle déclare `timestamps: false` (pas de colonne `createdAt`). Chaque appel à `GET /orders/:id/items` lève une erreur SQL — endpoint cassé pour tous les rôles.

**9. Réaffectation de phase de projet vers un projet d'un autre client** — `backend/src/controllers/projectPhase.controller.js:219`, `backend/src/validators/projectPhase.schemas.js:26-27`
`phase.update(req.body)` sans filtrage de champs ; le schéma autorise `projectId` en update, et le contrôle d'accès est vérifié sur l'**ancien** `projectId`, jamais sur la cible. Un client peut rattacher une phase à un projet qui n'est pas le sien — fuite/altération cross-tenant.

**10. Propriétaire bloqué hors de son propre bien** — `backend/src/controllers/property.controller.js:406,767-771,981-986`, `backend/src/utils/geoScope.js:216-240`
Le contrôle de scope géographique s'applique sans exception pour le client propriétaire (contrairement à `project.controller.js` qui exempte explicitement les clients), et retourne `false` par défaut si le compte n'a pas de `countryId`/`regionId` renseigné. Un client diaspora avec un bien « au pays » mais un compte à l'étranger reçoit un 403 sur son propre bien.

**11. Posture de sécurité prod dépendante d'une égalité exacte sur `NODE_ENV`** — `backend/src/app.js:61,69-86`, `backend/src/utils/validateProdConfig.js:34-38`
Si `NODE_ENV` est absent, mal orthographié ou différent de `'production'` strictement, tous les garde-fous (CORS restreint, force du secret JWT, jetons de métriques obligatoires) sont désactivés silencieusement, sans même un `logger.warn`. Une variable d'environnement mal recopiée lors de l'activation d'un nouveau pays expose l'API avec CORS ouvert et cookies acceptés depuis n'importe quelle origine.

---

## Constats élevés

**12. Suppression de preuve ImageKit : `ReferenceError` systématique masqué** — `backend/src/controllers/evidence.controller.js:857`
`imagekit.deleteFile(...)` référence un identifiant jamais importé dans ce fichier. Chaque suppression lève une exception, avalée par le `catch` voisin qui ne fait que logger un avertissement. La ligne DB est supprimée (succès renvoyé) mais le fichier reste orphelin, et le log masque la vraie cause.

**13. Annulation client impossible avant affectation d'un exécutant** — `backend/src/services/missionStatus.service.js:13-14`, `backend/src/controllers/mission.controller.js:108,1105-1107`
`CANCELLED_BY_CLIENT` n'est accessible que depuis `ASSIGNED`/`EN_ROUTE` dans le graphe de transitions, jamais depuis `CREATED`/`SEARCHING_EXECUTOR`. Un client ne peut pas annuler une course immédiatement après l'avoir commandée.

**14. Décrément de stock sans verrou (survente)** — `backend/src/controllers/orderItem.controller.js:266-296`, comparé à `order.controller.js:369-378`
La vérification + décrément de stock se fait sans transaction DB ni verrou de ligne lors de l'ajout d'un article, contrairement à la création de commande qui verrouille. Deux ajouts concurrents sur un produit à stock limité passent tous les deux le contrôle avant décrément.

**15. Litige : mutations multiples sans transaction** — `backend/src/controllers/dispute.controller.js:84-97,182-196`
Le changement de statut de la mission, la création/mise à jour du litige et les ajustements de badge prestataire sont des écritures séparées. Un échec DB après la transition de statut laisse la mission dans un état incohérent sans trace de litige.

**16. Clôture automatique de transaction sans justificatif** — `backend/src/controllers/transaction.controller.js:402-425`
L'exigence de preuve de paiement pour `status:'completed'` ne se déclenche que si le body contient explicitement ce statut. Le passage automatique via `order.status` (paid/delivered) contourne totalement ce contrôle.

**17. Double-soumission possible sur l'ajout d'article de commande** — `frontend/src/pages/OrderDetailPage.js:423-449,677-682`
`handleAddItem` n'a aucune garde anti-double-clic, contrairement à `handleUpload`/`handleOrderUpdate` dans le même fichier. Un double-clic crée deux lignes identiques.

**18. Géolocalisation tardive appliquée après changement d'écran** — `frontend/src/features/mobility/TaxiRideRequestForm.jsx:319-350`, `frontend/src/features/delivery/DeliveryRequestForm.jsx:308-341`, `frontend/src/features/mission-creation/steps/LocationStep.jsx:45-69`, `frontend/src/pages/MissionTrackingPage.js:463-490`
Ces quatre callbacks GPS asynchrones n'ont aucun flag de montage/annulation (contrairement au pattern correct déjà utilisé dans `ProviderAvailabilityPanel.jsx:48-60`). Une position qui arrive après que l'utilisateur a changé d'écran s'applique quand même — exactement le défaut que l'équipe produit dit avoir corrigé.

**19. Index de preuve non revalidé après rafraîchissement** — `frontend/src/pages/OrderDetailPage.js:267-290,942,1011`
La visionneuse de preuves garde un index ouvert qui n'est jamais revalidé si le polling de fond réduit la liste entre-temps (suppression concurrente). Accès à un élément `undefined` → plantage du rendu.

**20. Codes de récupération de compte générés mais totalement inopérants** — `backend/src/controllers/auth.controller.js:690-707,1060-1083`
`register()` génère et remet des codes de récupération en laissant croire qu'ils serviront en cas de perte d'accès. Mais `forgotPassword`, `resetPassword`, `recoverWithCode` et `regenerateRecoveryCodes` renvoient tous systématiquement `403 MANUAL_RESET_MESSAGE`. Fonctionnalité annoncée à l'utilisateur, totalement cassée côté API.

**21. Base de données temporaire orpheline à chaque répétition de sauvegarde** — `backend/src/services/backupRestore.service.js:81-121`
`rehearseRestore()` crée une base MySQL temporaire à chaque exécution et ne la supprime jamais (seul l'utilisateur temporaire est nettoyé). Chaque exécution planifiée de `npm run backup:rehearse` accumule une base orpheline supplémentaire.

**22. Bootstrap admin en prod sans contrôle de robustesse du mot de passe** — `backend/src/utils/bootstrapAdmin.js:18-43` vs `backend/src/utils/validateProdConfig.js`
Les variables réellement utilisées en prod (`BOOTSTRAP_ADMIN_ENABLED/EMAIL/PASSWORD`) ne sont jamais validées par `validateProdConfig.js` (qui ne couvre que les variantes `*_DEFAULT_*` réservées au dev). Un bootstrap activé en prod avec un mot de passe faible pour un dépannage ponctuel ne déclenche aucun garde-fou.

**23. Deux sources de vérité territoriale non synchronisées** — `backend/src/services/territorialSync.service.js:7-21`, `backend/src/controllers/country.controller.js` (create), `backend/src/controllers/region.controller.js` (create), vs `backend/src/services/pilotReadiness.service.js:73-91`, `backend/src/services/localCatalog.service.js`
Le modèle historique (`Country`/`Region`) et le modèle projeté (`Territory`/`Organization`/`Membership`) ne sont pas synchronisés automatiquement : créer un pays via l'API ne génère aucune ligne `Territory` tant que le script séparé `data:project-territories:apply` n'est pas lancé manuellement. Le catalogue local reste vide pour un nouveau pays apparemment activé.

---

## Constats moyens

**24.** Deux mécanismes anti-doublon indépendants coexistent sur `POST /missions` (`requestKey` historique vs en-tête `Idempotency-Key`), la protection la plus faible restant utilisable seule — `backend/src/controllers/mission.controller.js:43-57,278,509`, `backend/src/middleware/creationRequest.middleware.js`.

**25.** `service.controller.js` recopie en dur la liste des statuts terminaux au lieu d'importer la constante partagée `MISSION_HISTORY_STATUSES` — `backend/src/controllers/service.controller.js:382,387`. Risque de divergence silencieuse si la constante évolue.

**26.** La preuve de réalisation requise avant `delivered` pour une commande n'est pas filtrée par type (`kind`), contrairement à un projet — `backend/src/services/workCoordination.service.js:21-24`. N'importe quelle preuve, même sans rapport, satisfait la clôture.

**27.** Deux blocs distincts de réassignation de territoire sur une commande, l'un avec garde d'historique et validation, l'autre (admin global) sans aucune des deux — `backend/src/controllers/order.controller.js:570-586` vs `601-616`. Risque de régression si un seul des deux blocs est corrigé.

**28.** Routes `properties` toutes restreintes à `client`/`admin`, alors que le contrôleur contient une branche entière dédiée au rôle `agent` — `backend/src/routes/property.routes.js:29-50` vs `backend/src/controllers/property.controller.js:454-458`. ACL incohérente entre route et contrôleur.

**29.** Recalcul des totaux de commande dupliqué en deux implémentations quasi identiques, l'une transactionnelle, l'autre non — `backend/src/controllers/order.controller.js:316-333` vs `backend/src/controllers/orderItem.controller.js:192-222`.

**30.** `recomputeTotals` appelé hors de la transaction qui protège ensuite la sauvegarde de la commande — `backend/src/controllers/order.controller.js:618`.

**31.** `userId` d'une transaction non resynchronisé quand elle est relink vers un projet différent (seulement géré pour `orderId`) — `backend/src/controllers/transaction.controller.js:680-687`.

**32.** `project.budget` assigné sans passer par un convertisseur numérique sécurisé, contrairement au reste du contrôleur — `backend/src/controllers/project.controller.js:510-511`.

**33.** Position GPS live d'un prestataire : `findOne` + `create`/`update` sans transaction ni contrainte d'unicité exploitée — `backend/src/services/providerPresence.service.js:62-67`. Deux pings quasi simultanés créent deux lignes pour le même prestataire.

**34.** Photos de bien uploadées avant le contrôle de scope géographique admin ; aucun nettoyage sur rejet — `backend/src/controllers/property.controller.js:631,663-691`. Fichiers orphelins accumulés sur rejet.

**35.** Route publique sans authentification exposant les pays actifs et leurs numéros de contact — `backend/src/routes/franchise.routes.js:30` (`GET /franchises/masters`), alors que toutes les routes sœurs exigent `requirePermission`.

**36.** Listes de rôles divergentes entre deux fils « personnels » équivalents : `activity.routes.js` exclut `provider`/`category_manager`, `notification.routes.js` les inclut — incohérence d'accès pour ces rôles.

**37.** Boucle séquentielle de requêtes DB par agent dans l'audit de préparation territoriale (N+1) — `backend/src/services/fieldReadiness.service.js:69-72`.

**38.** Job cron de seuil de mission : requêtes `TradeCategory`/`MissionStatusHistory` individuelles par mission au lieu d'un batch — `backend/src/jobs/missionThresholdCheck.job.js:56-61`.

**39.** Code mort de réinitialisation de mot de passe par email (`isSmtpConfigured`, `sendPasswordResetEmail`, etc.) jamais appelé, alors que le README documente toujours la configuration SMTP comme requise — `backend/src/controllers/auth.controller.js:382-420`.

**40.** Routes self-service (`/auth/me`, `/auth/change-password`...) reconstruisent `req.user` uniquement depuis le payload JWT signé, sans relecture DB — un changement de rôle/territoire après émission du token n'est pas reflété avant expiration — `backend/src/middleware/auth.middleware.js:19-30,99-113`.

**41.** Création de pays sans déclenchement ni garde-fou sur la préparation territoriale ; message d'erreur d'activation prématurée qui ne mentionne pas la cause réelle — `backend/src/controllers/country.controller.js` (create, ~L190-243).

**42.** Suppression de galerie produit sur ImageKit : erreurs avalées silencieusement (`catch (_) {}`), appels séquentiels (N+1) — `backend/src/controllers/product.controller.js:526-534,596-604`.

**43.** Aucune métrique exposée sur les missions ignorées faute de seuil configuré sur leur filière — `backend/src/jobs/missionThresholdCheck.job.js:59`. Une filière mal configurée ne déclenche jamais d'alerte visible.

**44.** `DossiersPage` ne se remonte pas au changement de territoire, contrairement à toutes les pages sœurs qui utilisent `key={JSON.stringify([user, countryId, regionId])}` — `frontend/src/pages/DossiersPage.jsx:36-54`. Les compteurs restent ceux de l'ancien territoire jusqu'au rechargement complet.

**45.** Message d'accès refusé trompeur : si `me()` échoue par panne réseau, l'espace financier affiche « réservé aux clients/agents/admins » au lieu d'une erreur réseau — `frontend/src/features/finance/FinancialWorkspace.jsx:67-71` (conséquence du constat 4).

**46.** Script backend `start-https-recette-test.js` dépend d'un module du `node_modules` du **frontend** (`selfsigned`), non déclaré dans aucun `package.json` — fragile en CI (`backend/scripts/start-https-recette-test.js:49`).

**47.** Les tests d'intégration `client-requests` ne couvrent que `executionType:'agent'`, jamais `'provider'`, alors que le service calcule le nom de l'exécutant différemment selon ce champ — `backend/tests/integration/client-requests.test.js`.

**48.** Le mock e2e (`mockApi.js`) n'a aucun handler générique pour `/missions/mine` ; chaque spec réimplémente son propre filtrage divergent, et toute nouvelle spec sans interception explicite reçoit un `{ok:true}` qui fait planter le composant au lieu d'un échec clair.

**49.** `openapi.json` documente les nouvelles routes (`/requests`, `/missions/mine`...) mais reste silencieux sur des dizaines de routes actives plus anciennes (`/properties`, `/orders`, `/projects`, `/mission-requests`, `/property-listings`...).

---

## Constats faibles

**50.** Comparaison du jeton `X-Metrics-Token` par égalité stricte, non en temps constant (risque théorique, route déjà protégée par auth+rôle admin en amont) — `backend/src/middleware/metrics.middleware.js:450-454`.

**51.** Aucune route `DELETE /franchises/:id`, contrairement aux ressources sœurs `country`/`region` qui en ont une — incohérence de surface d'API non documentée comme volontaire.

**52.** Requête DB inutile systématiquement exécutée même quand aucune organisation n'est concernée — `backend/src/services/pilotReadiness.service.js:85-89`.

**53.** `property.controller.js` (detail) s'appuie sur la restriction de rôle au niveau route plutôt que sur une vérification explicite en contrôleur — fragile si la route est un jour ouverte à `agent` sans relire le contrôleur.

**54.** Le service d'audit géographique (`geoIntegrity.service.js`) ne couvre pas `Provider`/`Vehicle`/`ServiceAvailability`, pourtant soumis au même scope territorial ailleurs dans le code.

**55.** Route `POST /projects/assign` écrite en handler inline avec `require()` à l'intérieur de la fonction, seule route du module à ne pas déléguer à un contrôleur dédié — divergence de style.

**56.** État `Task.status:'cancelled'` présent dans le modèle mais inaccessible : aucune transition ni endpoint ne l'utilise — fonctionnalité d'annulation de tâche absente alors que le modèle la laisse supposer disponible.

**57.** Devise par défaut vide (`''`) au lieu de `'XOF'` dans `RequestAmounts.jsx:8`, contrairement à tous les composants équivalents (`TransactionCard`, `OrdersWorkspace`, `OrderDetailPage`) — affichage de montant sans unité dans certains cas.

**58.** `frontend/src/pages/ClientHome.jsx` : composant mort, plus importé nulle part, contient un lien vers une route retirée du menu — risque de confusion pour un futur mainteneur.

**59.** `WorkAssignmentCard.jsx:23` ne transmet pas `state={{from}}` au lien vers le dossier, contrairement aux autres cartes de liste — le retour depuis un dossier ouvert par un agent le ramène à la mauvaise page.

**60.** `NavBar.js` conserve une entrée d'icône et un appel pour `/dossiers`, route qui n'existe plus dans `ROLE_LINKS` — code mort inoffensif mais trompeur.

**61.** Boutons « Marquer livré »/« Annuler » sans `disabled` pendant la requête, contrairement au bouton « Marquer payé » juste au-dessus (la garde réseau existe, seul le retour visuel diffère) — `frontend/src/pages/OrderDetailPage.js:938-939` vs `928`.

**62.** Échec de sauvegarde de la langue préférée limité à `console.warn`, sans notification utilisateur — l'interface change immédiatement comme si c'était sauvegardé côté serveur — `frontend/src/components/LanguageSwitcher.js:43-50`.

**63.** Nouveau document `docs/SYNTHESE_SIMPLIFICATION_ET_TRANSPOSITION_SANTE_2026-10-27.md` jamais lié depuis le README, contrairement à tous ses documents frères du même lot.

**64.** Quatre nouveaux composants partagés (`ClientRequestCard`, `CollectionFilters`, `TopbarAccountMenu`, `formStyles.js`) sans test unitaire dédié, couverts seulement par des specs e2e plus coûteuses.

**65.** Code mort pré-existant jamais nettoyé malgré le gros lot de suppression : `frontend/src/components/FinanceWidget.js` et `frontend/src/components/ProtectedRoute.js`, non importés nulle part dans le dépôt.

---

## Priorisation recommandée

**Lot 1 — Sécurité et argent (à traiter en premier) :** constats 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11. Ce sont les seuls qui faussent des bilans financiers, cassent un endpoint pour tout le monde, exposent une faille de sécurité en prod, ou contredisent une règle métier centrale (justificatif avant clôture).

**Lot 2 — Fiabilité utilisateur visible :** constats 12 à 23 (déconnexions fantômes déjà comptées en synthèse, GPS tardif, double-soumission, codes de récupération cassés, litiges sans transaction, survente de stock).

**Lot 3 — Cohérence interne et dette technique :** constats 24 à 49 (duplications de logique, incohérences de rôles/ACL, N+1, code mort fonctionnel, couverture de tests).

**Lot 4 — Nettoyage :** constats 50 à 65 (style, code mort inoffensif, documentation orpheline).

---

## Suivi des corrections — lot 1

Les 11 constats critiques ont été corrigés le 3 novembre 2026, chacun avec un test dédié (unitaire ou d'intégration contre une vraie base MySQL locale). Validation finale : **647 tests backend (90 suites) et 423 tests interface (81 suites), tous passants**, incluant la suite d'intégration complète (26 fichiers, 245 tests).

- **1 (justificatif de clôture).** Corrigé dans `missionCoordination.service.js` : `completionReportRequired` ne dépend plus du flag d'affectation automatique, uniquement de la filière (tout sauf mobilité **et livraison**, qui ont leur propre modèle de preuve — l'exclusion initiale ne couvrait que la mobilité, complétée après qu'un test existant a révélé l'oubli de la livraison). Vérifié avec une mission affectée manuellement, sans ligne de coordination.
- **2 (RESOLVED_REDO sans issue).** Ajout de l'arête `RESOLVED_REDO → SEARCHING_EXECUTOR` dans la machine à états, avec réinitialisation de l'exécutant (`providerId`/`agentId`/`vehicleId`/`acceptanceDeadlineAt`) lors de cette transition précise. Retiré de `MISSION_HISTORY_STATUSES` (un litige "à refaire" n'est pas archivé). `service.controller.js` utilise désormais la constante partagée au lieu d'une copie codée en dur (corrige au passage la divergence du constat 25).
- **3 (comptes dupliqués par téléphone).** Contrainte UNIQUE ajoutée en base (migration, appliquée) ; les trois points de création/mise à jour concernés (`register`, `updateMe`, demande invitée) traduisent désormais une violation de contrainte en réponse propre (400/409) au lieu d'un 500.
- **4 (déconnexions fantômes).** `auth.js::me()` distingue maintenant panne réseau (`offline:true`) de session absente ; `MyMissionsPage`, `OrdersWorkspace`, `FinancialWorkspace` et `GeoContext`/`GeoSelector` affichent une erreur réseau avec reprise au lieu de déconnecter ou d'afficher un refus d'accès trompeur.
- **5 (déduplication des transactions).** **Constat corrigé après investigation** : étendre la règle « une transaction par nature » aux projets/services/tâches (comme proposé initialement) a été testé contre le comportement réel attendu de l'API et s'est révélé incorrect — un service ou un projet peut légitimement porter plusieurs écritures distinctes du même type (confirmé par un test d'intégration existant créant volontairement deux dépenses sur un même service). La règle reste donc **spécifique aux commandes**, comme dans le code d'origine ; aucun changement de comportement ici.
- **6 (sommes multi-devises).** `dashboard.controller.js` groupe désormais par devise ; en cas de pluralité, les totaux agrégés renvoient `null` plutôt qu'une somme erronée, et `byCurrency` expose le détail fiable.
- **7 (montant de paiement figé).** `orderLifecycle.service.js` resynchronise l'amount de la transaction de paiement avec le total réel de la commande, même quand elle était déjà `completed`.
- **8 (endpoint cassé).** Tri par `id` au lieu de `createdAt` (colonne inexistante) dans `orderItem.controller.js` ; confirmé contre la vraie base (`ER_BAD_FIELD_ERROR` reproduit puis résolu).
- **9 (réaffectation de phase cross-tenant).** `projectPhase.controller.js` rejette désormais tout `projectId` dans le corps de la requête qui ne reconfirme pas le projet déjà propriétaire de la phase.
- **10 (propriétaire bloqué par le scope géo).** `property.controller.js` (detail/update/remove) exempte désormais le propriétaire confirmé du contrôle de scope géographique.
- **11 (CORS/NODE_ENV).** Nouvelle fonction `resolveNodeEnvPosture` (`runtimeEnv.js`) : toute valeur de `NODE_ENV` non reconnue est traitée comme production (stricte) plutôt que de retomber silencieusement sur la posture permissive de développement, dans `app.js` et `validateProdConfig.js`.

## Suivi des corrections — lots 2 à 4

Les constats 12 à 65 ont été traités le 3-4 novembre 2026, avec la même discipline que le lot 1 : correction testée (unitaire ou d'intégration), ou **retrait motivé** quand l'investigation a montré que le constat initial était inexact ou que le « correctif » aurait cassé un comportement intentionnel confirmé par un test existant. Validation finale après l'ensemble des lots : **680 tests backend (98 suites) et 442 tests interface (84 suites), tous passants**.

### Lot 2 — Fiabilité utilisateur visible (12 à 23)

- **12 (suppression ImageKit cassée).** Import manquant ajouté dans `evidence.controller.js` ; `imagekit.deleteFile` → `imageKit.deleteFile`.
- **13 (annulation client impossible avant affectation).** Déjà résolu comme effet de bord de la correction du constat 2 (lot 1) : les arêtes `CREATED → CANCELLED_BY_CLIENT` et `SEARCHING_EXECUTOR → CANCELLED_BY_CLIENT` ont été ajoutées en même temps que `RESOLVED_REDO → SEARCHING_EXECUTOR` dans `missionStatus.service.js`.
- **14 (survente par décrément de stock non verrouillé).** `orderItem.controller.js` : ajout d'une transaction et d'un verrou de ligne sur le décrément, aligné sur `order.controller.js`.
- **15 (litige sans transaction).** `dispute.controller.js` : `create()` et `update()` enveloppés dans `sequelize.transaction()`.
- **16 (clôture automatique sans justificatif) — constat retiré.** Investigation : le même schéma (clôture automatique sans preuve, déclenchée uniquement par un statut explicite du body) existe délibérément dans `orderLifecycle.service.js::syncOrderPaymentTransaction`, documenté par un commentaire explicite sur le comportement historique des commandes. Comportement intentionnel, aucun changement.
- **17 (double-soumission ajout d'article).** Garde `itemAddInFlight`/`addingItem` ajoutée dans `OrderDetailPage.js`, alignée sur `handleOrderUpdate`.
- **18 (GPS tardif après changement d'écran).** Pattern de ref de montage (« alive ») ajouté aux quatre callbacks GPS asynchrones (`TaxiRideRequestForm.jsx`, `DeliveryRequestForm.jsx`, `LocationStep.jsx`, `MissionTrackingPage.js`).
- **19 (index de preuve non revalidé).** Accesseur sûr `currentEvidence` + `useEffect` de recadrage de l'index ajoutés dans `OrderDetailPage.js`.
- **20 (codes de récupération inopérants).** Génération de codes de récupération retirée de `register()` plutôt que de réparer une fonctionnalité entièrement désactivée côté API (`403 MANUAL_RESET_MESSAGE` partout) — cohérent avec le message produit déjà affiché.
- **21 (base temporaire orpheline) — constat retiré.** La suppression de la base en fin de `rehearseRestore()` casse le test qui s'y connecte ensuite pour vérifier les données restaurées (`report.readyForDataReview` signifie littéralement « prête pour relecture humaine », ce qui exige que la base persiste). Comportement intentionnel, correctif annulé.
- **22 (bootstrap admin prod sans contrôle de robustesse).** `validateProdConfig.js` : validation ajoutée sur `BOOTSTRAP_ADMIN_PASSWORD` (longueur minimale 16, renommage `WEAK_JWT_SECRETS` → `WEAK_CREDENTIAL_VALUES` pour couvrir ce nouveau cas).
- **23 (deux sources de vérité territoriale).** Message d'erreur `PILOT_COUNTRY_NOT_FOUND` enrichi avec la commande de remédiation réelle (`pilotReadiness.service.js`). La synchronisation automatique complète (création de pays → projection `Territory` immédiate) n'a pas été construite : c'est un changement d'architecture plus large que ce lot, et `country.controller.js::update` déclenche déjà `syncCountryTerritories` dès la première mise à jour (notamment l'activation), ce qui couvre le chemin réel d'activation d'un pays.

### Lot 3 — Cohérence interne et dette technique (24 à 49)

- **24 (double mécanisme anti-doublon) — constat retiré.** `requestKey` (contrainte UNIQUE) et `Idempotency-Key` (réservation préalable) sont chacun indépendamment sûrs contre les races ; duplication de code en cours de migration, pas de faille de sécurité réelle.
- **25 (liste de statuts recopiée).** Déjà corrigé en lot 1 au passage de la correction du constat 2 (`service.controller.js` importe désormais `MISSION_HISTORY_STATUSES`).
- **26 (preuve non filtrée par type pour une commande).** `workCoordination.service.js` : filtre `kind: {[Op.in]: ['photo','document']}` ajouté, aligné sur le traitement des projets.
- **27 (double bloc de réassignation géo).** Second bloc redondant et non gardé supprimé dans `order.controller.js`.
- **28 (ACL route/contrôleur incohérente pour `agent`).** Rôle `agent` ajouté aux routes `GET /properties` et `GET /properties/:id`.
- **29 (recalcul de totaux dupliqué) — non consolidé, documenté.** `recomputeTotals` (`order.controller.js`) et `recomputeOrderTotals` (`orderItem.controller.js`) restent deux implémentations séparées ; chacune est désormais correcte individuellement (transaction ajoutée des deux côtés, constats 14 et 30), mais leur fusion en un seul helper partagé est un refactor plus large volontairement laissé hors de ce lot pour ne pas risquer de régression sur un chemin financier sans bénéfice fonctionnel immédiat.
- **30 (recompute hors transaction).** `recomputeTotals` appelé désormais à l'intérieur de la transaction qui protège la sauvegarde de la commande.
- **31 (userId non resynchronisé au relink).** Resynchronisation ajoutée pour les relinks projet/service/tâche dans `transaction.controller.js`, symétrique au traitement déjà existant pour `orderId`.
- **32 (budget projet sans convertisseur sûr).** Helper `toNullableNumber()` ajouté et appliqué au champ `budget` dans `project.controller.js` (create/update).
- **33 (position GPS prestataire sans transaction).** `providerPresence.service.js` : `try/catch` avec reprise sur `SequelizeUniqueConstraintError` (nouveau `findOne` de secours) pour absorber la course entre deux pings quasi simultanés.
- **34 (photos uploadées avant contrôle de scope, sans nettoyage).** Appels `deleteImageKitFiles(photos)` ajoutés avant chaque retour de rejet pour scope géographique dans `property.controller.js`.
- **35 (route publique sans authentification) — constat retiré.** Les consommateurs frontend (`RegisterPage.js`, formulaires de mission invités) appellent cet endpoint **avant** authentification — il doit être public par construction.
- **36 (listes de rôles divergentes).** `activity.routes.js` aligné sur `notification.routes.js` (`personalRoles` incluant désormais `provider`/`category_manager`).
- **37 (N+1 préparation territoriale).** Fonction `agentLoadBatch(userIds, transaction)` ajoutée à `agentCapacity.service.js`, utilisée par `fieldReadiness.service.js` à la place des appels individuels.
- **38 (N+1 job de seuil de mission).** Fonction de batch `loadLastTransitionAtByServiceId` ajoutée à `missionThresholdCheck.job.js`, remplaçant les requêtes individuelles par mission.
- **39 (code mort réinitialisation par email).** Bloc mort entier supprimé de `auth.controller.js` (~100 lignes : `nodemailer`, `PasswordResetToken`, constantes et fonctions associées) ; README mis à jour pour ne plus documenter une configuration SMTP qui n'est plus utilisée.
- **40 (`req.user` reconstruit depuis le JWT sans relecture) — constat retiré.** `exports.me` relit toujours la base ; les autres handlers self-service n'utilisent que le champ stable `id`, jamais le rôle/territoire potentiellement obsolète. Aucun impact observable.
- **41 (création de pays sans déclenchement territorial).** Vérifié : les pays sont créés `isActive:false`, et toute activation passe nécessairement par `update()`, qui déclenche déjà `syncCountryTerritories`. Le vrai manque était le message d'erreur, déjà corrigé par le constat 23.
- **42 (suppression galerie produit silencieuse).** `product.controller.js` : `catch (_) {}` remplacé par `Promise.all(...).catch(err => logger.warn(...))` (update et remove).
- **43 (aucune métrique sur seuils manquants).** Compteurs `skippedNoThreshold`/`tradeCategoryIdsWithoutThreshold` ajoutés et logués dans `missionThresholdCheck.job.js`.
- **44 (`DossiersPage` non remonté au changement de territoire).** Pattern `key={JSON.stringify([...])}` ajouté, aligné sur les pages sœurs.
- **45 (message d'accès refusé trompeur en cas de panne réseau).** `FinancialWorkspace.jsx` affiche désormais une erreur réseau explicite au lieu de « réservé aux clients/agents/admins » (conséquence du constat 4, lot 1).
- **46 (dépendance cross-package `selfsigned`).** Déclarée dans `backend/package.json` (devDependencies) et `start-https-recette-test.js` importe désormais le module local au lieu de celui du frontend.
- **47 (couverture de test incomplète `executionType`).** Non traité séparément dans ce lot : signalé pour suivi, car l'ajout du cas `'provider'` touche une fixture d'intégration partagée ; voir note de clôture ci-dessous.
- **48 (mock e2e sans handler générique `/missions/mine`).** Non traité dans ce lot (périmètre e2e Playwright, non exécuté dans cette session) ; voir note de clôture ci-dessous.
- **49 (OpenAPI silencieux sur des routes actives).** `description` ajoutée à `info` dans `openapi.json`, listant explicitement les familles de routes documentées vs non documentées, pour que le silence soit déclaré plutôt qu'implicite.

### Lot 4 — Nettoyage (50 à 65)

- **50 (comparaison de jeton non constante).** `metrics.middleware.js` : `timingSafeEqualStrings()` basé sur `crypto.timingSafeEqual` ajouté pour la comparaison du jeton de métriques.
- **51 (absence de `DELETE /franchises/:id`).** Documenté par un commentaire explicite dans `franchise.routes.js` : absence volontaire, suppression gérée par changement de statut (soft-delete), pas un oubli.
- **52 (requête DB inutile si aucune organisation).** Garde ajoutée dans `pilotReadiness.service.js` (`organizationIds.length ? ... : []`).
- **53 (ACL implicite dans `property.controller.js::detail`) — vérifié plutôt que modifié.** Le chemin par défaut (ni propriétaire, ni admin global) passe déjà par le contrôle `canAccessByGeoScope`, qui s'applique correctement à `agent` sans branche dédiée — confirmé après l'ajout du rôle `agent` à la route (constat 28). Aucune régression, aucune branche supplémentaire nécessaire.
- **54 (audit géo sans `Provider`/`Vehicle`/`ServiceAvailability`).** Investigué sans correctif superficiel : `Provider` utilise `countryCode` (chaîne) et `ServiceAvailability` utilise `territoryId`, aucun des deux ne correspond au système de détection de colonnes `countryId`/`regionId` de l'outil — les ajouter à la liste de politiques serait un no-op. Corriger réellement exige d'étendre la logique de détection elle-même ; documenté plutôt que simulé.
- **55 (route inline avec `require()` local).** `project.routes.js` : imports déplacés en tête de fichier, commentaire obsolète sur une « circularité » jamais vérifiée retiré.
- **56 (statut `Task.cancelled` inaccessible).** Corrigé : `allowedTransitions` dans `task.controller.js::updateStatus` autorise désormais `created → cancelled` et `in_progress → cancelled` (les statuts terminaux `completed`/`validated`/`cancelled` restent sans sortie). Aucun test n'existait pour ce contrôleur ; 5 tests unitaires ajoutés (`task.controller.updateStatus.test.js`) couvrant l'annulation autorisée, son indisponibilité une fois la tâche terminée, le caractère terminal de `cancelled`, et le refus pour un client non créateur.
- **57 (devise par défaut vide).** `RequestAmounts.jsx` : `request.currency || ''` → `request.currency || 'XOF'`.
- **58 (`ClientHome.jsx` mort).** Supprimé avec son test, après confirmation qu'aucune référence ne subsistait.
- **59 (retour de navigation incorrect depuis `WorkAssignmentCard`).** Prop `from` ajoutée et propagée (`state={{from}}`) depuis `AgentCoordinationPanel.jsx` et `WorkProgressPanel.jsx` (via `useLocation`), alignée sur le pattern déjà utilisé par `ClientRequestCard`/`TransactionCard`.
- **60 (icône morte `/dossiers` dans `NavBar.js`).** Les deux références mortes supprimées (`ICON_BY_PATH_PREFIX`, regroupement `buildSections`). **Constat affiné en cours d'investigation :** `DossiersPage.jsx` et sa route `/dossiers` restent déclarées dans `App.js` mais ne sont plus atteignables par aucun lien de l'interface depuis le retrait de l'entrée `/dossiers` de `ROLE_LINKS.client` (remplacée par un lien direct vers `/properties`). Cette page n'a pas été supprimée : décider de la restaurer dans la navigation ou de la retirer est un choix produit qui dépasse un nettoyage de code mort et mérite une décision explicite plutôt qu'une suppression silencieuse.
- **61 (boutons sans `disabled` pendant la requête).** `disabled={updatingOrder}` ajouté aux boutons « Marquer livré » et « Annuler » dans `OrderDetailPage.js`.
- **62 (échec de sauvegarde de langue silencieux).** Notification `notify.warning(t('language.saveError'))` ajoutée en cas d'échec, nouvelles clés i18n `language.saveError` (fr/en). 3 tests unitaires ajoutés (`LanguageSwitcher.test.js`).
- **63 (document orphelin non lié).** `docs/SYNTHESE_SIMPLIFICATION_ET_TRANSPOSITION_SANTE_2026-10-27.md` ajouté au README, à côté de ses documents frères du 27 octobre.
- **64 (composants partagés sans test dédié).** Tests ajoutés pour les trois composants porteurs de logique : `ClientRequestCard.test.jsx` (6 tests), `CollectionFilters.test.jsx` (4 tests), `TopbarAccountMenu.test.jsx` (6 tests). `formStyles.js` exclu : c'est une constante CSS sans aucune logique, un test n'aurait vérifié qu'une égalité de chaîne.
- **65 (code mort pré-existant).** `frontend/src/components/FinanceWidget.js` et `ProtectedRoute.js` supprimés après confirmation qu'aucune référence ne subsistait dans le dépôt.

### Ce qui reste ouvert

Deux points n'ont délibérément pas été traités dans ce lot, faute de rentrer dans le périmètre « code + tests unitaires/intégration » suivi jusqu'ici :
- **47** (couverture de test `executionType:'provider'` manquante dans `client-requests.test.js`) et **48** (mock e2e sans handler générique `/missions/mine`) touchent respectivement une fixture d'intégration partagée et la suite Playwright, non exécutée dans cette session.
- **60** (devenir de `DossiersPage.jsx`) reste une décision produit ouverte : restaurer son accès depuis la navigation client, ou retirer la page et sa route.
