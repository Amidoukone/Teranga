# Version de recette HTTPS — 27 octobre 2026

**État : configuration préparée et vérifiée localement. Aucun service hébergé, domaine, compte de recette distant ou base distante n’a été créé.**

## Déploiement proposé

Le dépôt référence un backend Render. Le fichier [deploy/recette.render.yaml](../deploy/recette.render.yaml) propose **un nouveau service de recette** qui sert l’interface compilée, l’API et les fichiers depuis une seule origine HTTPS.

| Chemin sur l’origine de recette | Ressource |
| --- | --- |
| `/`, `/login`, `/operations`, `/demandes`, dossiers et autres routes d’interface | Application React compilée |
| `/api` et `/api/v1` | API existante et ses contrôles d’accès |
| `/uploads` | Justificatifs conservés sur le volume du service de recette |
| `/api/ready` | Disponibilité effective de la base pour le contrôle de l’hébergeur |

Le nom proposé est `teranga-recette`, sur une branche `recette` à préparer après revue des changements locaux. L’adresse attribuée par Render reste à confirmer ; aucune disponibilité d’un sous-domaine n’est présumée. Les déploiements automatiques sont désactivés dans cette proposition. Le fichier ne modifie pas les services existants.

Le choix d’une origine commune évite de dépendre de cookies entre domaines distincts pour les sessions sur téléphone. Voir les [explications sur les cookies tiers](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies). Les champs du manifeste suivent la [référence Blueprint Render](https://render.com/docs/blueprint-spec), notamment les commandes avant déploiement, le disque et les variables à renseigner. Le fichier a été lu avec un parseur YAML local ; il n’a pas été soumis à un compte Render.

## Comportement ajouté

- `SERVE_FRONTEND=true` active le service de l’interface compilée ; sans cette option, le backend conserve son fonctionnement API actuel, y compris sa réponse JSON à `/`.
- `FRONTEND_BUILD_DIR` désigne le build, avec un chemin relatif à la **racine du dépôt**, indépendamment du répertoire de lancement. Un build manquant empêche le démarrage de cette option.
- Les liens directs vers les dossiers retrouvent l’application. Une API, un fichier ou un script absent reste une erreur 404 ; il ne reçoit pas une fausse réponse HTML réussie. Les fichiers cachés et source maps ne sont pas servis par cette option.
- Les en-têtes des pages autorisent les fonctions utilisées par l’interface, dont le GPS sur sa propre origine. Les restrictions existantes de l’API restent appliquées à l’API et aux fichiers. Les scripts intégrés au HTML sont autorisés par empreinte ; l’option n’ouvre pas globalement les scripts inline.
- Le HTML de recette porte `noindex, nofollow` et n’est pas mis en cache. Les ressources portant une empreinte peuvent être mises en cache durablement.

## Construction et contrôle

Depuis `backend` :

```powershell
npm.cmd run recette:build
```

Le build dédié se trouve dans `frontend/build-recette`, ignoré par Git. La commande impose `/api` et `/` pour les ressources, l’authentification par cookie et l’absence de repli automatique vers des jetons stockés. Elle remplace les paramètres correspondants d’un éventuel fichier frontend `.env.production`. Les clés de carte et d’observabilité ne sont reprises que depuis les variables explicitement fournies pour ce build.

Après renseignement des variables du service de recette :

```powershell
npm.cmd run recette:check
```

Ce contrôle ne se connecte à aucune base. Il vérifie la configuration de production, la politique de fichiers et la présence du build. Pour `APP_ENVIRONMENT=recette`, le serveur exige également :

- une base MySQL nommée `teranga_recette` ou `teranga_recette_<suffixe>` ; une base locale neuve `teranga_https_e2e_*` est admise uniquement pour le banc automatisé ;
- une unique origine HTTPS commune à `FRONTEND_URL` et `CORS_ORIGINS`, sans ancien lien client vers un autre environnement ;
- `SERVE_FRONTEND=true` et `COOKIE_SAME_SITE=lax`.

Le nom de la base est un garde-fou de configuration. Il ne prouve pas que le compte SQL dispose uniquement de droits sur cette base ni que les secrets diffèrent de ceux de production : ces séparations sont à constater au raccordement.

## Renseignements nécessaires pour la publication

1. **Espace d’hébergement et version.** Confirmer l’espace Render utilisé, le service de recette à créer et la version de code revue. Les changements restent actuellement locaux et non commités ; la branche `recette` n’est pas encore publiée.
2. **Base dédiée.** Fournir au service une connexion MySQL limitée à une nouvelle base `teranga_recette`, avec TLS et les éventuels certificats du fournisseur. Ne pas recopier la connexion de production. La création de cette base n’est pas exécutée par le manifeste.
3. **Origine.** Renseigner la même adresse HTTPS attribuée au service dans `FRONTEND_URL` et `CORS_ORIGINS`. L’interface et les liens vers les fichiers utilisent les chemins relatifs de cette origine.
4. **Fichiers.** Le manifeste prévoit un volume propre au service, monté dans `/var/data/teranga-recette`. Le chemin d’upload est séparé. Sa persistance devra être constatée après un redémarrage ; le test local ne valide pas un futur disque hébergé.
5. **Cartes.** Renseigner `RECETTE_GOOGLE_MAPS_BROWSER_KEY` pour la compilation et `GOOGLE_MAPS_SERVER_KEY` pour l’API, avec les restrictions appropriées à la recette. Les calculs cartographiques et leur configuration distante ne sont pas validés par le GPS simulé du banc local.
6. **Comptes et territoire.** Initialiser le premier responsable avec le bootstrap contrôlé existant, en fournissant des identifiants propres à la recette et une échéance courte. Le désactiver ensuite et retirer ces identifiants de bootstrap. Créer les comptes de chaque rôle, puis configurer le territoire, le contact local, les offres et véhicules nécessaires. Les comptes de l’intégration automatique ne sont pas destinés à cet environnement distant.

Le manifeste vérifie la configuration avant les migrations, puis lance le serveur normal `backend/index.js`, avec ses traitements planifiés. Après publication, suivre les [contrôles de déploiement](runbooks/verification-deploiement.md) et la [fiche de recette utilisateurs](RECETTE_UTILISATEURS_2026-10-27.md). Le contrôle de configuration n’accorde aucune décision d’ouverture.

## Banc HTTPS local et validation

Le fichier `frontend/playwright.recette.config.js` teste le **build compilé** sur `https://127.0.0.1:5443`, avec une base MySQL neuve et des fichiers de test isolés. Le serveur et l’authentification utilisent la configuration `production`. Il écoute uniquement sur la boucle locale et utilise un certificat éphémère dont l’erreur de confiance est acceptée par le navigateur automatisé.

Ce certificat n’est pas une solution de confiance à distribuer aux téléphones et ce banc n’est pas un hébergement partagé. Les tâches planifiées ne sont pas démarrées par le banc de session ; elles restent à constater avec le serveur normal du service de recette.

Depuis `frontend`, après démarrage de MySQL local et construction du build dédié :

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_USER='root'
$env:DB_PASSWORD=''
npm.cmd run e2e:recette
```

- **Backend complet : 623 tests réussis dans 87 suites**, avec MySQL requis, puis **24 tests ciblés réussis** après les derniers ajustements de résolution des chemins et du protocole de connexion de recette. Le premier contrôle ciblé, exécuté pendant la compilation, avait dépassé le délai d’un test d’upload existant ; ce test réussit dans le passage complet sans modification.
- **Six scénarios navigateur HTTPS réussis dans le dernier passage** : quatre rôles connectés via les écrans réels, sessions conservées après rechargement, cookies sécurisés/HttpOnly selon leur usage, aucun jeton persistant ni en-tête Bearer pour les appels de l’interface ; disponibilité agent/prestataire ; rejet d’une mutation sans CSRF et déconnexion ; permission de GPS simulé ; API et ressources absentes correctement en 404 ; prestation agent/client complète avec dépôt, téléchargement et confirmation d’un justificatif sur la même origine HTTPS.
- **Compilation de recette réussie**, ainsi que le contrôle backend de **323 fichiers**, la lecture syntaxique YAML du manifeste et le contrôle des espaces Git.
- Le contrôle `recette:check` a été exécuté avec une configuration factice isolée, sans connexion à une base. Cela valide son exécution, pas les futures ressources hébergées.

Les captures et journaux sont dans `artifacts/https-recette-*`, ignoré par Git. Le certificat local, le GPS simulé et le stockage temporaire du banc ne remplacent pas un certificat public de confiance, un déplacement réel et une vérification du volume hébergé. Les serveurs et le conteneur MySQL de recette sont arrêtés après les contrôles.

La publication nécessite encore un accès utilisable à l’hébergement et les ressources de recette dédiées. Aucun accès Render exploitable n’a été trouvé parmi les outils et variables disponibles dans cette session. Aucun secret n’est inclus dans le manifeste. Aucun commit, push, déploiement ni changement DNS n’a été effectué.
