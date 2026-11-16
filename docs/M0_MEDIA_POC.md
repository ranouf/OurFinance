# M0 — POC des justificatifs privés

## Ce qui est préparé

Le Worker accepte une petite image JPEG/PNG brute (2 Mo maximum, lecture bornée du flux) sur `POST /groups/{g}/expenses/{e}/attachments`. Il vérifie le Firebase ID token, l'appartenance active au groupe et l'existence de la dépense avant d'envoyer l'image à Cloudinary avec le type **`authenticated`**. Un identifiant d'asset est créé côté Worker. Les métadonnées sont écrites dans une dépense du groupe. Si cette écriture échoue, le Worker tente de supprimer l'asset distant. Une révocation entre upload et écriture est revérifiée.

`GET .../attachments/{id}` vérifie à nouveau l'appartenance et les métadonnées, signe une URL Cloudinary `image/download` valable 60 secondes, puis **sert les octets par proxy** avec `Cache-Control: no-store`. L'URL signée n'est pas retournée au navigateur. `DELETE` est limité au propriétaire de la pièce ou au propriétaire du groupe ; il marque d'abord la métadonnée supprimée, puis demande la suppression distante. Une suppression Cloudinary échouée laisse une pièce privée mais inaccessible depuis l'application, à nettoyer manuellement.

Ces routes sont **désactivées par défaut**. Il faut `ENABLE_MEDIA_POC=true` et `MEDIA_POC_GROUP_ID` égal au seul groupe fictif de test. La création de groupes reste désactivée indépendamment. Ne jamais activer le POC pour un groupe contenant des données réelles.

## Vérification réelle à faire depuis la session locale

1. Déployer ce commit dans le Worker de test en conservant les secrets Cloudinary existants et `FIREBASE_SERVICE_ACCOUNT_JSON`. Ne pas copier les secrets dans GitHub ou le dépôt. Configurer `ENABLE_MEDIA_POC=true` et `MEDIA_POC_GROUP_ID` avec l'identifiant du groupe fictif ; aucun autre groupe ne doit passer.
2. Préparer deux membres actifs, un tiers et une dépense fictive sous `groups/{g}/expenses/{e}`. Ne pas utiliser de capture Splitwise, reçu réel ni donnée personnelle.
3. Exécuter `tools/media-poc/check.mjs` étape `upload` avec les ID tokens dans l'environnement local du processus. Le script envoie uniquement un PNG synthétique de 1×1 pixel. Attendus : upload 201, propriétaire 200, second membre 200, tiers 403, URL Cloudinary non signée différente de 200. Conserver seulement `TEST_ATTACHMENT_ID` pour les étapes suivantes ; ne pas conserver les jetons dans un journal.
4. Mettre le second membre à `status: revoked`, puis exécuter l'étape `revoked` avec son jeton encore valide. Attendu : 403.
5. Exécuter l'étape `cleanup` avec le jeton du propriétaire. Attendus : suppression 204, lecture ultérieure 404. Vérifier dans Cloudinary que l'asset synthétique a disparu, puis supprimer les comptes et documents fictifs. Retirer `ENABLE_MEDIA_POC` et `MEDIA_POC_GROUP_ID` après le test.
6. Relever les coûts/quota Cloudinary Free et vérifier qu'aucun accès direct non signé n'a fonctionné. Si le plan Free refuse le type `authenticated` ou le téléchargement privé, arrêter le POC et documenter le comportement exact.

## Limites avant M5

Ce POC n'est pas encore exécuté contre Cloudinary Free. L'application Angular ne propose pas encore de sélection, redimensionnement, suppression des métadonnées EXIF, gestion de plusieurs reçus ni export. Le chemin de suppression distante et la compensation doivent être validés avec un vrai asset synthétique. L'usage de l'identité de service exige un audit IAM ; le groupe doit être contrôlé dans le Worker à chaque requête, car cette identité contourne les Firestore Rules. Les scénarios de concurrence, d'abus et de quotas restent ouverts. **Aucun reçu réel ne doit être chargé.**

## Diagnostic du premier essai Cloudinary Free

Le premier upload réel via le Worker a échoué en 502. La clé Cloudinary dédiée a reçu HTTP 403 « Request forbidden due to missing permissions (actions=[create]) » lorsque l'upload n'indiquait pas `asset_folder`. Le cloud de test utilise les dossiers dynamiques. Le dossier `ourfinance-test` existe désormais et la clé dédiée a le rôle de gestionnaire **sur ce seul dossier** ; un upload signé avec `asset_folder=ourfinance-test` suivi d'une suppression a réussi en test direct. L'upload Worker signe et envoie maintenant ce paramètre ; son nouvel essai de bout en bout reste à exécuter. Les essais échoués ont été nettoyés, sans asset résiduel constaté, et les variables d'activation du POC ont été retirées.

## Diagnostic runtime après le deuxième essai

Au commit `9f70cc58d7dece1a07a4730518fce6f5a332074f`, l'upload réel a réussi (201), le tiers a reçu 403 et l'URL Cloudinary non signée 401, mais les lectures autorisées ont renvoyé 502 générique. La même lecture, avec la même fixture et les mêmes métadonnées, a renvoyé 200 avec le code Worker bundlé exécuté localement. Cette différence indique une exception propre au runtime Cloudflare dans le chemin de lecture. Le nouveau Worker retourne seulement un **code d'étape fixe** (`member_read`, `expense_read`, `metadata_read`, `download_sign`, `download_fetch`, `download_redirect`, `download_response` ou `internal`) en cas de 502 ; aucun détail de l'exception ni URL signée n'est divulgué. Il suit au plus une redirection HTTPS vers `api.cloudinary.com` ou `res.cloudinary.com`, ce que le mode `redirect: error` précédent interdisait. Le script de test n'affiche que ce code autorisé si une lecture échoue encore. La cause exacte n'est pas déclarée résolue tant que le nouvel essai Cloudflare n'a pas réussi.

## Résultat réel final (16 novembre 2026, 07:00:27 UTC)

Le commit `1e75c9869d5ecd2200391a0dc3b1f1bcea0dbe40` a été déployé sur `ourfinance-api-dev` (version Cloudflare `1ba4257e-b77d-41db-b9e3-6a1a8151c37b`). Avec trois comptes, un groupe, une dépense et un PNG 1×1 **entièrement fictifs**, les codes HTTP observés sont : upload propriétaire **201**, lecture propriétaire **200**, lecture second membre actif **200**, lecture tiers **403**, URL Cloudinary `authenticated` non signée **401**, lecture du second membre après révocation **403** avec jeton encore valide, suppression propriétaire **204**, lecture après suppression **404**. Cloudinary Free a accepté l'upload `authenticated`, le téléchargement privé par proxy et la suppression, sans erreur ni limite Free observée pendant cet essai ponctuel. Il ne s'agit pas d'une garantie de coût nul ou de capacité future.

Après l'essai, `ENABLE_MEDIA_POC` et `MEDIA_POC_GROUP_ID` ont été retirés ; zéro asset résiduel a été relevé, cinq documents Firestore sur cinq et trois comptes fictifs sur trois ont été supprimés. La clé dédiée reste limitée au dossier `ourfinance-test` ; aucune clé, aucun jeton, aucun reçu réel n'a été transmis au dépôt. Les fonctions générales de reçus M5 restent ouvertes (interface, compression et retrait EXIF, plusieurs pièces, export, quotas et gestion d'échec à grande échelle).
