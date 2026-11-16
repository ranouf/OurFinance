# M0 — protocole d’accès réel au Worker de test

URL de test confirmée : `https://ourfinance-api-dev.ur-inance.workers.dev` ; version Cloudflare `f2ac49e4-d996-48e5-824d-2039d0c8ec5b` issue du commit `9bc76366d1493bfea951e1db140a5ef029debb78`. La création de groupes reste désactivée (`ENABLE_GROUP_CREATION` absent).

## Résultats HTTP déjà observés

Depuis l’environnement cloud le 16 novembre 2026 UTC : `/health` → 200, `POST /groups` → 503, `/groups/fake-group/access` sans jeton → 401, `/health` avec origine non autorisée → 403. Ces résultats vérifient le déploiement et les refus de base, **pas** l’appartenance à un groupe réel.

## Essai membre / tiers / révoqué à faire localement

1. Créer trois comptes Firebase Auth entièrement fictifs dans `ourfinance-test`, puis obtenir leurs ID tokens par un outil local sécurisé. Ne pas écrire de jeton dans le dépôt, un PR, un journal ou ce chat.
2. Dans Firestore **de test**, créer un groupe fictif `groups/{groupId}` et les documents `members/{uid}` nécessaires avec `role` et `status`. Le membre autorisé doit être `active`, le tiers absent du groupe. Utiliser uniquement des noms et montants fictifs.
3. Depuis la session locale, définir `TEST_WORKER_URL`, `TEST_GROUP_ID`, `TEST_MEMBER_ID_TOKEN` et `TEST_OUTSIDER_ID_TOKEN` dans l’environnement du processus, puis exécuter `node tools/worker-access/check.mjs`. Attendu : membre 200, tiers 403.
4. Révoquer le membre dans Firestore (`status: revoked`), obtenir un ID token encore valide pour lui, définir `TEST_REVOKED_ID_TOKEN`, relancer le script. Attendu : révoqué 403. Ce test doit prouver que l’accès est relu après révocation.
5. Supprimer les données fictives et les jetons temporaires hors dépôt après l’essai. Noter uniquement les codes HTTP et l’horodatage dans la PR.

Le script n’affiche jamais les jetons. Il vérifie explicitement l’hôte du Worker de test pour éviter d’envoyer un jeton vers une autre destination. Les résultats membre/tiers/révoqué sont **non exécutés** tant que la fixture et les jetons locaux ne sont pas préparés.
