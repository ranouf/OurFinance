# M6 — revue des accès et de la sauvegarde (18 novembre 2026)

Ce document distingue les contrôles observés sur `ourfinance-test` des décisions encore nécessaires avant production. Il ne contient aucune valeur de secret ni donnée Splitwise privée.

## Accès observés sur TEST

| Contrôle            | Constat                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identité du Worker  | Identité dédiée au projet `ourfinance-test` avec `roles/datastore.user`. Ce rôle couvre la base ; la vérification de groupe est faite par le Worker et les Firestore Security Rules côté client.                                |
| Clés de service    | L'[audit TEST du 18 novembre](https://github.com/ranouf/OurFinance/issues/30#issuecomment-6969305289) relève une clé utilisateur active, sans expiration automatique, pour chacune des trois identités. La clé Worker a été [renouvelée sur TEST](https://github.com/ranouf/OurFinance/issues/154#issuecomment-6970214505), puis la clé Rules/index a été [renouvelée](https://github.com/ranouf/OurFinance/issues/154#issuecomment-6970850423). Une seule clé utilisateur active subsiste pour chacune de ces deux identités. Hosting reste à évaluer séparément. |
| Origine HTTP        | Les deux domaines Hosting TEST sont autorisés par valeurs exactes `ALLOWED_ORIGIN`/`ALLOWED_SECONDARY_ORIGIN` ; origine étrangère refusée 403. Une preview n'est acceptée que par valeur exacte temporaire `ALLOWED_PREVIEW_ORIGIN`, retirée après l'essai. |
| Profils des membres | `#134` au SHA `9ad3bee` : sans jeton 401, propriétaire/membre actif 200, tiers/révoqué 403 ; uniquement identifiants et noms actifs, aucun courriel ni champ privé. Flags/fixtures retirés, route 503.                          |
| Firestore           | Après la rotation Rules/index au SHA `2dcd6bb`, deux workflows Firestore TEST ont réussi, dont le second avec l’ancienne clé désactivée. La release active correspond au fichier du SHA et 0 index composite actif correspondent aux 0 déclarés ; les exceptions de champ non déclarées ne sont pas couvertes. Refaire le contrôle après tout changement.                                                        |
| Hosting             | `#121` au SHA `e4e6979` : preview isolée avec CSP, `no-referrer`, `nosniff`, `DENY` sur `/` et `/dashboard`, CSS chargé et aucune violation CSP de la page observée. Le site TEST principal n'a pas été remplacé par cet essai. |

Les trois identités observées sont limitées à `ourfinance-test` : `ourfinance-worker-test` (`roles/datastore.user`), `ourfinance-hosting-test` (`roles/firebase.viewer`, `roles/firebasehosting.admin`, `roles/serviceusage.apiKeysViewer`) et `ourfinance-fs-test-deploy` (`roles/datastore.indexAdmin`, `roles/firebaserules.admin`, `roles/serviceusage.serviceUsageViewer`). Le secret Worker reste dans Cloudflare, le secret Rules/index dans l'environnement GitHub `test`, et le secret Hosting au niveau du dépôt GitHub. Les noms ne prouvent pas à eux seuls l'absence de tout accès à la production : l'IAM de la cible doit être contrôlé séparément.

## Sauvegarde et restauration

L'export/import géré Firestore exige facturation et bucket Cloud Storage ; il n'est pas disponible sur le projet Spark actuel. L'archive applicative `group-v2-partial` conserve groupe, membres, préférences, dépenses, remboursements, imports, commentaires, catégories, activité et octets des reçus privés, mais pas les comptes Firebase Auth.

La restauration du groupe d'origine et de ses préférences a réussi sur TEST avec un reçu privé, puis avec 30 PNG préparés et nettoyés (`#119`). Les lectures propriétaire/membre ont réussi et les accès tiers/révoqué ont été refusés. `#139` a été fusionné après retest réel au SHA `ecf6200` : récupération propriétaire des états `staging` et `cleanup_pending`, préparation concurrente refusée 409, nettoyage 204 et retour `active` 200 ; 30 assets fictifs supprimés. La route est désactivée hors du groupe POC explicitement configuré. Le Worker TEST a été libéré avec flags retirés, `/health` 200 et route 503.

Après un quota ou une réponse perdue lors du commit, `GET /groups/{groupId}/backup/restores/{restoreId}/outcome` permet au propriétaire actif avec courriel vérifié de consulter **cet identifiant précis** : `200 {restoreId,outcome:"committed"|"locked"}`. Une identité absente obtient 401, un propriétaire révoqué 403, un état différent ou inconnu 409, un quota fournisseur 503 `provider_quota_exceeded`. La route suit le même garde V1 ou POC limité au groupe que la restauration ; elle ne renvoie ni archive, ni reçu, ni liste des autres tentatives. `locked` ou 409 ne prouvent pas qu'une nouvelle restauration est sûre : le client doit conserver l'identifiant et attendre une décision de reprise. L'[essai TEST de #194](https://github.com/ranouf/OurFinance/pull/194#issuecomment-6973349074) au SHA `12e592c` a vérifié propriétaire 200, identifiant différent 409, tiers 403 et sans jeton 401 ; le code est fusionné. Un 429 Firestore réel au point exact de reprise reste à prouver séparément dans #188.

## Décisions et contrôles avant production

Les réponses HTTP **420/429** de Cloudinary et les réponses **429** des transactions Firestore couvertes par le Worker sont signalées au client par `503 { "error": "provider_quota_exceeded" }`. Le code public est fixe : le corps de réponse du fournisseur, les URL signées et les jetons ne sont jamais renvoyés. Le client doit afficher un message de quota explicite et permettre une nouvelle tentative ultérieure ; ce contrat ne crée aucune limite quotidienne métier. Les erreurs produites par la plateforme Cloudflare avant l'exécution du Worker restent hors de ce contrat et nécessitent un contrôle réel des quotas et alertes.

Le correctif [#199](https://github.com/ranouf/OurFinance/pull/199) préserve ce signal dans la reprise propriétaire des journaux de reçus : un quota fournisseur est propagé au handler 503 et le journal reste disponible pour un retry. Les tests synthétiques couvrent Firestore 429 et Cloudinary 429 ; le [parcours TEST](https://github.com/ranouf/OurFinance/issues/30#issuecomment-6974821277) du même HEAD a vérifié droits, nettoyage privé et idempotence, sans provoquer un quota réel sur le service partagé.

Les PR API brouillons [#204](https://github.com/ranouf/OurFinance/pull/204) et [#206](https://github.com/ranouf/OurFinance/pull/206) portent deux invariants distincts : un identifiant natif CSV indépendant de l'alias et réservé même après annulation, puis un document de dépense écrit par les transactions concurrentes d'activation de reçu et de suppression. Les [15 tests émulateur de #204](https://github.com/ranouf/OurFinance/pull/204#issuecomment-6982884789) incluent un vrai commit/undo Firestore ; une [course REST manuelle de #206](https://github.com/ranouf/OurFinance/pull/206#issuecomment-6982721591) a produit une seule validation 200 et un refus 409 dans les deux ordres. L'émulateur exige un adaptateur `batchGet` dans ces essais parce que son GET transactionnel expire ([#211](https://github.com/ranouf/OurFinance/issues/211)). Ces preuves ne remplacent pas les essais HTTP authentifiés et Cloudinary sur TEST, encore bloqués par la fixture vérifiée [#205](https://github.com/ranouf/OurFinance/issues/205). Aucun de ces PR n'est fusionné.

- La clé Worker et la clé Rules/index ont été renouvelées sur TEST avec retour arrière disponible jusqu’à leur désactivation ; préparer séparément la rotation de l’identité Hosting et revoir les rôles IAM sur l’environnement cible.
- Mesurer les quotas Firebase Spark, Cloudflare Free et Cloudinary Free et prévoir alertes/nettoyage des pièces orphelines selon [le protocole de surveillance Free](M6_QUOTAS_FREE.md) ; un relevé TEST daté existe, mais les compteurs quotidiens officiels Cloudflare/Cloudinary et la réception d’alertes restent ouverts dans #159.
- Les tests locaux simulent déjà un échec d'upload Cloudinary, un échec d'inventaire Firestore, une réponse de commit perdue et un nettoyage différé ; le lecteur de flux est testé à 20 000 000 et 20 000 001 octets. [Sur TEST](https://github.com/ranouf/OurFinance/issues/30#issuecomment-6967727329), l'aperçu a répondu 413 à 20 000 001 octets et 400 à 20 000 000 octets invalides sans écriture ; un ZIP V2 synthétique valide de 18 761 771 octets a obtenu un aperçu 200. La restauration complète d'un ZIP valide de 20 Mo et une panne fournisseur globale restent ouvertes.
- Rejouer Security Rules, reçus privés, révocation, invitations QR et refus intergroupes sur le SHA final intégré.
- Valider Google OAuth, emails externes et domaines Auth autorisés sur le TEST final. La preview CSP éphémère n'a pas pu synchroniser son domaine Auth automatiquement.
- Garder la décision de publication production distincte de la fusion des PR.

## Rotation de l'identité Worker sur TEST — protocole de référence

Ce protocole concerne uniquement `ourfinance-api-dev` et une identité dédiée à `ourfinance-test`. Il a été [exécuté sur TEST](https://github.com/ranouf/OurFinance/issues/154#issuecomment-6970214505) avec une seule nouvelle clé active, et reste le runbook des prochaines rotations. La mise à jour d'un secret Cloudflare peut publier une nouvelle version du Worker : réserver TEST dans l'issue #30 et attendre la fin de tout autre essai avant de commencer.

1. Avec une session administrative autorisée, inventorier les clés actives et les rôles IAM de l'identité TEST. Consigner uniquement les identifiants de clés non secrets et les rôles ; vérifier que l'identité n'a aucun accès de production. Avant de commencer, confirmer que la valeur de l'ancienne clé est disponible dans un coffre approuvé pour un éventuel retour arrière. Sinon, définir un autre retour arrière vérifiable. Garder l'ancienne clé active pendant l'essai.
2. Créer une nouvelle clé pour **la même identité TEST**. Transférer sa valeur directement dans le secret Cloudflare `FIREBASE_SERVICE_ACCOUNT_JSON` du seul Worker TEST, sans la placer dans le dépôt, dans GitHub Actions, dans les logs, dans une capture ou dans un commentaire. Détruire les copies locales temporaires après le transfert.
3. Sur le SHA Worker exact déployé, contrôler `/health` puis une opération fictive authentifiée nécessitant un jeton serveur Firestore et une lecture d'appartenance ; vérifier les droits propriétaire/membre et les refus tiers/révoqué. Une réponse `/health` 200 seule ne prouve pas que la nouvelle clé fonctionne. Consigner les codes HTTP, le SHA, l'identifiant non secret de la nouvelle clé et l'heure dans #30, puis nettoyer les fixtures.
4. En cas d'échec, remettre l'ancienne valeur du secret depuis le coffre approuvé, vérifier de nouveau l'opération fictive et **ne pas désactiver l'ancienne clé**. Documenter l'échec sans valeur de secret. Après réussite complète, désactiver puis supprimer l'ancienne clé dans IAM, confirmer que la nouvelle opération fictive fonctionne encore et inventorier les clés actives restantes.

La rotation de production, son accès de secours et les rôles IAM de l'environnement cible demandent une validation distincte. Ce protocole ne donne aucune autorisation de déploiement production.

## Autorisation explicite des déploiements TEST

Les workflows manuels Hosting, Firestore et Worker acceptent uniquement une réservation TEST active d'une ligne, écrite par `ranouf` dans #30 et datée de moins d'une heure. Elle doit avoir exactement ce corps, où le SHA compte 40 caractères :

```text
Réservation TEST active pour <SHA>
```

L'accord visuel dans #30 ou #122 doit avoir exactement le corps correspondant au canal demandé :

```text
Validation visuelle approuvée pour preview <SHA>
Validation visuelle approuvée pour live <SHA>
```

Écrire **une seule** des deux lignes d'accord dans le commentaire Hosting. Publier le protocole et les résultats de l'essai dans d'autres commentaires #30. Pour annuler avant l'exécution, modifier ou supprimer le commentaire de réservation ou d'accord indiqué au workflow. Une réservation annulée, un accord refusé ou une phrase qualifiée ne satisfont pas ces gardes ; le SHA, le canal Hosting, la CI et la cible TEST restent contrôlés séparément. Le garde ne remplace pas la validation visuelle réelle du propriétaire.

## Rotation des autres accès TEST — suivi #154

Effectuer les rotations une identité à la fois, dans un créneau TEST réservé. Pour Hosting et Rules/index, créer une seconde clé de la même identité, garder l'ancienne active, modifier uniquement le secret consommé par le workflow concerné, puis exécuter le workflow sur un SHA figé avec réservation #30 et comparer le résultat réel (en-têtes/version Hosting ou release Rules/index). Supprimer l'ancienne clé seulement après réussite ; en cas d'échec, restaurer l'ancien secret et vérifier le service avant toute révocation. Éviter d'imprimer la clé dans la commande, le journal ou la description du run.

Avant de déplacer `TEST_FIREBASE_DEPLOY_SA_JSON` du niveau dépôt vers l'environnement `test`, inventorier tous ses consommateurs, ajouter le garde d'environnement au workflow Hosting, vérifier une publication TEST contrôlée puis supprimer le secret de dépôt. Un simple secret homonyme dans l'environnement ne réduit pas la portée de l'ancien secret de dépôt.

Le workflow manuel `test-hosting-identity-check.yml` permet un prévol **en lecture seule** : SHA `main` et CI exacts, réservation active #30, identité dédiée au seul projet `ourfinance-test`, puis HTTP 200 sur la liste des sites Hosting TEST. Il ne construit ni ne déploie le site et ne remplace pas l'accord visuel requis par `test-hosting-deploy.yml`. Son [premier essai réussi](https://github.com/ranouf/OurFinance/issues/154#issuecomment-6972080844) au SHA `fafd7bc5` a gardé le secret et la clé inchangés : GET des sites HTTP 200. Un HTTP 200 ne prouve ni la publication Hosting ni une rotation ; conserver le secret de dépôt et l'ancienne clé jusqu'à la publication contrôlée et à sa vérification visuelle. Préparer séparément le déplacement du secret vers l'environnement `test`, le retour arrière depuis le coffre et la suppression de l'ancien secret seulement après ce contrôle. Ne jamais exposer la clé dans les journaux.

Le workflow `test-token-expiry-reminder.yml` vérifie chaque lundi, sans lire le secret, la date d'expiration auditée du jeton Cloudflare TEST (17 novembre 2027). À partir de 90 jours avant cette date, il publie une seule fois un rappel dans [#154](https://github.com/ranouf/OurFinance/issues/154) ; un marqueur propre à chaque date évite les doublons. Après toute rotation, mettre à jour `TOKEN_EXPIRY_DATE` dans le workflow et vérifier le nouveau calendrier : le rappel repose sur cette date déclarée, pas sur l'état réel du jeton chez Cloudflare. Il ne remplace ni la vérification du détenteur ni un contrôle du fournisseur.

Pour renouveler ce jeton, créer un second jeton limité au seul `ourfinance-api-dev`, mettre à jour le secret GitHub `test`, vérifier un déploiement/smoke TEST sous réservation, puis révoquer l'ancien. Garder les deux jetons valides pendant la vérification du retour arrière. Les clés Google sans expiration exigent aussi un rappel de rotation périodique. Consigner dans #154 uniquement dates, identifiants de clés non secrets, rôles, SHA, codes et nettoyage ; ne publier aucune valeur de secret.
