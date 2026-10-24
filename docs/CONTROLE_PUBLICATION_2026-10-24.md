# Contrôle avant publication — 24 octobre 2026

Périmètre : améliorations des parcours de service et préparation du déploiement, destinées à la branche `master`. Les commandes de mise en service restent décrites dans le [guide de vérification du déploiement](runbooks/verification-deploiement.md).

## Secrets et fichiers privés

- Les fichiers d'environnement réels du poste, notamment `backend/.env`, `backend/.env.demo.local` et `frontend/.env`, sont ignorés et absents du contenu à publier. Les modèles `.example` contiennent des paramètres factices.
- Les sauvegardes, certificats, justificatifs téléversés, builds, rapports navigateur et outils d'audit locaux restent exclus du commit.
- Les valeurs sensibles des environnements locaux ont été comparées au contenu publiable, sans les afficher : aucune correspondance restante après correction du seeder historique.
- Gitleaks 8.30.1, téléchargé depuis sa publication officielle et vérifié par SHA-256, analyse le contenu destiné au commit avec les règles standard et la configuration [.gitleaks.toml](../.gitleaks.toml).
- Deux faux positifs vérifiés sont autorisés par leur valeur exacte et leur fichier : le texte public servant d'exemple de secret JWT et un nom de fichier de migration. Aucun répertoire de code ni dossier de tests n'est exclu de l'analyse.
- Les mots de passe des fixtures automatisées et du serveur MySQL éphémère de CI sont des données de test publiques ; ils ne fournissent aucun accès au service hébergé.

## Correction de l'initialisation administrateur

L'ancien seeder contenait un mot de passe administrateur partagé. Ce littéral et ses réutilisations dans les tests concernés ont été retirés. Le seeder exige désormais `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD`, vérifie la taille du mot de passe et refuse la production. La suppression d'un compte par ce seeder exige également un email explicite et un environnement local.

Cette correction ne change pas les mots de passe de comptes déjà créés et ne réécrit pas l'historique Git déjà publié. Tout compte protégé par l'ancien mot de passe doit faire l'objet d'un changement de mot de passe par son responsable. Aucun mot de passe de production n'a été lu, modifié ou révoqué pendant ce contrôle.

## Validation

| Contrôle | Résultat |
| --- | --- |
| Backend complet, MySQL exigé | 78 suites, 506 tests réussis |
| Interface complète | 59 suites, 183 tests réussis |
| Contrôle du code backend | 302 fichiers, réussi |
| Contrôle du code interface | Réussi |
| Compilation de production de l'interface, `CI=true` | Réussie |
| Navigateur, vrai serveur et MySQL isolé | 9 scénarios réussis lors de la préparation |

L'état des migrations, le stockage durable et la réception réelle des notifications restent à vérifier dans l'environnement hébergé. Le poste ne dispose pas de sa configuration de production. La publication du code ne constitue pas une décision d'ouverture terrain.

## Vérification du premier push

Le premier passage GitHub a validé l'interface, ses scénarios navigateur et la recette MySQL de restauration. Le job backend historique échouait faute de serveur MySQL : les tests d'intégration exigeant la base ne pouvaient pas s'exécuter.

Le workflow backend provisionne désormais un MySQL éphémère, une base de test et le schéma via le migrateur d'intégration existant. Il exige explicitement la connexion MySQL et génère sa clé JWT de test à chaque exécution, sans secret stocké dans le dépôt. Cette préparation a été reproduite localement sur une base neuve isolée : migrations réussies et **506 tests réussis**. Elle ne modifie ni la connexion ni les migrations de production.
