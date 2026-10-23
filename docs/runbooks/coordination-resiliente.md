# Coordination et aléas humains

## Disponibilité des agents

Un agent autorise les nouvelles affectations pendant une durée explicite, de 15 minutes à 8 heures, avec une valeur initiale de 60 minutes dans l'interface. Le serveur calcule `availableUntil`. Une lecture, une réservation ou un changement de capacité ne prolonge pas cette durée. L'agent doit confirmer à nouveau sa disponibilité après expiration. Une demande déjà commencée reste affectée même si cette disponibilité expire.

La migration `20261023180000-add-agent-availability-expiry.js` ajoute la colonne sans modifier les services, projets ou commandes. Les anciennes déclarations sans date de fin sont désactivées : elles doivent être renouvelées par les agents. Le contrôle terrain ne compte que les déclarations encore valides.

## Absence de démarrage

Les nouvelles affectations automatiques d'agents comportent une échéance `startDeadlineAt`, par défaut à 15 minutes, configurable via `coordination.startMinutes`. L'agent doit déclarer le démarrage dans l'application **avant** de commencer sur le terrain. Pour les projets et commandes, l'espace agent affiche cette échéance. La notification d'affectation indique le nombre de minutes autorisé.

Si le service classique reste `created`, la mission agent reste `ASSIGNED` ou le projet ou la commande reste `created` au passage du moteur après l'échéance, celui-ci libère l'affectation et met l'agent indisponible pour les nouvelles demandes. Il recherche un autre agent du pays et du périmètre, avec une déclaration valide et une capacité suffisante. Les agents déjà essayés pour cette demande sont exclus. Les limites de tentatives et de durée de recherche restent applicables ; leur dépassement déclenche une intervention du responsable.

Le moteur ne réaffecte pas automatiquement une demande déjà démarrée, une mission de prestataire acceptée ou un litige. Les affectations manuelles et les anciennes réservations sans échéance de démarrage ne sont pas réinterprétées rétroactivement comme des absences. Un ancien agent ne peut pas démarrer après réaffectation : les droits sont vérifiés sous verrou, ou par contrôle de la version de l'affectation pendant la transition.

## Responsable sans réponse

Une escalade conserve une prochaine échéance. Par défaut, après 15 minutes sans intervention, le moteur relance le responsable et des administrateurs autorisés à couvrir ce territoire, avec un relais vers un administrateur global existant. Il exclut les administrateurs limités à d'autres pays ou régions. Les rappels suivants sont espacés de 60 minutes par défaut. Les paramètres sont `coordination.escalationMinutes` et `coordination.reminderMinutes`.

Les rappels sont des notifications internes persistées avec leur compteur et leur prochaine échéance dans la même transaction. Une erreur d'enregistrement annule le rappel pour permettre une nouvelle tentative. Deux traitements concurrents d'un même dossier ne créent pas deux rappels pour la même échéance. Les escalades antérieures sans échéance sont reprises par le moteur. La clôture arrête les rappels ; un avancement réel ou une prise en charge explicite relance le suivi de la prochaine étape.

Le responsable habilité doit ouvrir le dossier, vérifier la situation et prendre en charge l'intervention. Le système ne peut pas déduire d'une absence de réponse que le travail a été réalisé, qu'un paiement a été exécuté ou qu'un client a donné son accord. Les justificatifs et validations finales conservent leurs contrôles.

## Activation dans un territoire

Depuis le Centre des opérations, chaque offre peut activer la recherche automatique et configurer le délai de démarrage, la première relance et les rappels suivants. Le diagnostic expose `automation.enabledOffers`, `automation.manualOffers` et `automation.availableAgents` : une configuration techniquement prête n'implique pas que la recherche automatique soit activée sur toutes les offres.

Pour le Mali, les sept offres et leurs délais approuvés restent configurés ; l'électricité reste suspendue. Les agents doivent confirmer une disponibilité réelle avant l'activation des offres qu'ils exécutent. Pour les prestataires, la disponibilité, la capacité et, pour les transports, la position récente et la conformité du véhicule restent contrôlées à chaque recherche. L'activation d'une offre ne suffit pas à rendre un exécutant éligible.

## Déploiement et recette

Après sauvegarde et disponibilité du nouveau code, depuis `backend` dans Render :

```sh
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run field:check -- --country=ML
```

La nouvelle interface et le backend doivent être déployés ensemble. Appliquer la migration avant de réactiver les affectations automatiques et faire renouveler les disponibilités des agents. Aucun réglage d'offre n'est activé implicitement par cette migration.

La recette doit couvrir : disponibilité expirée, absence de démarrage avec réaffectation, ancien agent refusé après réaffectation, travail commencé conservé, recherche épuisée, responsable sans réponse, reprise d'une ancienne escalade et arrêt des rappels après clôture. Les deux traitements planifiés s'exécutent même si l'un échoue ; leurs succès restent observables séparément dans `operation_scheduler_states`.

WhatsApp et SMS restent différés. Les essais de réception des notifications internes, de restauration de sauvegarde et des parcours complets dans l'environnement déployé restent nécessaires avant lancement.
