# Teranga — Écosystème de services : synthèse du brainstorming stratégique

Document de synthèse des décisions prises lors d'une session de brainstorming (2026-08-01) sur
l'évolution de Teranga vers un écosystème de services multi-catégories. Ce document ne décrit **aucune
implémentation réalisée** — c'est un cadrage stratégique et architectural destiné à préparer une feuille
de route de lancement/implémentation/intégration (prochaine étape).

---

## 1. Vision et thèse centrale

**Le vrai produit de Teranga n'est ni l'application ni une catégorie de service — c'est la confiance.**
La force du projet est la capacité à exécuter, prendre en charge et suivre professionnellement des
services, missions, demandes et projets **à distance**, avec preuve et traçabilité. C'est ce qui doit
structurer toutes les décisions produit, pas l'inverse.

Conséquence directe : **Missions/Immobilier vérifié = cœur du projet. Mobilité (Teranga Taxi),
Livraison, Marketplace immobilière = produits secondaires**, utilisés pour construire la confiance à
petite échelle et donner envie aux clients de confier de plus grandes responsabilités à Teranga. La
croissance visée est le bouche-à-oreille et les réseaux sociaux — donc la façon dont Teranga gère un
problème (retard, litige, erreur) compte autant, sinon plus, que les fonctionnalités elles-mêmes.

**Posture concurrentielle** : ne pas chercher à concurrencer frontalement les acteurs déjà installés
(Teliman/SoRo à Bamako sur le moto-taxi). La différenciation vient de la rigueur de vérification des
exécutants et de l'intégration dans un écosystème de confiance plus large, pas d'une fonctionnalité
supplémentaire.

---

## 2. Réalités du terrain africain retenues (base de la conception)

- **Concurrence locale déjà installée** : Teliman (Bamako, depuis 2018, financé CFAO/Toyota) et SoRo
  Service opèrent déjà le moto-taxi à Bamako avec un positionnement quasi identique à celui envisagé
  (prix fixe à la distance, sécurité comme argument). Gozem et SafeBoda illustrent la trajectoire
  "moto-taxi → super-app" ailleurs sur le continent.
- **Régulation du moto-taxi à Bamako déjà écrite** : arrêté municipal n°067/M-DB — carte
  d'immatriculation, plaque, numéro d'identification, taxes de circulation et de transport obligatoires.
  À traiter comme prérequis bloquant d'onboarding, pas comme case à cocher optionnelle.
- **Sécurité routière** : le moto-taxi informel représente ~25% des morts sur la route en Afrique ;
  agression/enlèvement/harcèlement sont les risques perçus dominants côté VTC.
- **Adressage informel** : une part significative des adresses n'est pas géocodable en texte libre —
  confirme le choix du pin sur carte pour les points de retrait/dépose (déjà appliqué en Lot 2).
- **Cash dominant, pas de paiement in-app pour l'instant** : le paiement à la livraison domine
  l'e-commerce en Afrique subsaharienne (60-85%). Sans paiement intégré, chauffeurs/livreurs manipulent
  du cash à réconcilier — à modéliser dans le suivi, même sans toucher au paiement lui-même.
- **Connectivité** : ~35% de pénétration internet au Mali, ~32 connexions mobile broadband/100
  habitants — justifie de garder le canal téléphone comme canal de commande à part entière (voir §5) et
  de retirer le suivi GPS continu (voir §6).

---

## 3. Principe architectural retenu

**Extension du moteur de missions existant (`services` + `mission_status_history` + machine à états
CREATED→SEARCHING_EXECUTOR→ASSIGNED→EN_ROUTE→ON_SITE→IN_PROGRESS→COMPLETED→VALIDATED→CLOSED)**, pas un
système parallèle ni une refonte de la structure globale de l'application (pages/rôles/UI restent tels
quels, conformément à la contrainte déjà actée du projet).

Chaque catégorie de mission (service métier, immobilier, mobilité, livraison) doit déclarer un **profil
d'exécution** paramétrant : nombre de lieux requis, type de suivi, modèle de tarification, preuve de fin
exigée, type d'exécutant éligible, échelle de temps — plutôt que de dupliquer le moteur ou d'écrire de la
logique conditionnelle dispersée par catégorie.

Le **vivier "mobilité"** (chauffeurs) est modélisé comme un `provider` de plus (réutilise le schéma
existant : onboarding pending→probation→active, vetting, `badge_certified`, `average_rating`), pas un
nouveau système d'acteur. Un même chauffeur peut couvrir plusieurs filières (mobilité personnes +
livraison).

---

## 4. Les trois nouveaux cas d'usage mobilité/livraison

### Cas 1 — Mobilité interne (logistique)
Un agent/provider affecté à une mission signale un besoin de transport, ou l'admin/master le décide à
l'affectation. Sous-mission créée (FK vers la mission mère), pickup = position de l'exécutant, dépose =
adresse de la mission. Pas de photo de preuve (juste confirmation de dépose). Invisible pour le client
final. Fallback explicite si aucun chauffeur disponible : l'exécutant se débrouille, pour ne jamais
bloquer la mission mère.

### Cas 2 — Livraison générique (colis A → point B)
**Décision importante** : la livraison n'est **pas** un mécanisme de fulfillment de la marketplace
produits. Vérification dans le code : les commandes (`Order`) n'ont aucun lien vers une mission
aujourd'hui (juste un statut `shipped/delivered` sans exécution réelle) ; en revanche une filière
`trade_categories` "Livraison / Courses" existe déjà en base, explicitement conçue pour router les
demandes de livraison via le modèle Teranga Pro indépendamment du catalogue. La livraison est donc une
**mission autonome** (le client a un colis, veut le faire livrer), avec un lien optionnel (non
obligatoire) vers une commande marketplace pour une éventuelle convergence future.

**Point de retrait — flexible, trois cas possibles**, décidés par le type de produit/fournisseur, pas à
chaque commande : agence régionale Teranga (adresse fixe connue), fournisseur fixe (adresse enregistrée
une fois), ou lieu variable (le fournisseur confirme/positionne son point à chaque commande, mission en
attente jusqu'à confirmation).

**Gap technique identifié** : le schéma `services` ne porte qu'une seule adresse aujourd'hui
(`address`/`latitude`/`longitude`). Il faut ajouter des colonnes additives pour une adresse de retrait
distincte. Décision : **la dépose pilote le pays/région de la mission** (routage/tarification), pas le
retrait.

### Cas 3 — Teranga Taxi (commande client directe)
Le client commande une course directement (comme un VTC), pickup + dépose choisis sur carte, prix
indicatif affiché avant confirmation (pas de négociation). Chauffeurs issus du **même vivier vérifié**
que le Cas 1 — c'est précisément ce qui doit différencier Teranga Taxi de l'offre informelle, plus que
l'absence de commande directe.

---

## 5. Canaux de commande : App + Téléphone

Décision : garder deux canaux pour l'instant (pas de SMS/USSD dans l'immédiat). Le canal ne change que
l'**étape de déclenchement** — tout le reste de la chaîne (création, affectation, exécution, cash,
validation) est identique.

- **App** : le client saisit lui-même pickup/dépose sur la carte.
- **Téléphone** : un **opérateur** (agent local ou équipe du master régional — pas un nouveau type de
  rôle) prend l'appel et saisit la course à la place du client, probablement en réutilisant le point
  d'entrée technique déjà existant pour la création de mission "invité" (non authentifiée).

La mission garde en mémoire son canal d'origine (utile pour les stats et pour savoir si un rappel
téléphonique est nécessaire en cas de souci).

---

## 6. Suivi et affectation

- **Suivi en temps réel retiré uniquement pour les nouvelles catégories mobilité/livraison** — statuts
  d'étape seulement, pas de position GPS continue sur carte. Le suivi en direct déjà livré et testé sur
  les missions métier/immobilier (Lot 2, `MissionTrackingPage`) **reste inchangé**.
- **Mécanisme de dispatch** : pas d'algorithme d'auto-matching (explicitement hors périmètre pour
  l'instant). À la place :
  1. Disponibilité déclarative du chauffeur (disponible / en course / hors service, pas de GPS continu).
  2. Vue "chauffeurs disponibles par zone" pour l'admin/master/opérateur (scope géographique déjà
     existant), affectation en quelques clics.
  3. Fenêtre courte d'acceptation par le chauffeur (60-90s) avant de passer au suivant, pour éviter
     qu'une course reste bloquée sur un chauffeur qui ne répond pas.
  4. Timeout global → statut `NO_EXECUTOR_FOUND` (déjà prévu dans la machine à états), alerte au master.
  5. **Un seul mécanisme de dispatch pour les trois cas** (interne, livraison, taxi), pas un écran par
     catégorie.

---

## 7. Marketplace immobilière (produit secondaire, simplifié)

Objectif métier : répondre au problème documenté des "démarcheurs" informels au Mali/Côte d'Ivoire,
payés à la visite (donc incités à montrer des biens non conformes aux critères du client pour
multiplier les commissions).

**Modèle retenu, volontairement simple** :
- **Aucun compte agence, aucun compte propriétaire** — vérification dans le code : le modèle `Property`
  existant (`ownerId` obligatoirement un client) et le catalogue produits (panier/commande) ne
  correspondent pas à ce besoin ; il faut une nouvelle entité légère, gérée uniquement par
  l'admin/category manager.
- Une agence ou un particulier envoie photos/quartier/prix/infos à Teranga **hors plateforme** (appel,
  WhatsApp) ; un admin/category manager saisit la fiche.
- Champs : titre, type (maison/appartement/terrain), transaction (location/vente), quartier + ville,
  prix, description, photos, statut.
- **Contact affiché : numéro Teranga par région/master local** (pas le contact d'origine du bien),
  cliquable pour appel ou WhatsApp.
- Statut changé ou fiche supprimée manuellement quand loué/vendu.
- **Chaque annonce a un lien public partageable individuel** (pas seulement une liste générale), avec
  aperçu image correct au partage — condition nécessaire pour la promotion TikTok/Facebook.
- Page publique, sans authentification (comme le catalogue produits l'est déjà).
- Pas de système de réservation/calendrier — écarté volontairement pour rester simple.
- **Opportunité identifiée, non actée** : cette marketplace peut devenir un entonnoir naturel vers le
  cœur du produit (un client, notamment diaspora, peut commander une "visite vérifiée" exécutée par un
  agent Teranga avec preuve photo) — à explorer plus tard, pas une exigence du modèle simplifié actuel.

---

## 8. Les trois piliers de la confiance

### 8.1 Seuils de professionnalisme par filière (`trade_category`)

| Filière | Prise en charge | Alerte auto | Durée totale attendue |
|---|---|---|---|
| Électricité | 1h | 2h sans affectation | Diagnostic communiqué dès l'affectation |
| Plomberie | 1h30 | 3h sans affectation | idem |
| Climatisation | 3h | proportionnel | idem |
| Ménage | 24h | 48h sans affectation | Durée convenue à la réservation |
| Peinture | 48h | 72h sans affectation | Respect du calendrier annoncé (peut s'étaler sur plusieurs jours) |
| Livraison | 20-30 min | 45 min | Quelques heures max |
| Mobilité / Teranga Taxi *(filière à créer en base)* | 5 min | 5-7 min | Quelques dizaines de minutes |

Ces chiffres sont une **hypothèse de départ à calibrer avec des données réelles** une fois l'usage lancé,
pas une norme figée. L'alerte automatique doit toujours se déclencher **avant** que le client ait besoin
de se plaindre, et remonte au master local (pas de nouveau rôle "médiateur").

**Décision** : filière "Sécurité/gardiennage" **retirée entièrement de l'application** — hors
compétence de Teranga. (Elle ne rentrait de toute façon pas dans le modèle prise-en-charge/durée, car
c'est une présence continue et non une intervention ponctuelle.)

### 8.2 Parcours de litige de bout en bout

1. **Ouverture** : client signale un problème sur une mission `COMPLETED` (motif + description + preuve
   optionnelle).
2. **Accusé de réception immédiat et automatique**, avec engagement de délai explicite (ex. "un
   responsable vous contacte sous 4h") — étape non négociable, le silence après une réclamation détruit
   la confiance plus vite que le problème initial.
3. **Premier contact humain** : master local, sous 4h en heures ouvrées.
4. **Investigation** : preuves des deux parties (photo horodatée, `mission_status_history`). Décision
   cible sous 24-48h ; au-delà, le client doit recevoir une mise à jour même sans résolution finale.
5. **Décision toujours expliquée** : `RESOLVED_REFUND` / `RESOLVED_REDO` / `RESOLVED_CLOSED` (déjà dans
   le schéma), avec justification écrite même en cas de refus.
6. **Contrainte technique actée** : sans paiement in-app, un remboursement ne peut jamais être immédiat
   (toujours hors-app, manuel) — ne jamais promettre au client une compensation instantanée ; le geste de
   confiance rapide, c'est la vitesse/clarté de communication, pas l'argent.
7. **Traçabilité interne** : compteur de litiges défavorables par prestataire, visible à
   l'admin/master lors d'une future affectation (pas forcément public).
8. **Escalade automatique** : au-delà de 48h sans décision, remontée au country_admin/super_admin —
   seule exception actée à la règle "un seul niveau d'alerte", car un litige oublié est le pire
   scénario pour la confiance.

### 8.3 Réputation visible

Le système fonctionne par affectation manuelle (pas de marché ouvert où le client choisit) — la
réputation n'est donc pas un outil de sélection, **c'est un signal de réassurance montré à la transition
`ASSIGNED`** : prénom du prestataire, nombre de missions réalisées, note moyenne, badge "Certifié
Teranga" ; pour un chauffeur, en plus photo + numéro de plaque.

**Critères proposés pour le badge "Certifié Teranga"** (le champ existe en base mais sans critères
définis à ce jour) : minimum de missions complétées sans litige défavorable, aucun litige non traité en
cours, garantie post-intervention toujours respectée. Le badge doit pouvoir être **retiré**, pas
seulement accordé une fois pour toutes.

---

## 9. Évaluation stratégique honnête

**Forces réelles** : la thèse multi-catégories est éprouvée ailleurs sur le continent (Gozem, SafeBoda) ;
le modèle franchise par pays/région répond à un vrai problème de fragmentation réglementaire ; l'angle
diaspora (flux de transferts massifs, frustration documentée sur la confiance à distance) est le vrai
avantage différenciant de Teranga — pas la mobilité/livraison, qui sont des marchés à faible marge avec
des concurrents installés et financés.

**Risques nommés explicitement** : tenter de construire toutes les briques (missions, immobilier,
marketplace, projets, finance, mobilité, livraison, franchise multi-pays) en parallèle avant d'avoir des
utilisateurs actifs revient à n'apprendre sur rien avant d'avoir tout construit. La rentabilité dépend de
facteurs que l'architecture ne résout pas (volume réel, capacité de recrutement franchisés/chauffeurs,
budget d'acquisition, cadre légal par pays).

**État réel du projet (2026-08-01)** : application déjà en production, **0 utilisateur actif**
délibérément — lancement retardé le temps de finaliser les documents officiels et la structure
opérationnelle (bureau à Bamako déjà en place). C'est une séquence disciplinée (conformité avant
ouverture publique), pas un retard, et une fenêtre encore ouverte pour concevoir la bonne architecture
sans casser du vécu.

**Recommandation actée** : mobilité/livraison/marketplace immobilière sont des produits secondaires au
service de la confiance construite par le cœur (missions vérifiées à distance) — ne pas les mettre en
avant au lancement avant que le cœur ait prouvé sa valeur avec de vrais utilisateurs.

---

## 10. Points encore ouverts (non tranchés)

- Documents en attente : structure générale de l'entreprise seule, ou conformité transport spécifique
  (arrêté moto-taxi) également en cours ?
- Échéance de lancement visée (même approximative).
- Filière `trade_category` "Mobilité" à créer en base (n'existe pas encore, contrairement à "Livraison").
- Détail des seuils de professionnalisme "Sécurité/gardiennage" — non applicable, filière retirée.
- Opportunité "visite vérifiée" comme entonnoir depuis la marketplace immobilière vers le cœur mission —
  non actée, à explorer plus tard.
- Convergence optionnelle future entre livraison et fulfillment marketplace (lien `orderId` facultatif
  sur une mission livraison) — non actée, juste laissée possible.

---

## 11. Feuille de route de lancement, d'implémentation et d'intégration

Principe directeur : chaque phase ne s'ouvre publiquement que si la précédente a prouvé sa fiabilité —
on ne mesure pas le passage à la phase suivante en dates fixes (pas d'échéance connue à ce jour) mais en
**critères de sortie**. Chaque phase réutilise l'infrastructure validée par la précédente plutôt que de
construire en parallèle.

### Phase 0 — Durcissement du cœur existant
**Peut démarrer immédiatement**, indépendamment des documents en attente (travail de code pur sur ce qui
est déjà en prod, pas d'exposition publique nouvelle).
- Seuils de professionnalisme par filière (§8.1) intégrés au moteur de missions : timers d'alerte
  automatique par `trade_category`, notification master.
- Parcours de litige (§8.2) : accusé de réception auto, timers 4h/24-48h, escalade automatique 48h,
  compteur interne de litiges par prestataire.
- Réputation visible (§8.3) : affichage à la transition `ASSIGNED`, critères et logique de retrait du
  badge "Certifié Teranga".
- Nettoyage : retrait effectif de la filière Sécurité/gardiennage.
- **Critère de sortie** : le cœur (plomberie/électricité/ménage/peinture/climatisation + immobilier
  vérifié) applique déjà les trois piliers de confiance avant le premier client réel.

### Phase 1 — Lancement soft du cœur + marketplace immobilière
**Gate d'entrée** : documents officiels/conformité entreprise finalisés (échéance à confirmer).
- Ouverture publique limitée, cohérente avec le bureau déjà en place à Bamako, sur les missions de
  service + immobilier vérifié déjà durcis en Phase 0.
- Marketplace immobilière (§7) : peu coûteuse, peu risquée, sert de canal d'acquisition
  (TikTok/Facebook) pendant que le cœur fait ses preuves — peut être lancée en même temps que le cœur,
  sans dépendance technique entre les deux.
- **Hors périmètre** : mobilité/livraison/taxi encore fermés au public.
- **Critère de sortie** : un signal qualitatif que le cœur tient sa promesse en conditions réelles — au
  moins un cycle de mission complet et, idéalement, un litige résolu selon le parcours défini en §8.2.

### Phase 2 — Mobilité interne uniquement (Cas 1, §4)
**Gate d'entrée** : Phase 1 stable, volume de missions suffisant pour justifier un vrai besoin de
logistique interne. **À vérifier avec toi** : la conformité transport (arrêté moto-taxi, §2) s'applique-
t-elle déjà à un usage interne non consommateur, ou seulement à l'usage public (Phase 4) ?
- Création de la filière `trade_category` "Mobilité" (n'existe pas encore en base, contrairement à
  "Livraison").
- Checklist d'onboarding chauffeur (plaque, carte de circulation, assurance).
- Colonnes additives retrait/dépose sur le schéma mission (gap identifié en §4, Cas 2).
- Vue "chauffeurs disponibles par zone" + mécanisme de dispatch (§6) : fenêtre d'acceptation, timeout.
- **Pourquoi maintenant, pas avant** : la brique techniquement la plus neuve (vivier chauffeurs +
  dispatch) est testée en conditions internes à faible enjeu, invisible du client, avant toute exposition
  publique — on dérisque sans exposer la réputation.
- **Critère de sortie** : dispatch fiable en interne sur une durée significative, sans incident de
  sécurité ni de retard grave.

### Phase 3 — Livraison générique client (Cas 2, §4)
**Gate d'entrée** : Phase 2 stable, vivier chauffeurs rodé.
- Ouverture de la mission "livraison" (colis A → point B) aux clients, réutilisant le vivier et le
  dispatch déjà validés en Phase 2.
- Les trois types de point de retrait (agence / fournisseur fixe / variable, §4).
- Réconciliation cash à la remise.
- **Critère de sortie** : volume de livraisons traité sans incident majeur de cash ou de réputation.

### Phase 4 — Teranga Taxi (Cas 3, §4)
**Gate d'entrée** : conformité transport spécifique validée (arrêté 067/M-DB) + Phase 3 stable + densité
de chauffeurs suffisante pour tenir crédiblement le seuil de 5 minutes annoncé (§8.1).
- Commande directe, deux canaux (app + téléphone/opérateur, §5).
- Affichage plaque/photo/note au client (réputation visible, §8.3).
- **Pourquoi en dernier** : c'est le marché le plus concurrentiel (Teliman, SoRo), le plus exigeant en
  conformité réglementaire, le plus sensible en sécurité — la "grande responsabilité" ne doit venir
  qu'après que missions, immobilier, mobilité interne et livraison aient prouvé la fiabilité de Teranga.

### Non séquencé — à surveiller tout du long, pas de phase dédiée
- Paiement in-app : reste hors périmètre, à réévaluer seulement si le volume manuel devient intenable.
- Convergence livraison ↔ commandes marketplace (lien `orderId` optionnel, §4) : à activer seulement si
  un besoin réel apparaît, jamais par anticipation.
- Opportunité "visite vérifiée" comme entonnoir marketplace immobilière → mission (§7) : à tester une
  fois la Phase 1 en place, si des clients (notamment diaspora) le demandent spontanément.

### Deux inconnues qui conditionnent le calendrier réel
1. Ce que couvrent exactement les documents encore en attente (structure entreprise seule, ou
   conformité transport également) — détermine si Phase 2 peut démarrer avant la fin complète du
   processus de conformité.
2. Échéance de lancement visée pour la Phase 1, même approximative.
