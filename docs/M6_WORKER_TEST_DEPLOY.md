# Déploiement manuel du Worker TEST

Le workflow `Deploy test Worker manually` publie **uniquement** `ourfinance-api-dev` sur le domaine `workers.dev`. Il ne déploie ni Hosting, ni Firestore, ni la production.

La publication manuelle des règles et index Firestore TEST suit la [procédure distincte](M6_FIRESTORE_TEST_DEPLOY.md). Les deux workflows partagent une concurrence GitHub pour éviter deux publications backend simultanées.

## Prérequis

1. Réserver `ourfinance-api-dev` et `ourfinance-test` dans l'[issue #30](https://github.com/ranouf/OurFinance/issues/30), avec le PR et le SHA complet. Ne pas lancer deux essais sur la pile simultanément.
2. Configurer dans l'environnement GitHub `test` le secret `CLOUDFLARE_TEST_API_TOKEN` avec la permission minimale de publication des Workers sur un **compte Cloudflare isolé pour TEST**, ainsi que la variable non secrète `CLOUDFLARE_TEST_ACCOUNT_ID`. Vérifier la portée réelle du jeton : si Cloudflare ne permet pas de le restreindre au seul script, le compte TEST ne doit pas héberger de Worker de production. Aucun jeton ni valeur de secret dans le dépôt ou l'issue.
3. Conserver `FIREBASE_SERVICE_ACCOUNT_JSON`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` dans les secrets **Cloudflare** du Worker. Le workflow ne les lit pas.

## Exécution et résultat attendu

Lancer `Deploy test Worker manually` depuis `main`, avec le SHA complet à 40 caractères et l'URL du commentaire de réservation de l'issue #30. Le workflow vérifie que ce commentaire appartient à l'issue #30, vient du propriétaire, mentionne explicitement la réservation TEST et le SHA demandé, et date d'au plus **une heure au moment de l'exécution**. Si l'exécution a attendu trop longtemps, publier une nouvelle réservation avant de relancer. Il exige aussi un descendant du socle API `#139` avant toute publication, récupère ce commit, exécute typecheck et tests Worker, écrit une configuration TEST fixe, puis déploie avec Wrangler. Cette configuration n'inclut aucun flag POC et désactive donc les routes d'essai après publication. Vérifier manuellement que la réservation est encore active au lancement : le workflow ne déduit pas sa libération d'un commentaire ultérieur.

Le smoke test exige `/health` **200** et **503** sur dix routes privilégiées sans authentification (dépenses, remboursements, imports, catégories, QR, médias, profils, sauvegarde et restauration). Il vérifie le groupe fictif `ci-disabled` et n'affirme pas qu'un autre groupe temporairement activé serait fermé ; libérer tous les flags TEST avant le lancement. Vérifier dans le run la version du Worker et le SHA demandé, puis seulement activer temporairement les flags nécessaires à l'essai fictif selon son protocole. Nettoyer les données et assets fictifs, retirer les flags et libérer la pile dans l'issue #30.

Le premier lancement du workflow doit rester un essai sur TEST avec son jeton limité. Si le secret ou la variable manque, le workflow échoue avant déploiement. Ne pas considérer un build ou un `--dry-run` local comme une preuve de publication réelle.
