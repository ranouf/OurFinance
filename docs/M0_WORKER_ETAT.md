# M0 — passerelle de test : état

Le Worker vérifie cryptographiquement les ID tokens Firebase (JWKS Google, audience et issuer du projet, expiration), puis lit le document de membre **avec le jeton de l'utilisateur** via l'API REST Firestore. L'accès n'est accordé qu'au membre actif du groupe demandé. Le CORS est limité à l'origine Hosting de test et les réponses ne sont pas mises en cache. Aucune route de dépense ou de média n'est exposée.

Les tests locaux couvrent la vérification JWT, l'usage du jeton pour Firestore, l'origine CORS et les refus sans jeton. Ils n'établissent pas un POC de bout en bout : aucune dépense ni image privée n'a été testée dans les comptes réels. `workers_dev = false` empêche de publier accidentellement ce Worker de travail.

Pour terminer M0, il faut une identité serveur Firestore à privilèges minimaux configurée comme secret Worker, les routes de transaction et de médias privés, puis les tests membre / tiers / révoqué et les mesures de quotas réels. Les secrets Cloudinary déjà présents dans Cloudflare ne sont pas lus ni copiés dans GitHub. Le CLI Wrangler de cet environnement n'est pas authentifié, et le jeton GitHub actuel reçoit HTTP 403 sur la gestion des secrets Actions.
