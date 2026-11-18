# Activation des routes Worker pour plusieurs groupes

Les routes privilégiées du Worker étaient limitées à un groupe fictif par famille de variables `*_POC_GROUP_ID`. Le mode V1 les rend disponibles à tous les groupes du projet Firebase **uniquement** lorsque `ENABLE_API_V1=true` est défini explicitement dans l'environnement du Worker. Sans cette valeur exacte, les routes restent fermées par défaut ou limitées aux anciens groupes POC configurés pour les essais TEST.

Le mode V1 ne remplace pas l'authentification et les autorisations : chaque route vérifie toujours le jeton Firebase, l'appartenance et les droits nécessaires avant d'écrire. Les invitations QR continuent de résoudre leur groupe depuis l'index serveur du jeton ; la portée POC à un groupe est conservée quand le mode V1 est absent. Les secrets Firebase et Cloudinary restent requis pour les routes qui les utilisent.

## Cycle de vie de la page Groupes

- `POST /groups/:groupId/members/:memberId/revoke` exige un propriétaire actif et un membre cible actif. Une transaction marque l'appartenance de groupe et la référence personnelle `revoked`, avec un événement d'activité. Elle conserve les dépenses et les dettes historiques ; le propriétaire ne peut pas se révoquer lui-même. Une seconde révocation répond `409 member_inactive`.
- `POST /groups/:groupId/archive` exige le propriétaire actif. Une transaction marque le groupe `archived` et écrit un événement d'activité ; elle ne supprime aucun document financier. Les membres actifs conservent la lecture de l'historique et le propriétaire peut encore exporter la sauvegarde V2. Les écritures client restent interdites ; les routes Worker de dépenses, remboursements, imports et invitations exigent un groupe actif. Les opérations de maintenance des reçus existants peuvent encore servir au nettoyage. Les invitations existantes ne peuvent plus être acceptées. Une seconde archive répond `403 owner_required` car le groupe est déjà inactif.

Ces routes sont fermées sans `ENABLE_API_V1=true`. Pour un essai TEST limité à un groupe fictif, `ENABLE_GROUP_LIFECYCLE_POC=true` et `GROUP_LIFECYCLE_POC_GROUP_ID` ouvrent uniquement ce groupe ; retirer les deux variables après l'essai. Les erreurs ne renvoient aucun document privé. Un test intégré doit couvrir propriétaire, membre, tiers, cible révoquée, deux groupes et nettoyage de la fixture avant fusion.

## Essai TEST avant activation durable

1. Réserver `ourfinance-api-dev` et `ourfinance-test` dans l'issue #30 avec le SHA exact. Ne pas activer le mode V1 pendant un autre essai.
2. Déployer uniquement ce SHA sur le Worker TEST, **sans** `ENABLE_API_V1` ; vérifier `/health` 200 et les routes métier désactivées 503. Les anciens flags POC restent utilisables pour un groupe fictif ciblé.
3. Créer deux groupes et comptes entièrement fictifs, de devises différentes. Activer temporairement `ENABLE_API_V1=true` sur TEST. Vérifier sur les deux groupes les opérations autorisées et les refus tiers/révoqué : création de groupe, dépenses, remboursements, imports, catégories, invitations QR, reçus privés, sauvegarde et restauration. Vérifier qu'un jeton QR d'un groupe n'expose pas l'autre groupe et qu'aucune devise ne traverse les groupes.
4. Retirer `ENABLE_API_V1` et tous les flags POC temporaires, supprimer les comptes, documents et assets fictifs, puis vérifier `/health` 200 et routes métier 503. Consigner les codes et le nettoyage dans l'issue #30.

Le workflow manuel de déploiement du Worker TEST n'active jamais `ENABLE_API_V1` et vérifie qu'une route de restauration reste désactivée. **Aucune activation production** n'est couverte par ce protocole ; elle exige la validation M1–M6 et une décision séparée.

## Limite des requêtes V1

Le mode V1 exige la liaison Cloudflare `API_RATE_LIMITER`, configurée à 120 requêtes par 60 secondes par adresse IP et emplacement Cloudflare. Le Worker renvoie `429 rate_limited` avec `Retry-After: 60` lorsque la limite est atteinte. Si la liaison, l'adresse de connexion ou le service de limitation manque, il renvoie `503 rate_limit_unavailable` et ne sert pas les routes V1. `/health` et les requêtes CORS `OPTIONS` restent accessibles. Les anciens essais POC, sans `ENABLE_API_V1`, conservent leur comportement.

Cette limite est approximative entre emplacements Cloudflare et ne constitue pas un plafond quotidien strict. La valeur `namespace_id` doit être réservée pour ce Worker dans le compte Cloudflare TEST avant activation ; le workflow manuel TEST doit déployer la même liaison que `wrangler.toml`.

### Essai ciblé de la limite sur TEST

Après la validation de la pile V1 et la réservation de TEST dans l'issue #30, déployer le SHA exact avec `API_RATE_LIMITER`, sans activer V1. Vérifier `/health` 200 et une route métier fermée 503. Confirmer que le namespace de la liaison appartient au seul Worker TEST, puis activer temporairement `ENABLE_API_V1=true` sans autre flag POC.

Depuis une seule connexion de test, appeler séquentiellement `GET /groups/ci-limit/access` **sans jeton** pendant une fenêtre de 60 secondes. Les premières réponses doivent être 401 ; la limite doit ensuite produire au moins un `429 {"error":"rate_limited"}` avec `Retry-After: 60`. Le point de bascule exact peut varier selon le point de présence Cloudflare et le trafic déjà compté. Pendant le refus, vérifier `/health` 200 et un prévol CORS autorisé `OPTIONS` 204. Après l'expiration de la fenêtre, vérifier qu'une requête métier sans jeton redevient 401.

Retirer `ENABLE_API_V1` et tous les flags temporaires, puis vérifier `/health` 200 et `POST /groups/ci-limit/expenses` 503. Aucun compte, dépense ou justificatif n'est nécessaire à cet essai. Ne pas chercher à provoquer un quota Cloudflare ou fournisseur réel ; le repli `rate_limit_unavailable` est couvert par les tests locaux. Consigner SHA, codes HTTP, heure et retrait des flags dans l'issue #30 avant de libérer TEST.
