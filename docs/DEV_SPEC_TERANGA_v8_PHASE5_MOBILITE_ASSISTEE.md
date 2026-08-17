# Spécification de développement — Teranga v8 / Phase 5 (Mobilité assistée)

## 1. Positionnement

Teranga Mobilité n'est pas une copie d'une application VTC. Le service permet de commander un
déplacement de la même manière depuis le site, un compte client ou un appel téléphonique. Dans les
trois cas, la course entre dans le même moteur de tarification, de dispatch, de suivi et de contrôle
qualité.

Le canal téléphonique est un canal principal, pas un mode dégradé : un opérateur prend la demande,
place le départ et la destination sur la carte, annonce le prix, sélectionne un chauffeur sûr puis
suit la course.

## 2. Principes produit

- Un client connecté ne ressaisit jamais son identité.
- Un visiteur choisit d'abord son trajet et voit l'estimation ; son téléphone et son PIN ne sont
  demandés qu'au moment de commander.
- Un appelant n'a besoin ni d'un compte préalable ni de savoir utiliser l'application.
- Le modèle est multi-véhicule dès l'origine : `motorcycle` et `car` au lancement, extensible sans
  nouvelle filière métier.
- La sécurité est un filtre d'éligibilité avant la proximité. Un chauffeur non conforme ne peut pas
  être proposé, même s'il est le plus proche.
- Le prix affiché vient du backend. La carte navigateur ne constitue jamais la source de vérité du
  tarif.

## 3. Parcours client

1. Ouvrir `/taxi`.
2. Choisir Moto ou Voiture.
3. Utiliser la position actuelle ou rechercher/déplacer le point de départ.
4. Rechercher la destination.
5. Afficher les deux points, l'itinéraire, la distance, la durée disponible et l'estimation.
6. Commander :
   - session client valide : création directe, sans formulaire d'inscription ;
   - visiteur : téléphone, prénom optionnel et PIN à la dernière étape, puis création/réutilisation
     sécurisée du compte ;
   - autre rôle connecté : blocage explicite pour éviter d'écraser sa session.
7. Rechercher un chauffeur, puis afficher son identité et son véhicule dès l'acceptation.

## 4. Modèle cible

### 4.1 Lot 1 — demande de véhicule

Ajouter `services.requested_vehicle_type` (`motorcycle|car`, nullable hors Mobilité) et
`mission_pricing_rules.vehicle_type`. Une règle exacte véhicule est prioritaire ; la règle Mobilité
sans véhicule reste le repli compatible avec les données Phase 4.

### 4.2 Lot 2 — véhicules et conformité

Créer `vehicles` avec au minimum : propriétaire/prestataire, type, marque, modèle, couleur, plaque,
capacité, casque passager, climatisation, carte grise, assurance, contrôle, statut et dates
d'expiration. Un prestataire peut posséder plusieurs véhicules, mais un seul véhicule actif est
attaché à une course.

Ajouter une photo de profil chauffeur et les justificatifs nécessaires. Ces médias sont privés côté
administration ; seul le DTO de course expose les informations d'identification utiles au client.

### 4.3 Lot 3 — position disponible et dispatch

Créer une position temps réel indépendante d'une mission : `provider_id`, coordonnées, précision,
cap, date de dernière mise à jour et véhicule actif. Une position périmée rend le chauffeur
inéligible.

Le dispatch applique :

1. statut actif, disponible et documents valides ;
2. filière Mobilité et véhicule demandé ;
3. scope géographique ;
4. position récente ;
5. présélection par rayon ;
6. classement par temps d'approche, fiabilité et réputation ;
7. offre avec expiration et acceptation atomique ;
8. élargissement du rayon si aucune acceptation.

### 4.4 Lot 4 — suivi et sécurité

Ajouter le suivi temps réel, l'ETA vers le départ avant prise en charge puis vers la destination,
le code de démarrage, le partage de course, l'assistance Teranga, la notation et le signalement.

## 5. Console téléphonique

Faire évoluer `/admin/phone-orders` vers une console `/admin/taxi-dispatch` qui conserve le contexte
sur un seul écran : client, carte, estimation, chauffeurs éligibles classés, détails internes de
sécurité, proposition/affectation et suivi. L'opérateur reste authentifié avec sa propre session ;
aucun cookie client n'est posé dans son navigateur.

## 6. Google Maps

- Clé navigateur restreinte aux domaines autorisés et aux API JavaScript/Places nécessaires.
- Clé serveur séparée, jamais exposée au frontend.
- Lot 1 : Distance Matrix existant pour le tarif et itinéraire navigateur best-effort.
- Lot ultérieur : migration vers Routes API (`computeRoutes` et `computeRouteMatrix`).
- Au Mali, ne pas annoncer un routage moto spécialisé tant que `TWO_WHEELER` n'est pas couvert ;
  utiliser le routage voiture et calibrer les tarifs/temps avec les données réelles du pilote.

## 7. Déploiement progressif

Le code reste multi-véhicule, mais l'ouverture commerciale est contrôlée par pays, zone, horaires
et densité de chauffeurs. Le lancement public exige la validation réglementaire, l'assurance
adaptée au transport de passagers et un vivier vérifié suffisant.

Ordre : parcours client et devis, véhicule/conformité, GPS chauffeur, dispatch assisté, matching
automatique, sécurité temps réel. Les taux de réponse, d'acceptation, d'annulation, le délai de
prise en charge, les incidents, la répétition et le coût du canal téléphonique sont mesurés dès le
pilote.

## 8. État d'implémentation au 17 août 2026

- **Lot 1 livré** : parcours public `/taxi`, Moto/Voiture, carte Google, position actuelle,
  itinéraire, estimation backend et commande adaptée à la session.
- **Lot 2 livré** : flotte multi-véhicule, conformité chauffeur et véhicule, console
  d'administration, blocage de l'activation et de l'affectation si le dossier est invalide ou
  expiré, véhicule attaché à la course et DTO public sans documents administratifs.
- **Lot 3 livré (dispatch assisté)** : position GPS disponible indépendante d'une mission,
  véhicule actif, péremption configurable, filtre de conformité, présélection par rayon et
  classement proximité/fiabilité/réputation. La console `/admin/taxi-dispatch` affiche la course,
  la carte et les chauffeurs sûrs classés ; Google Distance Matrix calcule le temps d'approche avec
  un repli explicite à vol d'oiseau si l'API est indisponible.
- L'affectation réserve atomiquement le chauffeur, ouvre une offre de 90 secondes et empêche une
  double affectation concurrente. Une offre expirée est refusée, la mission revient en recherche,
  le véhicule est détaché et le chauffeur est libéré si sa position est encore fraîche.
- Le rayon reste piloté par l'opérateur (5 à 50 km), conformément au lancement assisté par appel.
  L'enchaînement entièrement automatique des offres et l'élargissement automatique du rayon ne
  seront activés qu'après validation des règles opérationnelles pendant le pilote.
- **Prochain lot** : suivi de course et sécurité (ETA, code de démarrage, partage, assistance,
  notation et signalement).
