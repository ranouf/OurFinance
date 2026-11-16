# M2 — création atomique de groupe, état

Le Worker dispose d'une route `POST /groups` qui exige un ID token Firebase vérifié avec courriel confirmé. Il valide le nom et une devise ISO prise en charge par `Intl`, puis prépare une opération Firestore atomique à trois documents : groupe, membre `owner` actif et référence personnelle. Les règles interdisent aux clients d'écrire la référence ; ils peuvent lire uniquement leurs références. La route renvoie 503 si l'identité serveur n'est pas configurée.

## Configuration manquante

Le secret Cloudflare `FIREBASE_SERVICE_ACCOUNT_JSON` doit contenir une identité de service **du projet de test `ourfinance-test`**, avec permissions Firestore minimales pour les collections métier nécessaires. Sa clé ne doit jamais apparaître dans GitHub, Angular, les logs ou ce chat. Actuellement, le Worker est `workers_dev = false` et aucun déploiement n'est fait. Avant activation, valider IAM, rotation, quotas/rate limiting, origine CORS et tests d'abus. Ne pas utiliser l'identité serveur de production.

Le CLI Wrangler de cet environnement n'est pas authentifié ; le jeton GitHub actuel n'a pas accès à l'API des secrets Actions (HTTP 403). Les secrets Cloudinary existants n'ont pas été copiés. Aucun test réel de création de groupe n'a été effectué ; les tests locaux vérifient la structure des trois écritures et l'échange de jeton OAuth avec des réponses simulées.
