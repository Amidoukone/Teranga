# Préparation de Teranga au lancement terrain

## Périmètre livré

Le centre `/admin/operations` relie les demandes ouvertes à un responsable, une prochaine échéance et un état de coordination. Il permet de prendre en charge une demande, de consulter les blocages de préparation et de configurer les offres locales : résultat attendu, délai par étape, justificatifs et recherche automatique.

La recherche automatique couvre les prestataires et les services exécutés par un agent. Les agents se déclarent disponibles et définissent leur capacité simultanée depuis leur espace ; celle-ci tient compte des services, projets et commandes déjà affectés. L’affectation automatique d’un agent vaut prise en charge autorisée par cette disponibilité : les délais de démarrage et d’exécution restent surveillés, sans remplacement automatique d’une personne déjà au travail.

Le tableau propose trois files : services, projets et commandes. Les projets et commandes ont un responsable, un agent, un délai, une affectation manuelle ou automatique et une escalade. Leur automatisation s’active par demande dans le centre ; elle exige un territoire actif et un agent disponible. Les anciens dossiers restent repris sur décision explicite du responsable. Les connecteurs WhatsApp/SMS sont différés.

## Déploiement avant utilisation

1. Sauvegarder la base et vérifier la restauration sur une copie distincte.
2. Appliquer les migrations existantes du catalogue et des fuseaux horaires, puis `20261023090000-create-mission-coordination.js`, `20261023100000-add-service-request-keys.js` et `20261023110000-extend-operational-coordination.js`.
3. Déployer le serveur et l’interface compatibles. Ne pas ouvrir les nouvelles fonctions avant les migrations.
4. Confirmer `MISSION_COORDINATION_ENABLED=true` et le démarrage via `backend/index.js`.
5. Vérifier un stockage durable des justificatifs : ImageKit configuré ou `UPLOADS_ROOT` réellement persistant. Un chemin configuré seul ne prouve pas sa persistance ; effectuer un upload, redémarrer, puis relire le fichier.

Le moteur tourne chaque minute. Les traitements d’une même mission sont sérialisés en base. La réservation de l’exécutant, la transition, la tentative et les notifications internes sont enregistrées dans la même transaction. Une panne de persistance annule cette décision. Les notifications de ce lot sont celles de l’application ; la livraison par téléphone, SMS ou messagerie demande ses propres intégrations et essais.

`operation_scheduler_states` conserve la date de démarrage du dispositif et le dernier passage réussi. Les demandes antérieures à cette date ne sont pas automatiquement réactivées : un responsable peut les prendre en charge explicitement depuis le centre. Les échéances déjà persistées reprennent après redémarrage, y compris celles des demandes reprises manuellement.

## Préparer un territoire

Pour reprendre un pays existant indépendamment des pays encore en préparation, les deux projections acceptent `--country=ML`. Depuis le shell Render, après déploiement du code compatible :

```sh
NODE_ENV=production npm run data:project-territories:json -- --country=ML
# Seulement après correction des anomalies et readyToApply: true :
NODE_ENV=production npm run data:project-territories:apply -- --country=ML
NODE_ENV=production npm run data:project-service-catalog:json -- --country=ML
# Après validation du catalogue projeté et readyToApply: true :
NODE_ENV=production npm run data:project-service-catalog:apply -- --country=ML
NODE_ENV=production npm run field:check -- --country=ML
```

Sans `--country`, les projections gardent leur périmètre de tous les pays. Le champ `scope` du résultat précise le périmètre utilisé. Un code inconnu, vide ou une option mal orthographiée provoque un échec sans écriture. Le siège, les administrateurs globaux et les définitions communes restent partagés ; les territoires, rattachements locaux et offres projetés concernent uniquement le pays sélectionné.

`COUNTRY_ADMIN_SCOPE_AMBIGUOUS` avec `organizationCandidates: []` signifie qu'aucun opérateur MASTER existant ne correspond au pays de l'administrateur. Confirmer l'organisation qui exécute réellement les services, puis créer son rattachement au pays existant avant de relancer le diagnostic. Ne pas recréer le pays ou le compte administrateur, ni deviner une organisation. Le filtrage par pays ne contourne pas ce blocage local.

### Reprise du Mali existant

L'exploitant confirmé est Teranga et son assistance est `+223 70453345`. La commande suivante prépare le pays **existant** identifié par `ML`, sans dépendre de son identifiant numérique : XOF, français, `Africa/Bamako`, assistance et opérateur MASTER Teranga. Le premier appel est en lecture seule :

```sh
NODE_ENV=production npm run data:prepare-mali
NODE_ENV=production npm run data:prepare-mali -- --apply
NODE_ENV=production npm run data:project-territories:apply -- --country=ML
NODE_ENV=production npm run data:project-service-catalog:json -- --country=ML
```

La préparation applique les paramètres et crée l'opérateur dans une seule transaction, avec verrou du pays pour les exécutions concurrentes. Elle réutilise un opérateur déjà conforme. Plusieurs MASTER, un opérateur différent ou inactif, une organisation MASTER distincte ou l'absence d'administrateur national provoquent un blocage sans écriture. Le statut actif/inactif du pays est conservé, les comptes restent inchangés et aucun autre pays n'est modifié. Aucune offre ni automatisation n'est activée par cette préparation ; le catalogue fait l'objet de son propre diagnostic puis de la projection décrite plus haut. Le contrôle terrain peut ensuite signaler les résultats attendus et délais encore manquants.

Les coordonnées publiques de Teranga sont alignées sur ce numéro. Pour les pays disponibles et l'assistance d'une mission, le numéro provient de la région correspondante ou du pays ; la variable globale `TERANGA_ASSISTANCE_PHONE` ne remplace plus un contact local manquant. Une région d'un autre pays n'est jamais utilisée comme assistance de la mission.

Si la préparation du Mali a déjà été appliquée avec un ancien numéro, relancer `NODE_ENV=production npm run data:prepare-mali -- --apply` après déploiement du code corrigé pour mettre à jour le contact enregistré. Le pays et l'opérateur existants sont réutilisés.

Pour un autre pays, `data:prepare-country` exige explicitement toutes les options `--country`, `--operator`, `--phone`, `--currency`, `--language` et `--timezone` sous la forme `--option=valeur` ; `--apply` reste facultatif et seul autorise l'écriture. Les valeurs du Mali ne servent pas de défaut aux autres pays.

### Configuration des offres

Pour la reprise du Mali, consulter la [proposition de configuration des offres](configuration-offres-mali.md), qui détaille la suspension de l'électricité et les seuils de suivi à valider avant enregistrement.

Ces projections ne déplacent ni clients, ni commandes, ni missions historiques. Le catalogue conserve les paramètres des offres locales déjà présentes. Sa première projection crée les offres à partir des catégories globales et locales du pays : vérifier la couverture des services existants et préparer leurs délais, résultats et justificatifs avant d'activer l'automatisation.

- Définir devise, langue, fuseau horaire et numéro d’assistance. Vérifier l’éventuelle surcharge régionale.
- Désigner un responsable administrateur local, son organisation et son périmètre.
- Vérifier les affectations territoriales et rôles via le contrôle pilote existant.
- Dans le centre des opérations, décrire le résultat et les limites de chaque prestation locale ; renseigner son délai et les justificatifs attendus.
- Vérifier qu’un agent ou un prestataire actif couvre chaque offre concernée. Pour une offre agent automatique, vérifier aussi son inscription à la disponibilité et sa capacité. La disponibilité du personnel le jour du lancement doit être confirmée séparément.
- Activer la recherche automatique uniquement sur les offres validées. Une offre régionale active prend priorité sur l’offre nationale.

Configuration avancée disponible sur `PATCH /api/v1/service-catalog/availabilities/:id` :

```json
{
  "slaMinutes": 60,
  "providerRules": {
    "serviceOutcome": "Visite réalisée et compte rendu détaillé remis au client.",
    "requiredEvidenceTypes": ["document", "photo"],
    "coordination": {
      "enabled": true,
      "maxAttempts": 3,
      "acceptanceSeconds": 120,
      "retrySeconds": 60,
      "searchMinutes": 30,
      "stageMinutes": 60,
      "validationMinutes": 1440,
      "radiusKm": 8
    }
  },
  "openingHours": {
    "mon": [["08:00", "18:00"]],
    "tue": [["08:00", "18:00"]],
    "wed": [["08:00", "18:00"]],
    "thu": [["08:00", "18:00"]],
    "fri": [["08:00", "18:00"]]
  }
}
```

Conserver les autres clés de `providerRules` lors d’une modification via l’API. `openingHours: null` signifie une offre sans restriction horaire configurée. Les plages utilisent le fuseau de la région, sinon du pays ; début inclus, fin exclue. Les jours sans plage sont fermés. Un format non reconnu ou des horaires fermés provoquent une escalade pour confirmation, sans affectation automatique. Pour une plage traversant minuit, utiliser deux plages sur les jours concernés.

## Fonctionnement et interventions

Une offre est proposée à un prestataire actif, disponible, de la filière et du pays, respectant son éventuel périmètre régional. Un prestataire déjà engagé dans une mission active est exclu. Pour mobilité et livraison, l’automatisation exige également une position récente, un véhicule conforme et une distance à vol d’oiseau inférieure au rayon configuré. Sans ces éléments, le responsable conserve l’affectation manuelle.

Un refus ou une offre expirée conduit à chercher un autre prestataire. Le même prestataire n’est pas proposé à nouveau pour cette demande. Une expiration met la disponibilité réservée hors ligne ; le prestataire doit se déclarer à nouveau disponible. Les tentatives sont limitées en nombre et en durée. Après épuisement, l’état devient « intervention nécessaire » : contacter le client, convenir d’une alternative et effectuer une affectation manuelle si elle est réalisable. Aucune mission n’est déclarée exécutée du seul fait d’un délai dépassé.

Les dépassements en cours d’exécution ou en attente de validation déclenchent une escalade ; le moteur ne remplace pas automatiquement un exécutant déjà au travail. « Prendre en charge » journalise l’intervention du responsable et ouvre une nouvelle échéance selon la politique de la demande.

Les politiques sont copiées sur les nouvelles demandes. Désactiver la recherche automatique sur une offre empêche les propositions suivantes. Les prestations déjà acceptées gardent leur suivi. `MISSION_COORDINATION_ENABLED=false` arrête le job entier ; le contrôle de préparation le signale comme bloquant.

## Compte rendu et clôture

Pour les missions coordonnées automatiquement hors mobilité, l’exécutant dépose un compte rendu de 20 à 4000 caractères pendant `IN_PROGRESS`. Il peut joindre les fichiers attendus, jusqu’à trois par envoi et quinze au total. Une requête répétée avec la même référence de soumission n’ajoute pas de nouveaux fichiers. Le serveur vérifie le rattachement et l’existence des pièces attendues avant `COMPLETED`.

Le client consulte le compte rendu et ses justificatifs sur le suivi, puis accepte ou utilise le parcours de litige. La clôture automatique d’une mission coordonnée intervient après `VALIDATED`. La fin d’exécution libère la capacité du prestataire ; le paiement reste un suivi distinct, avec les règles financières existantes. Les courses de mobilité gardent leurs confirmations de départ et de validation client.

Pour les projets, le compte rendu final exige un document de type `report` ou `photo` déposé par l’exécutant qui termine, ainsi que la fin des phases et tâches ouvertes. Le client valide ensuite le projet depuis son détail. Pour les commandes : préparation, expédition et livraison ; un compte rendu et un justificatif déposé par l’exécutant sont nécessaires à la confirmation de livraison. Le justificatif s’ajoute depuis le détail de la commande. La livraison ne modifie pas le paiement. Les actions de fin des anciens écrans ne peuvent pas contourner le parcours d’un dossier coordonné.

Les services classiques automatisés exigent aussi le compte rendu prévu par l’offre. Il se dépose sur le détail du service pendant son exécution, avant l’action de fin.

## Reprises réseau et intégrité des commandes

Les formulaires actuels de service, mission guidée, projet, commande, saisie opérateur et demande publique envoient `Idempotency-Key`. La clé est stable pour une tentative et ses reprises, isolée par compte, canal et contenu. En contexte HTTPS, le navigateur conserve dans sa session uniquement l’empreinte du contenu et la clé aléatoire. Sans stockage de session ou Web Crypto disponible, la protection reste valable en mémoire tant que la page reste ouverte.

La création de la ressource et son reçu durable sont atomiques. Si la réponse se perd après création, la reprise authentifiée retrouve la ressource existante. Le même identifiant avec un contenu différent renvoie `409 REQUEST_KEY_REUSED`. Une réservation encore en cours renvoie `409 REQUEST_PENDING`, sans seconde création. Après une validation refusée sans ressource créée, le reçu est libéré et une saisie corrigée peut être envoyée. Les clients API anciens sans en-tête restent compatibles et doivent gérer leur propre référence stable.

Les reçus ne stockent ni PIN, ni codes de récupération, ni jetons de session, ni corps de réponse. Une reprise de demande publique déjà créée renvoie `409 REQUEST_ALREADY_CREATED` et invite à se connecter normalement ; elle ne restitue pas les accès à un compte. La saisie opérateur ne rejoue pas les secrets initiaux. Les nouveaux comptes ne sont créés qu’après validation du lieu, du territoire et de l’offre.

Une réservation restée `pending` sans ressource après interruption avant création doit être vérifiée par le responsable technique avec les journaux et les demandes existantes. Ne pas purger automatiquement ce reçu ni renvoyer avec une nouvelle clé pour masquer l’incertitude. Les reçus `completed` permettent la reprise même après une erreur de préparation de réponse. Après suppression d’une demande initiale, sa reprise renvoie `410`.

Une commande réserve son stock et enregistre ses lignes dans la même transaction. Les verrous sur les produits empêchent deux commandes de consommer le même stock. Le pays et la région d’exécution sont validés, la devise est héritée du pays en l’absence de saisie explicite, les produits doivent appartenir à ce territoire et utiliser la même devise. Pour un produit du catalogue, le prix client provient du serveur ; le client ne peut déclarer sa commande payée. Une livraison et un paiement sont deux faits distincts. Les mises à jour partielles conservent les champs absents ; les éléments et justificatifs existants figent le territoire et la devise.

## Vérifications exécutables

Depuis `backend` :

```powershell
npm.cmd run field:recipe
npm.cmd run field:check -- --country=ML
# Pour une ouverture régionale uniquement :
npm.cmd run field:check -- --country=ML --region=123
```

La recette exige MySQL de test et les migrations, sans ignorer les scénarios si la base manque. Elle couvre l’affectation, le refus, l’expiration, l’escalade, la concurrence, le rollback des notifications, la reprise, les droits territoriaux, le compte rendu, les doublons et la validation client. `field:check` est en lecture seule et utilise l’environnement de base configuré ; exécuter d’abord sur préproduction. Il renvoie un code d’échec si des prérequis manquent.

Le contrôle technique exige aussi un passage réussi de chacun des deux suivis (missions, puis projets/commandes) dans les cinq dernières minutes. Une configuration positive conserve explicitement quatre validations de mise en service : réception réelle des notifications, restauration de sauvegarde, prestation complète dans l’environnement déployé et validation de l’organisation locale. Le résultat technique seul ne vaut pas autorisation d’ouverture.

## Critère de départ terrain

Les tests, contrôles de code et compilation doivent réussir. Les migrations et paramètres doivent être vérifiés dans l’environnement déployé. Pour chaque offre ouverte : responsable nommé, assistance joignable, délai réaliste, prix ou devis confirmé, exécutants disponibles, compte rendu et justificatifs relus par un client test. Les refus, absences de réponse, coupures et litiges doivent avoir un responsable et une suite observable dans le centre des opérations.

Conserver le résultat du contrôle par territoire, la référence de la version déployée, la preuve des essais et la décision d’ouverture. Les validations opérationnelles et les essais dans l’environnement déployé ne peuvent pas être déduits des seuls tests locaux.


## Déploiement sur Render et ouverture d’un autre pays

Le Mali conserve ses enregistrements et son territoire. Sélectionner la Côte d’Ivoire ne duplique ni les clients, ni les agents, ni les missions, ni les tarifs maliens. Une liste vide dans un pays nouvellement ouvert est normale tant que ses propres données ne sont pas créées. Les définitions de services globales peuvent être partagées ; les offres, prix, opérateurs, agents et opérations restent territoriaux.

Dans le shell Render, depuis le dossier `backend` contenant son `package.json`, après sauvegarde de la base et disponibilité du nouveau code :

```sh
NODE_ENV=production npm run db:migrate
```

Cette commande utilise `DATABASE_URL` et les paramètres SSL du service Render. Elle applique les migrations en attente, dont les fuseaux horaires, la coordination, les références de demande et la capacité des agents. Ne pas lancer les scripts de démonstration, `db:reset`, `db:seed` ni le serveur d’intégration : ils ne font pas partie de la mise à jour de production. Les comptes `*.demo@teranga.test` restent réservés au poste local.

Le script local de démonstration exige `TERANGA_DEMO_PASSWORD` (au moins 16 caractères, au plus 72 octets UTF-8), sans valeur par défaut. Il accepte un fichier privé `backend/.env.demo.local`, exclu du suivi Git, et ne journalise pas le mot de passe. `TERANGA_DEMO_JWT_SECRET` permet de séparer les sessions de démonstration des autres sessions locales ; sa rotation invalide les anciens jetons de cette démonstration après redémarrage du serveur local.

Vérifier ensuite la santé du backend et recharger l’interface. Depuis un compte global, sélectionner le Mali puis la Côte d’Ivoire : statistiques, utilisateurs, prestataires, annonces, tarifs et listes opérationnelles doivent suivre le pays et la région choisis. Une ancienne région malienne ne doit pas rester sélectionnée en Côte d’Ivoire. Les données du Mali doivent réapparaître lorsque l’on revient au Mali.

Les pays en préparation restent sélectionnables par l’administrateur global pour effectuer leur configuration, tout en restant fermés aux demandes publiques. Pour la Côte d’Ivoire, renseigner ses paramètres (XOF, langue, `Africa/Abidjan`, assistance locale), ses régions, son responsable, ses offres et ses exécutants. L’activation demeure soumise au contrôle de préparation ; une absence d’assistance ivoirienne ne doit pas afficher le numéro malien comme contact local.
