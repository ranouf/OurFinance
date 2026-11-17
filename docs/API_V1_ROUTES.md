# Activation des routes Worker pour plusieurs groupes

Les routes privilégiées du Worker étaient limitées à un groupe fictif par famille de variables `*_POC_GROUP_ID`. Le mode V1 les rend disponibles à tous les groupes du projet Firebase **uniquement** lorsque `ENABLE_API_V1=true` est défini explicitement dans l'environnement du Worker. Sans cette valeur exacte, les routes restent fermées par défaut ou limitées aux anciens groupes POC configurés pour les essais TEST.

Le mode V1 ne remplace pas l'authentification et les autorisations : chaque route vérifie toujours le jeton Firebase, l'appartenance et les droits nécessaires avant d'écrire. Les invitations QR continuent de résoudre leur groupe depuis l'index serveur du jeton ; la portée POC à un groupe est conservée quand le mode V1 est absent. Les secrets Firebase et Cloudinary restent requis pour les routes qui les utilisent.

## Essai TEST avant activation durable

1. Réserver `ourfinance-api-dev` et `ourfinance-test` dans l'issue #30 avec le SHA exact. Ne pas activer le mode V1 pendant un autre essai.
2. Déployer uniquement ce SHA sur le Worker TEST, **sans** `ENABLE_API_V1` ; vérifier `/health` 200 et les routes métier désactivées 503. Les anciens flags POC restent utilisables pour un groupe fictif ciblé.
3. Créer deux groupes et comptes entièrement fictifs, de devises différentes. Activer temporairement `ENABLE_API_V1=true` sur TEST. Vérifier sur les deux groupes les opérations autorisées et les refus tiers/révoqué : création de groupe, dépenses, remboursements, imports, catégories, invitations QR, reçus privés, sauvegarde et restauration. Vérifier qu'un jeton QR d'un groupe n'expose pas l'autre groupe et qu'aucune devise ne traverse les groupes.
4. Retirer `ENABLE_API_V1` et tous les flags POC temporaires, supprimer les comptes, documents et assets fictifs, puis vérifier `/health` 200 et routes métier 503. Consigner les codes et le nettoyage dans l'issue #30.

Le workflow manuel de déploiement du Worker TEST n'active jamais `ENABLE_API_V1` et vérifie qu'une route de restauration reste désactivée. **Aucune activation production** n'est couverte par ce protocole ; elle exige la validation M1–M6 et une décision séparée.
