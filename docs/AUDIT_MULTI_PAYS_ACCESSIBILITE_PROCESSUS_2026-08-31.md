# Audit multi-pays, accessibilité et processus Teranga

Date : 31 août 2026  
Périmètre : application web, API, modèle de données, expérience client, opérations administratives et terrain.  
Nature : audit d’architecture et de produit fondé sur le dépôt actuel. Ce document ne constitue pas un audit juridique pays par pays.

## 1. Décision exécutive

Teranga possède déjà un bon noyau de confiance : demande omnicanale, exécution suivie, preuves, statuts, litiges, prestataires vérifiés, parcours téléphone et comportement adapté au réseau faible. C’est une base différenciante et cohérente avec la vision panafricaine.

En revanche, le projet n’est pas encore prêt à être répliqué de manière sûre dans plusieurs pays et régions. Le multi-pays actuel est principalement un ensemble de colonnes `countryId` / `regionId` et de filtres répartis dans les contrôleurs. Il manque encore trois fondations structurantes :

1. une vraie isolation organisationnelle entre siège, franchisés et territoires ;
2. un catalogue local configurable, séparé des demandes et des missions ;
3. un système opératoire documenté reliant chaque état applicatif à une procédure terrain, un responsable, une preuve et un délai.

La priorité recommandée n’est donc pas d’ajouter de nouveaux services. Il faut d’abord consolider le « Teranga Operating System » autour d’un moteur unique de demandes/missions, d’un modèle territorial strict et de processus opérationnels mesurables.

### Niveau de maturité estimé

| Domaine | Niveau actuel | Cible avant deuxième pays |
|---|---:|---:|
| Noyau de mission et traçabilité | 4/5 | 5/5 |
| Multi-pays fonctionnel | 2/5 | 4/5 |
| Isolation et autorisations territoriales | 2/5 | 5/5 |
| Franchise et gouvernance réseau | 1/5 | 4/5 |
| Simplicité de l’expérience client | 3/5 | 4/5 |
| Accessibilité numérique | 2,5/5 | 4/5 (WCAG 2.2 AA) |
| Résilience réseau faible | 3,5/5 | 4/5 |
| Processus terrain et SOP | 1,5/5 | 4/5 |
| Mesure de la qualité opérationnelle | 2,5/5 | 4/5 |
| Préparation à l’expansion panafricaine | 2/5 | 4/5 |

## 2. État réel observé

### 2.1 Points forts à préserver

- Le moteur de mission possède une machine d’état explicite et un historique horodaté.
- Les statuts critiques sont transactionnels, avec contrôle de concurrence lors des transitions.
- Les missions peuvent être créées par l’application, par un opérateur téléphonique ou comme invité.
- La destination réelle de la mission peut différer du pays du client, ce qui est indispensable pour la diaspora.
- L’application prend en compte l’absence de GPS, les adresses informelles et les connexions instables.
- Les photos, documents, positions et notes vocales soutiennent la preuve terrain.
- Les litiges comportent accusé de réception, relances et escalade.
- Les prestataires disposent d’un onboarding, de pièces de conformité, d’un statut et d’une notation.
- L’application est responsive, possède une PWA légère et expose des alternatives téléphone/WhatsApp.
- Les contrôles automatiques actuels sont sains : lint backend et frontend réussis ; 43 suites / 215 tests backend et 30 suites / 87 tests frontend réussis lors de l’audit.

### 2.2 Signaux de complexité

- Le frontend contient 67 déclarations de routes et 75 fichiers dans `src/pages`.
- Plusieurs très grandes pages dépassent 900 à 1 400 lignes, ce qui concentre logique métier, requêtes, formulaires et affichage.
- La navigation expose directement des objets internes : services, tâches, transactions, finances, commandes, projets, biens, courses et livraisons.
- Le mot « service » désigne à la fois une offre, une demande client, une mission à exécuter et la table historique `services`.
- Deux systèmes de statut cohabitent encore dans une même mission : `status` historique et `missionStatus` moderne.
- Les modules produits/commandes et missions/livraison restent techniquement séparés.
- Les règles de périmètre géographique sont répétées dans plusieurs contrôleurs et utilitaires.

Cette complexité est encore gérable dans un pilote, mais elle multipliera les erreurs de configuration, de formation et d’autorisation à chaque nouveau pays.

## 3. Audit multi-pays et multi-région

### 3.1 Modèle actuel

Le projet possède les entités suivantes :

- `Country` : nom, ISO2, devise, langue par défaut, activation, téléphone de contact ;
- `Region` : pays, nom, code, activation, téléphone ;
- `Franchise` : type MASTER ou REGIONAL, pays, région optionnelle, raison sociale, statut ;
- `User` : un pays et une région optionnels, avec un rôle technique ;
- la plupart des objets métier : `countryId` et `regionId` optionnels ;
- `Provider` : un `countryCode`, sans couverture régionale ;
- `TradeCategory` et règles de prix : portée pays/région possible.

Le rôle « master » n’est pas un rôle propre : il correspond à un administrateur ayant un pays ou une région. Un administrateur sans scope est global.

### 3.2 Risques bloquants avant expansion

#### P0 — L’isolation territoriale n’est pas une invariant centrale

Les colonnes géographiques sont encore nullable pour la compatibilité historique. Les filtres sont appliqués contrôleur par contrôleur et certains incluent volontairement une ressource sans région dès que son pays correspond. Un master régional peut donc voir une donnée `regionId = NULL` du même pays. Ce choix évite de perdre les données mal géocodées, mais il transforme une erreur de qualité de données en élargissement d’accès.

Conséquences :

- une nouvelle route peut oublier le filtre ;
- les comportements peuvent différer entre liste, détail, export et dashboard ;
- une donnée orpheline ou mal classée peut devenir visible trop largement ;
- les tests doivent connaître toutes les exceptions historiques ;
- il est difficile de prouver contractuellement l’isolation d’un franchisé.

Décision cible : « deny by default ». Une ressource sans territoire valide va dans une file de quarantaine visible par le siège, pas dans le périmètre régional par défaut.

#### P0 — La franchise n’est pas propriétaire des opérations

`Franchise` n’est reliée ni aux utilisateurs, ni aux missions, ni aux encaissements, ni aux prestataires. Elle représente aujourd’hui surtout l’existence d’une entité locale. Elle ne permet pas de répondre de façon fiable à :

- quelle entité contractuelle opère cette mission ?
- quel franchisé doit recevoir la commission ?
- quel responsable porte le SLA et le litige ?
- quel catalogue et quels prix lui appartiennent ?
- quel utilisateur peut agir pour plusieurs territoires ou plusieurs entités ?

#### P0 — Un utilisateur ne peut avoir qu’un seul scope

Le couple `User.countryId` / `User.regionId` est adapté à un pilote simple, pas à un réseau : un responsable national peut superviser plusieurs régions, un auditeur peut couvrir plusieurs pays, et un opérateur de nuit peut servir plusieurs zones. Le système a besoin d’adhésions M:N avec rôle, organisation, territoire et dates de validité.

#### P0 — La portée des prestataires s’arrête au pays

Un prestataire porte un pays ISO, mais pas une liste de zones couvertes. Une mission à Kayes et une mission à Bamako sont donc équivalentes pour l’éligibilité pays, alors que disponibilité, distance, réglementation et coût sont locaux.

#### P1 — La configuration pays est trop faible

Le pays ne porte pas encore :

- fuseau horaire IANA ;
- locales et langues activées ;
- indicatif téléphonique et règles de numérotation ;
- schéma d’adresse local ;
- formats de date/nombre ;
- jours ouvrés et jours fériés ;
- moyens de paiement autorisés ;
- règles de taxe et référence légale ;
- entité juridique opératrice ;
- politique de conservation et de transfert des données ;
- contacts urgence, litige et protection des données ;
- feature flags et date de lancement.

La devise existe, mais plusieurs créations continuent à retomber sur `XOF`. La liste backend accepte XOF, XAF, EUR, USD et GBP ; elle ne couvre donc pas encore tous les pays africains. Les dates sont formatées selon la langue de l’interface, sans fuseau du pays d’exécution.

#### P1 — Le référentiel régional est libre et approximatif

Le rapprochement entre région interne et résultat de géocodage est basé sur le nom et une comparaison floue. Cela peut fonctionner au Mali, mais devient fragile avec les homonymes, langues multiples, réformes administratives et niveaux différents (district, province, gouvernorat, cercle).

Il faut un territoire canonique avec : code stable, type administratif, parent, alias multilingues et identifiants de fournisseurs cartographiques.

#### P1 — Les contraintes physiques sont insuffisantes

Le projet a historiquement évité les clés étrangères pour la compatibilité PlanetScale/imports. Sur une base MySQL managée, cette décision doit être réévaluée. Sans contrainte, une région peut pointer vers le mauvais pays, une mission vers une région incohérente, ou un franchisé régional vers une région d’un autre pays si un contrôle applicatif est oublié.

### 3.3 Architecture cible recommandée

Créer une couche de gouvernance territoriale indépendante des tables métier historiques.

#### Entités cibles

1. `organizations`
   - siège Teranga, master pays, franchise régionale, partenaire ;
   - parent hiérarchique, entité légale, statut, contrat, plan de commission.

2. `territories`
   - pays, région, ville/district, zone opérationnelle ;
   - `parent_id`, code canonique, type, fuseau, géométrie optionnelle, alias.

3. `organization_territories`
   - territoire exploité, exclusivité, dates, état de lancement.

4. `memberships`
   - utilisateur, organisation, rôle, territoire, permissions additionnelles, validité.

5. `service_definitions`
   - définition globale et stable d’une offre : identité, famille, profil d’exécution, preuves attendues.

6. `service_availabilities`
   - déclinaison locale : territoire, organisation opératrice, prix, devise, SLA, champs requis, prestataires éligibles, horaires, activation.

7. `provider_territories` et `provider_capabilities`
   - zones réellement couvertes, type de véhicule/compétence, horaires, capacité et validité de conformité.

8. `country_configs`
   - locale, fuseau, téléphone, adresse, paiements, taxes, canaux d’assistance, politiques et feature flags versionnés.

#### Champs à distinguer sur une demande

- `requester_country_id` : pays de résidence ou du compte du client ;
- `execution_territory_id` : lieu réel d’exécution ;
- `operating_organization_id` : entité responsable ;
- `pricing_country_id` et `currency` : référentiel tarifaire figé au moment de la commande ;
- `source_channel` : app, web invité, téléphone, WhatsApp assisté, partenaire ;
- `policy_version` / `offering_version` : règles acceptées au moment de la demande.

La mission doit toujours être attribuée à une organisation et un territoire valides. Le pays/région dénormalisé peut rester pour les performances, mais il doit être dérivé et contrôlé.

### 3.4 Autorisation cible

Remplacer progressivement les conditions dispersées par une politique centrale :

`autorisé = rôle + adhésion active + action + organisation + territoire + état de la ressource`

Exemples :

- un opérateur régional peut créer et affecter dans ses zones, pas modifier les prix nationaux ;
- un master pays voit les régions du pays, sans voir les données privées d’un autre pays ;
- un responsable qualité peut lire les preuves de ses filières sans modifier les finances ;
- un auditeur siège possède un accès lecture horodaté et journalisé ;
- une opération transfrontalière est gouvernée par le territoire d’exécution, pas par le pays du client.

Chaque requête de lecture, détail, export et mutation doit passer par la même fonction de politique. Les identifiants de pays, région ou organisation envoyés par le frontend ne sont jamais une preuve d’autorisation.

### 3.5 Migration sans rupture

1. Mesurer les `NULL`, incohérences région/pays et ressources orphelines.
2. Créer organisations, territoires, adhésions et disponibilités sans supprimer les champs existants.
3. Créer une organisation siège et une organisation Mali pilote.
4. Backfiller les objets existants avec une provenance (`inferred`, `verified`, `manual`).
5. Mettre les cas ambigus en quarantaine opérationnelle.
6. Ajouter une couche unique `authorizationPolicy` / repositories scopés.
7. Faire du dual-read puis du dual-write sous feature flag.
8. Ajouter des tests matriciels rôle × action × territoire × état.
9. Rendre obligatoires organisation et territoire pour toutes les nouvelles opérations.
10. Ajouter les contraintes DB après assainissement, puis retirer les fallbacks hérités.

## 4. Simplification du produit et des services

### 4.1 Problème de vocabulaire

Le vocabulaire doit être stabilisé pour le client et pour les équipes :

| Terme | Signification cible |
|---|---|
| Offre | Ce que Teranga propose dans une zone donnée |
| Demande | Le besoin exprimé par le client, quel que soit le canal |
| Dossier | Ensemble durable : bien, projet ou cas complexe |
| Mission | Unité de travail affectée et exécutée sur le terrain |
| Étape | Action interne d’une mission ou d’un dossier |
| Preuve | Élément vérifiable produit sur le terrain |
| Paiement / mouvement | Encaissement, dépense, commission ou remboursement |

« Service » peut rester un terme marketing, mais ne doit plus être le nom générique de quatre objets différents dans l’interface.

### 4.2 Architecture d’information client cible

Navigation principale recommandée, limitée à cinq entrées :

1. **Accueil** — prochaine action, demandes actives, assistance.
2. **Nouvelle demande** — besoin guidé en langage simple.
3. **Mes demandes** — toutes les missions, courses et livraisons, filtrables par type.
4. **Mes dossiers** — biens et projets complexes.
5. **Compte & aide** — profil, sécurité, langue, téléphone/WhatsApp.

Les tâches, preuves et mouvements financiers deviennent des onglets du détail d’une demande ou d’un dossier. Ils ne doivent pas être des destinations principales pour un client.

### 4.3 Point d’entrée unique

Conserver les raccourcis Taxi et Livraison pour leur fréquence, mais faire converger toutes les demandes vers un même intake :

1. « Que voulez-vous faire ? » avec recherche et exemples ;
2. lieu(x) d’exécution ;
3. informations essentielles, photo ou note vocale ;
4. estimation/délai et récapitulatif ;
5. identité légère ou connexion seulement quand nécessaire.

Le formulaire ne doit plus coder les comportements par `slug === mobilite/livraison`. Le backend doit fournir un `executionProfile` décrivant : nombre de lieux, champs requis, preuve, tarification, acteur éligible, urgence, suivi et politique d’annulation.

### 4.4 Positionnement du portefeuille

Le noyau stratégique est « faire exécuter à distance avec confiance ».

- **Cœur** : demandes assistées, démarches, inspections, gestion de biens/projets, preuve et garantie.
- **Accélérateurs de fréquence** : mobilité et livraison, opérées avec le même standard de confiance.
- **Vitrine** : immobilier vérifié.
- **À isoler ou différer** : marketplace produits généraliste tant que commande, fulfillment, stock, paiement et livraison ne forment pas une chaîne cohérente.

Chaque nouvelle offre doit prouver qu’elle réutilise le moteur de confiance et qu’elle possède un propriétaire opérationnel, un SOP, un SLA et une économie unitaire mesurable.

### 4.5 Interface par rôle

- Client : demandes, dossiers, aide.
- Agent/prestataire : missions à accepter, mission en cours, preuves, historique, disponibilité.
- Opérateur régional : file d’entrée, affectation, alertes SLA, incidents, cash à rapprocher.
- Master pays : performance régions, qualité, réseau, catalogue local, finances pays.
- Siège : gouvernance, pays, standards, audits, consolidation et exceptions.

L’administration doit être regroupée en six espaces : Opérations, Réseau, Catalogue, Qualité, Finance, Configuration. La navigation actuelle peut être conservée derrière ces groupes pendant la migration.

## 5. Accessibilité et inclusion

### 5.1 Acquis

- design mobile-first et zones tactiles souvent généreuses ;
- navigation basse mobile et safe areas ;
- textes alternatifs présents sur les images inspectées ;
- rôles `alert`/`status` sur plusieurs retours ;
- piège de focus disponible pour certaines modales ;
- champ texte conservé quand la carte ne charge pas ;
- note vocale et parcours téléphone ;
- brouillons/récupération réseau sur les parcours mobilité/livraison ;
- français et anglais, avec attribut `lang` mis à jour.

### 5.2 Écarts à traiter

#### WCAG et clavier

- absence de lien d’évitement vers le contenu principal ;
- association label/champ incomplète dans plusieurs formulaires (`label` sans `htmlFor`) ;
- gestion de focus non systématique lors d’un changement d’étape ou après erreur ;
- progression visuelle du wizard sans annonce complète du titre d’étape ;
- erreurs générales pas toujours reliées au champ fautif via `aria-invalid` / `aria-describedby` ;
- contrôle de carte potentiellement dépendant du pointeur sans alternative équivalente documentée ;
- aucune suite automatisée axe/Pa11y observée ;
- de nombreux textes de 10–12 px, trop petits pour une interface destinée à tous ;
- prise en charge de `prefers-reduced-motion` non généralisée aux animations Framer Motion ;
- contraste et zoom 200 % non validés systématiquement.

#### Compréhension et littératie

- trop de notions métier affichées au client ;
- pages très denses côté administration ;
- messages et formulaires majoritairement textuels ;
- absence de mode « essentiel » avec phrases courtes, pictogrammes cohérents et aide contextuelle ;
- note vocale disponible seulement dans certains parcours au lieu d’être une capacité commune.

#### Langues et localisation

- seulement `fr` et `en` sont réellement supportés ;
- le format de locale est `fr-FR` ou `en-US`, pas langue + pays d’exécution ;
- pas de langue arabe/RTL, portugaise ni langues africaines priorisées ;
- pays, devises, téléphones et dates reposent encore sur plusieurs listes codées en dur.

#### Réseau et appareils

La PWA met en cache la coquille de l’application, mais pas encore un vrai journal de mutations hors ligne. Une mission ou une preuve saisie hors connexion doit avoir un état local visible : en attente d’envoi, envoyée, en conflit ou en échec. Il faut aussi tester les appareils Android d’entrée de gamme, le partage de téléphone et la perte de connexion pendant un upload.

### 5.3 Cible d’accessibilité

Adopter WCAG 2.2 niveau AA comme définition de terminé pour tous les nouveaux écrans :

- navigation complète au clavier et au lecteur d’écran ;
- focus visible et jamais masqué par la navigation fixe ;
- cibles d’au moins 44 × 44 px comme règle produit, même si le minimum AA peut être inférieur ;
- texte courant d’au moins 16 px, zoom 200 %, reflow à 320 px ;
- contraste automatisé et manuel clair/sombre ;
- labels programmatiques, erreurs par champ et résumé d’erreurs focalisé ;
- aucune action disponible uniquement par glisser-déposer ou par carte ;
- réduction des mouvements ;
- tests axe dans les composants et Playwright sur les parcours critiques ;
- audit manuel TalkBack Android, VoiceOver iOS et clavier desktop à chaque release majeure.

### 5.4 Stratégie linguistique réaliste

Ne pas traduire immédiatement toute l’application dans de nombreuses langues. Pour chaque pays :

1. choisir une langue d’exploitation et une ou deux langues client prioritaires ;
2. traduire d’abord accueil, intake, suivi, sécurité, litige et aide ;
3. proposer des capsules audio validées localement pour les moments critiques ;
4. utiliser les données Unicode CLDR/`Intl` pour dates, nombres, devises et pluriels ;
5. versionner et faire valider les traductions par l’équipe pays ;
6. mesurer le taux d’abandon par langue avant d’élargir.

## 6. Système opératoire application + terrain

Le dépôt affirme l’usage de SOP et de manuels, mais aucun manuel opérationnel complet n’est présent. Les spécifications décrivent des règles, pas encore l’organisation quotidienne. Chaque processus doit exister sous quatre formes synchronisées : workflow applicatif, SOP terrain, checklist de contrôle et indicateurs.

### 6.1 Processus standard d’une demande

| Étape | État applicatif | Responsable principal | Gate obligatoire | Sortie attendue |
|---|---|---|---|---|
| 1. Réception | CREATED | Client/opérateur | besoin, contact, canal, lieu | demande traçable |
| 2. Qualification | CREATED | Opérateur local | offre disponible, territoire, risque, données minimales | demande acceptée ou orientée |
| 3. Tarification | CREATED | Système/opérateur | prix/devise/SLA/version | consentement client |
| 4. Recherche | SEARCHING_EXECUTOR | Dispatch régional | exécutant habilité et disponible | proposition d’affectation |
| 5. Affectation | ASSIGNED | Dispatch | acceptation, conformité valide, contact utile | exécutant engagé |
| 6. Déplacement | EN_ROUTE | Exécutant | départ confirmé | ETA/retard connu |
| 7. Arrivée | ON_SITE | Exécutant | présence ou contrôle alternatif | début autorisable |
| 8. Exécution | IN_PROGRESS | Exécutant | consignes et risques confirmés | travail réalisé |
| 9. Preuve | COMPLETED | Exécutant | preuves exigées, montant collecté, anomalies | contrôle qualité possible |
| 10. Validation | VALIDATED | Client/opérateur | conformité ou ouverture litige | acceptation formelle |
| 11. Clôture | CLOSED | Système/finance | cash et commission rapprochés, garantie enregistrée | dossier clos |

Chaque transition doit afficher qui doit agir, avant quand, pourquoi elle est bloquée et quel canal de secours utiliser.

### 6.2 Cas d’exception à formaliser

- aucun exécutant trouvé ;
- client injoignable ;
- adresse imprécise ;
- exécutant en retard ou absent ;
- preuve impossible ou non conforme ;
- panne réseau/appareil ;
- accident, harcèlement ou urgence sécurité ;
- montant cash différent ;
- annulation avant/après déplacement ;
- substitution d’exécutant ;
- mission transfrontalière ;
- litige, remboursement, reprise et clôture sans faute.

Chaque exception exige un code normalisé, un niveau de gravité, un délai, un responsable, une trace et une règle de communication client.

### 6.3 Processus de lancement d’un pays

Un pays ne devient `active` qu’après un gate « Country Launch Ready » :

1. entité juridique et responsable pays validés ;
2. annexe réglementaire et données personnelles approuvées ;
3. territoires et contacts d’urgence configurés ;
4. langues, fuseau, devise, téléphone et adresses testés ;
5. catalogue minimal, prix, SLA et horaires approuvés ;
6. prestataires/agents minimums vérifiés par zone ;
7. procédures cash, remboursement, litige et incident testées ;
8. support téléphone/WhatsApp opérationnel ;
9. formation et certification des équipes terminées ;
10. répétition de bout en bout avec scénarios d’échec ;
11. dashboard et alertes observables ;
12. décision Go/No-Go signée par pays, produit, sécurité et opérations.

### 6.4 Processus de création d’une offre

Une offre ne doit pas être publiée par simple création de catégorie. Workflow cible :

`Brouillon → étude terrain → risques/conformité → modèle économique → SOP → pilote interne → pilote clients → actif → suspendu/retiré`

Critères minimaux : propriétaire, territoire, cible client, prix, SLA, preuves, compétences, équipement, exclusions, risques, assurance, politique d’annulation, traitement cash, support et indicateurs.

### 6.5 Onboarding et maintien des exécutants

1. identité et coordonnées ;
2. compétences et territoires ;
3. documents réglementaires avec expiration ;
4. formation au SOP et à la sécurité ;
5. simulation pratique ;
6. période de probation ;
7. activation par capacité/territoire ;
8. suivi qualité et incidents ;
9. re-certification périodique ;
10. suspension automatique à expiration bloquante.

Le statut du prestataire ne suffit pas : l’éligibilité doit être calculée pour une capacité, un territoire, une date et une catégorie de risque.

### 6.6 Cash et finance terrain

Le champ `collectedAmount` est utile, mais une expansion exige un mini-ledger auditable : montant attendu, collecté, remis, écart, responsable, mode, justificatif et dates. La clôture opérationnelle et la clôture financière doivent être distinctes. Aucun montant envoyé par le client ne doit devenir la vérité comptable sans validation serveur.

### 6.7 RACI simplifié

| Processus | Siège | Master pays | Opérations région | Exécutant | Finance | Qualité |
|---|---|---|---|---|---|---|
| Standard global | A/R | C | C | I | C | R |
| Localisation pays | A | R | C | I | C | C |
| Qualification/dispatch | I | A | R | C | I | C |
| Exécution/preuve | I | A | C | R | I | C |
| Rapprochement cash | I | A | C | C | R | I |
| Litige local | I | A/R | C | C | C | R |
| Escalade grave | A/R | C | I | I | C | C |
| Audit franchise | A | C | I | I | C | R |

`R` = réalise, `A` = rend compte et décide, `C` = consulté, `I` = informé.

## 7. Mesure de la référence africaine

La « référence » ne doit pas être définie par le nombre de fonctionnalités, mais par une promesse mesurable :

> Part des demandes terminées dans le délai promis, avec preuve acceptée, cash rapproché et sans réouverture sous 7 jours.

### Indicateurs essentiels

#### Accès et inclusion

- taux de réussite sans assistance ;
- taux de réussite par canal, appareil, réseau, langue et pays ;
- abandon par étape ;
- part des demandes créées par téléphone ;
- temps et coût opérateur par demande ;
- erreurs d’accessibilité bloquantes.

#### Opérations

- délai de première prise en charge ;
- délai d’affectation ;
- respect SLA par offre/zone/canal ;
- taux de refus/réaffectation ;
- preuve conforme au premier envoi ;
- missions sans territoire ou en quarantaine ;
- incidents sécurité pour 1 000 missions.

#### Confiance

- validation sans litige ;
- taux de reprise/remboursement ;
- délai premier contact litige ;
- résolution sous 48 h ;
- CSAT post-mission et NPS après plusieurs missions ;
- réachat à 30/90 jours.

#### Réseau et finance

- disponibilité prestataires par zone/capacité ;
- conformité expirée ou bientôt expirée ;
- écart cash et délai de rapprochement ;
- marge contributive par offre/pays ;
- commission franchise calculée et payée ;
- coût support par mission.

#### Gouvernance technique

- tentatives hors scope refusées ;
- couverture de la matrice d’autorisation ;
- données orphelines/NULL ;
- complétude de localisation ;
- taux de synchronisation offline ;
- crash/error rate et p95 API sur réseau mobile.

## 8. Backlog priorisé

### Phase 0 — Décisions de gouvernance (2 semaines)

- Valider le vocabulaire Offre/Demande/Dossier/Mission/Étape/Preuve.
- Nommer un propriétaire Produit, Opérations, Qualité et Données.
- Valider l’organisation cible siège → master → région.
- Définir le pays pilote et geler l’ajout de nouvelles verticales pendant la fondation.
- Créer les ADR : modèle territorial, autorisation, catalogue, localisation, contraintes DB.

### Phase 1 — Sécuriser le multi-pays (4 à 6 semaines)

- Audit de données et dashboard des scopes manquants.
- Créer `organizations`, `territories`, `memberships`.
- Créer une politique centrale deny-by-default.
- Supprimer le fallback régional permissif sous feature flag après quarantaine/backfill.
- Ajouter les tests matriciels sur toutes les ressources et exports.
- Ajouter la couverture régionale des prestataires.
- Ajouter `execution_territory` et `operating_organization` aux missions.

Critère de sortie : aucun objet neuf sans organisation/territoire ; aucune route métier hors politique centrale.

### Phase 2 — Simplifier l’expérience (4 à 6 semaines)

- Unifier « Mes demandes » avec filtres de type.
- Masquer tâches et transactions de la navigation client.
- Transformer projets/biens en dossiers avec onglets internes.
- Regrouper l’admin en six espaces.
- Remplacer les conditions de formulaire par `executionProfile`.
- Ajouter recherche d’offre et langage orienté besoin.

Critère de sortie : un nouvel utilisateur peut créer et suivre une demande sans comprendre la structure interne.

### Phase 3 — Accessibilité et inclusion (3 à 5 semaines, puis continu)

- Baseline WCAG 2.2 AA et design tokens accessibles.
- Corriger labels, focus, erreurs, skip link, tailles de texte et réduction de mouvement.
- Ajouter axe + Playwright et protocole TalkBack/VoiceOver.
- Localiser par langue + territoire via `Intl`/CLDR.
- Définir les tests appareil/réseau et la stratégie offline des mutations.
- Généraliser note vocale, appel et aide contextuelle.

### Phase 4 — Teranga Operating System (4 à 8 semaines)

- Rédiger les SOP versionnés et checklists applicatives.
- Implémenter country launch gate et offering launch gate.
- Relier chaque statut aux responsables, SLA, preuves et exceptions.
- Créer ledger cash et rapprochement.
- Mettre en place formation/certification/re-certification.
- Construire dashboards qualité pays/région/siège.

### Phase 5 — Deuxième pays (6 à 10 semaines)

- Choisir un seul deuxième pays contrasté avec le Mali.
- Configurer sans modifier le code métier.
- Faire une répétition avec 20 à 50 scénarios, dont échecs et transfrontaliers.
- Lancer par une ville, un catalogue réduit et un nombre limité d’exécutants.
- Étendre seulement après quatre semaines de KPI stables.

## 9. Critères Go/No-Go avant deuxième pays

### Go uniquement si

- 100 % des nouvelles missions ont organisation et territoire vérifiés ;
- 100 % des routes sensibles passent par la politique centrale ;
- tests négatifs inter-pays et inter-région réussis ;
- aucun fallback permissif non mesuré ;
- catalogue et prix configurables sans déploiement ;
- SOP, RACI, support et escalade pays signés ;
- WCAG 2.2 AA vérifié sur les parcours critiques ;
- cash et commissions rapprochables ;
- conformité prestataire calculée par capacité/territoire ;
- dashboards pays/région/siège opérationnels ;
- exercice d’incident et restauration réalisé.

### No-Go si

- le pays est activé uniquement parce qu’une franchise MASTER existe ;
- des ressources `NULL` sont automatiquement visibles par une région ;
- une nouvelle offre nécessite des branches spécifiques dispersées dans le frontend/backend ;
- l’équipe locale travaille principalement hors système sans mécanisme de réconciliation ;
- le support, la sécurité ou les litiges ne disposent pas d’astreinte et de délais configurés.

## 10. Recommandation finale

La voie la plus crédible pour devenir une référence africaine est de faire de Teranga un standard d’exécution de confiance, pas une super-app généraliste. La marque doit pouvoir promettre la même discipline dans chaque pays : demande simple, responsable identifié, délai clair, exécutant vérifié, preuve compréhensible, argent traçable et problème traité rapidement.

Le prochain investissement doit donc porter sur l’isolation territoriale, le catalogue local, la simplicité des parcours et les SOP. Une fois ces fondations prouvées au Mali, l’ouverture d’un deuxième pays deviendra un exercice de configuration, de formation et de contrôle — et non une nouvelle branche du produit.

## 11. Références externes de cadrage

- W3C, [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/).
- OWASP, [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- Union africaine, [AU Data Policy Framework](https://au.int/en/documents/20220728/au-data-policy-framework).
- GSMA, [State of Mobile Internet Connectivity 2025](https://www.gsma.com/somic/wp-content/uploads/2025/09/The-State-of-Mobile-Internet-Connectivity-2025-Overview-Report.pdf).
- GSMA, [State of the Industry Report on Mobile Money 2025](https://www.gsma.com/sotir/).
- Unicode Consortium, [CLDR releases and locale data](https://cldr.unicode.org/index/downloads).

