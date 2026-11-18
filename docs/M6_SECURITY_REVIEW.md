# M6 — revue des accès et de la sauvegarde (17 novembre 2026)

Ce document distingue les contrôles observés sur `ourfinance-test` des décisions encore nécessaires avant production. Il ne contient aucune valeur de secret ni donnée Splitwise privée.

## Accès observés sur TEST

| Contrôle            | Constat                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identité du Worker  | Identité dédiée au projet `ourfinance-test` avec `roles/datastore.user`. Ce rôle couvre la base ; la vérification de groupe est faite par le Worker et les Firestore Security Rules côté client.                                |
| Clés de service    | L'[audit TEST du 18 novembre](https://github.com/ranouf/OurFinance/issues/30#issuecomment-6969305289) relève une clé utilisateur active, sans expiration automatique, pour chacune des trois identités Worker, Hosting et Rules/index. Aucune rotation n'a encore été exécutée. |
| Origine HTTP        | Origine étrangère refusée 403. Une origine de preview n'est acceptée que par valeur exacte temporaire `ALLOWED_PREVIEW_ORIGIN`, retirée après l'essai.                                                                          |
| Profils des membres | `#134` au SHA `9ad3bee` : sans jeton 401, propriétaire/membre actif 200, tiers/révoqué 403 ; uniquement identifiants et noms actifs, aucun courriel ni champ privé. Flags/fixtures retirés, route 503.                          |
| Firestore           | Les Rules de la pile M6 antérieure ont été comparées à la release TEST active ; aucun index composite déclaré ou actif alors. Refaire le contrôle après tout changement.                                                        |
| Hosting             | `#121` au SHA `e4e6979` : preview isolée avec CSP, `no-referrer`, `nosniff`, `DENY` sur `/` et `/dashboard`, CSS chargé et aucune violation CSP de la page observée. Le site TEST principal n'a pas été remplacé par cet essai. |

Les trois identités observées sont limitées à `ourfinance-test` : `ourfinance-worker-test` (`roles/datastore.user`), `ourfinance-hosting-test` (`roles/firebase.viewer`, `roles/firebasehosting.admin`, `roles/serviceusage.apiKeysViewer`) et `ourfinance-fs-test-deploy` (`roles/datastore.indexAdmin`, `roles/firebaserules.admin`, `roles/serviceusage.serviceUsageViewer`). Le secret Worker reste dans Cloudflare, le secret Rules/index dans l'environnement GitHub `test`, et le secret Hosting au niveau du dépôt GitHub. Les noms ne prouvent pas à eux seuls l'absence de tout accès à la production : l'IAM de la cible doit être contrôlé séparément.

## Sauvegarde et restauration

L'export/import géré Firestore exige facturation et bucket Cloud Storage ; il n'est pas disponible sur le projet Spark actuel. L'archive applicative `group-v2-partial` conserve groupe, membres, préférences, dépenses, remboursements, imports, commentaires, catégories, activité et octets des reçus privés, mais pas les comptes Firebase Auth.

La restauration du groupe d'origine et de ses préférences a réussi sur TEST avec un reçu privé, puis avec 30 PNG préparés et nettoyés (`#119`). Les lectures propriétaire/membre ont réussi et les accès tiers/révoqué ont été refusés. `#139` a été fusionné après retest réel au SHA `ecf6200` : récupération propriétaire des états `staging` et `cleanup_pending`, préparation concurrente refusée 409, nettoyage 204 et retour `active` 200 ; 30 assets fictifs supprimés. La route est désactivée hors du groupe POC explicitement configuré. Le Worker TEST a été libéré avec flags retirés, `/health` 200 et route 503.

## Décisions et contrôles avant production

Les réponses HTTP **420/429** de Cloudinary et les réponses **429** des transactions Firestore couvertes par le Worker sont signalées au client par `503 { "error": "provider_quota_exceeded" }`. Le code public est fixe : le corps de réponse du fournisseur, les URL signées et les jetons ne sont jamais renvoyés. Le client doit afficher un message de quota explicite et permettre une nouvelle tentative ultérieure ; ce contrat ne crée aucune limite quotidienne métier. Les erreurs produites par la plateforme Cloudflare avant l'exécution du Worker restent hors de ce contrat et nécessitent un contrôle réel des quotas et alertes.

- Tester la rotation de la clé de service et son retour arrière sur TEST ; revoir les rôles IAM sur l'environnement cible.
- Mesurer les quotas Firebase Spark, Cloudflare Free et Cloudinary Free et prévoir alertes/nettoyage des pièces orphelines selon [le protocole de surveillance Free](M6_QUOTAS_FREE.md) ; les compteurs et alertes réels restent à relever dans #159.
- Les tests locaux simulent déjà un échec d'upload Cloudinary, un échec d'inventaire Firestore, une réponse de commit perdue et un nettoyage différé ; le lecteur de flux est testé à 20 000 000 et 20 000 001 octets. Rejouer sur TEST, avec fixture fictive et nettoyage, les pannes contrôlées pertinentes et le rejet HTTP d'une archive de plus de 20 Mo. Ne pas confondre ces tests locaux avec un essai réel sur Worker TEST.
- Rejouer Security Rules, reçus privés, révocation, invitations QR et refus intergroupes sur le SHA final intégré.
- Valider Google OAuth, emails externes et domaines Auth autorisés sur le TEST final. La preview CSP éphémère n'a pas pu synchroniser son domaine Auth automatiquement.
- Garder la décision de publication production distincte de la fusion des PR.

## Rotation de l'identité Worker sur TEST — protocole à exécuter

Ce protocole concerne uniquement `ourfinance-api-dev` et une identité dédiée à `ourfinance-test`. Il n'a **pas encore été exécuté**. La mise à jour d'un secret Cloudflare peut publier une nouvelle version du Worker : réserver TEST dans l'issue #30 et attendre la fin de tout autre essai avant de commencer.

1. Avec une session administrative autorisée, inventorier les clés actives et les rôles IAM de l'identité TEST. Consigner uniquement les identifiants de clés non secrets et les rôles ; vérifier que l'identité n'a aucun accès de production. Avant de commencer, confirmer que la valeur de l'ancienne clé est disponible dans un coffre approuvé pour un éventuel retour arrière. Sinon, définir un autre retour arrière vérifiable. Garder l'ancienne clé active pendant l'essai.
2. Créer une nouvelle clé pour **la même identité TEST**. Transférer sa valeur directement dans le secret Cloudflare `FIREBASE_SERVICE_ACCOUNT_JSON` du seul Worker TEST, sans la placer dans le dépôt, dans GitHub Actions, dans les logs, dans une capture ou dans un commentaire. Détruire les copies locales temporaires après le transfert.
3. Sur le SHA Worker exact déployé, contrôler `/health` puis une opération fictive authentifiée nécessitant un jeton serveur Firestore et une lecture d'appartenance ; vérifier les droits propriétaire/membre et les refus tiers/révoqué. Une réponse `/health` 200 seule ne prouve pas que la nouvelle clé fonctionne. Consigner les codes HTTP, le SHA, l'identifiant non secret de la nouvelle clé et l'heure dans #30, puis nettoyer les fixtures.
4. En cas d'échec, remettre l'ancienne valeur du secret depuis le coffre approuvé, vérifier de nouveau l'opération fictive et **ne pas désactiver l'ancienne clé**. Documenter l'échec sans valeur de secret. Après réussite complète, désactiver puis supprimer l'ancienne clé dans IAM, confirmer que la nouvelle opération fictive fonctionne encore et inventorier les clés actives restantes.

La rotation de production, son accès de secours et les rôles IAM de l'environnement cible demandent une validation distincte. Ce protocole ne donne aucune autorisation de déploiement production.

## Rotation des autres accès TEST — suivi #154

Effectuer les rotations une identité à la fois, dans un créneau TEST réservé. Pour Hosting et Rules/index, créer une seconde clé de la même identité, garder l'ancienne active, modifier uniquement le secret consommé par le workflow concerné, puis exécuter le workflow sur un SHA figé avec réservation #30 et comparer le résultat réel (en-têtes/version Hosting ou release Rules/index). Supprimer l'ancienne clé seulement après réussite ; en cas d'échec, restaurer l'ancien secret et vérifier le service avant toute révocation. Éviter d'imprimer la clé dans la commande, le journal ou la description du run.

Avant de déplacer `TEST_FIREBASE_DEPLOY_SA_JSON` du niveau dépôt vers l'environnement `test`, inventorier tous ses consommateurs, ajouter le garde d'environnement au workflow Hosting, vérifier une publication TEST contrôlée puis supprimer le secret de dépôt. Un simple secret homonyme dans l'environnement ne réduit pas la portée de l'ancien secret de dépôt.

Pour le jeton Cloudflare du workflow Worker, prévoir une alerte avant son expiration (17 novembre 2027 selon l'audit), créer un second jeton limité au seul `ourfinance-api-dev`, mettre à jour le secret GitHub `test`, vérifier un déploiement/smoke TEST sous réservation, puis révoquer l'ancien. Garder les deux jetons valides pendant la vérification du retour arrière. Les clés Google sans expiration exigent aussi un rappel de rotation périodique. Consigner dans [#154](https://github.com/ranouf/OurFinance/issues/154) uniquement dates, identifiants de clés non secrets, rôles, SHA, codes et nettoyage ; ne publier aucune valeur de secret.
