# Un accueil connecté commun : le centre des opérations

Lot local du 26 octobre 2026, après l'unification des dossiers projets et commandes. Principe conservé : **un centre pour savoir quoi faire, un dossier pour agir, des étapes facultatives**.

## Comportement livré

- La connexion ouvre `/operations` pour les clients, agents, prestataires et administrateurs. Le logo connecté ouvre ce même centre. L'ancien favori `/dashboard` reste compatible et redirige vers le centre.
- Un lien protégé demandé avant la connexion conserve son dossier, ses paramètres et son ancre. Les destinations externes et les écrans d'authentification ne deviennent pas des destinations de retour.
- L'accueil public `/` reste accessible sans session. La fusion concerne l'espace connecté.
- Le centre affiche une salutation et une consigne adaptées au rôle. La file commune **À faire / À suivre / Informations** reste l'unique liste de travail de cet accueil, avec ses filtres, compteurs, regroupements d'étapes, pagination et accès au dossier.
- Le client conserve la création de demande, les raccourcis taxi/livraison et l'accès aux paiements dans la navigation secondaire.
- Les agents et prestataires déclarent leur disponibilité dans le centre. Le panneau agent n'interroge aucune seconde liste d'affectations. Les listes spécialisées conservent leurs dossiers et leur historique, sans répéter la disponibilité.

## Disponibilité et reprise

Le bouton principal reste visible. Pour l'agent, la durée et la capacité sont accessibles dans les réglages repliés afin de réduire la hauteur du panneau sur téléphone. Une déclaration utilise toujours une durée explicite, de 60 minutes par défaut ; modifier la capacité seule ne renouvelle pas la disponibilité. Le délai d'expiration et le nombre de prises en charge restent visibles.

Le prestataire conserve la sélection du véhicule éligible, le statut occupé et les contrôles serveur. La géolocalisation reste facultative : un refus ou une erreur de position n'empêche pas la déclaration. Un profil indisponible provoque un message avec réessai, sans inventer un statut hors ligne ni bloquer la file de dossiers. Si la présence de dispatch est inconnue, une nouvelle mise en disponibilité attend sa vérification ; le passage hors ligne reste possible pour un profil confirmé disponible.

Les réponses tardives sont ignorées après démontage ou changement de contexte. Une position GPS obtenue après avoir quitté l'écran ne déclenche pas de nouvelle déclaration. Les réglages locaux sont conservés lors des rafraîchissements et du passage entre les vues du centre ; les rafraîchissements de disponibilité sont suspendus lorsque le panneau est masqué. Une révocation d'accès lors de la lecture retire les contrôles concernés.

## Gestion administrative

`/gestion` est réservé aux administrateurs et regroupe six familles : opérations, réseau, catalogue, qualité, finances et configuration. Les outils de portée globale restent réservés à l'administrateur global, selon le périmètre de son compte. Choisir un territoire dans le sélecteur n'accorde pas de droits supplémentaires.

La navigation principale conserve le centre, Gestion et les accès de coordination taxi/livraison. Les outils spécialisés et les interventions historiques restent accessibles depuis Gestion. Le menu secondaire sur ordinateur disparaît lorsqu'il n'a aucun outil à présenter ; le menu mobile conserve l'accès aux paramètres et à la session.

Les indicateurs et montants de Gestion ne sont chargés qu'à l'ouverture de leurs sections. Une erreur financière laisse les outils opérationnels utilisables ; les montants restent séparés par devise. L'harmonisation des espaces financiers n'est pas engagée dans ce lot.

## Validation locale

- Interface : **330 tests dans 73 suites** réussis. Après le dernier ajustement du panneau mobile et du menu secondaire : **32 tests ciblés** réussis.
- Navigateur avec API simulée : suite complète de **57 scénarios**, couvrant les quatre rôles, les connexions, les anciens favoris, les liens de dossier après connexion, les dossiers et justificatifs, les menus sur téléphone et ordinateur, les droits et la reprise après interruption.
- Serveur réel et MySQL de recette : **6 scénarios réussis** — inscription/connexion, déconnexion/reconnexion, changement de mot de passe, affectation d'une commande puis réalisation depuis son dossier, accueil administrateur/Gestion, disponibilité d'un agent sans modifier sa capacité.
- Contrôle ESLint de l'interface, compilation de production et contrôle des espaces Git réussis. Captures mobiles et ordinateur produites par les scénarios et vérifiées pour le panneau de disponibilité.

Les 567 tests backend documentés dans le lot dossiers restent le dernier passage complet du backend ; ce lot d'accueil ne modifie pas le backend. Les parcours réels ci-dessus ont été rejoués avec le serveur local, sans valider Render ou Netlify.

Commandes principales depuis `frontend` :

```powershell
npm.cmd test -- --silent
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test --workers=2
npx.cmd playwright test e2e-integration/auth.real.spec.js e2e-integration/operations-assignment.real.spec.js --config=playwright.integration.config.js --workers=1
npx.cmd playwright test e2e-integration/connected-home.real.spec.js --config=playwright.integration.config.js --workers=1
```

## État et suite

Aucune migration, dépendance ou variable d'environnement ajoutée. Les lots navigation, dossiers et accueil sont **locaux, non commités** à la rédaction de ce bilan. Aucun push ni déploiement effectué. Les changements du 25 octobre ont été conservés.

La prochaine étape proposée est l'harmonisation des espaces financiers : clarifier où consulter, enregistrer ou contrôler un paiement, sans confondre paiement, livraison et validation d'un résultat, ni additionner des devises différentes. Elle nécessite une analyse des écrans et droits existants avant toute modification.

**Suite réalisée le même jour :** consulter le [lot espaces financiers](ESPACES_FINANCIERS_2026-10-26.md) pour le journal commun, le bilan, les accès aux dossiers et la validation la plus récente.
