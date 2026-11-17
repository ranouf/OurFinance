# M6 — revue des accès et de la sauvegarde (17 novembre 2026)

Ce document distingue les contrôles observés sur `ourfinance-test` des décisions encore nécessaires avant production. Il ne contient aucune valeur de secret ni donnée Splitwise privée.

## Accès observés sur TEST

| Contrôle | Constat |
| --- | --- |
| Identité du Worker | Identité dédiée au projet `ourfinance-test` avec `roles/datastore.user`. Ce rôle couvre la base ; la vérification de groupe est faite par le Worker et les Firestore Security Rules côté client. |
| Clé de service | Une clé utilisateur active, sans expiration automatique, a été observée lors de l'audit antérieur. Sa rotation et le retrait de l'ancienne clé restent à définir. |
| Origine HTTP | Origine étrangère refusée 403. Une origine de preview n'est acceptée que par valeur exacte temporaire `ALLOWED_PREVIEW_ORIGIN`, retirée après l'essai. |
| Profils des membres | `#134` au SHA `9ad3bee` : sans jeton 401, propriétaire/membre actif 200, tiers/révoqué 403 ; uniquement identifiants et noms actifs, aucun courriel ni champ privé. Flags/fixtures retirés, route 503. |
| Firestore | Les Rules de la pile M6 antérieure ont été comparées à la release TEST active ; aucun index composite déclaré ou actif alors. Refaire le contrôle après tout changement. |
| Hosting | `#121` au SHA `e4e6979` : preview isolée avec CSP, `no-referrer`, `nosniff`, `DENY` sur `/` et `/dashboard`, CSS chargé et aucune violation CSP de la page observée. Le site TEST principal n'a pas été remplacé par cet essai. |

## Sauvegarde et restauration

L'export/import géré Firestore exige facturation et bucket Cloud Storage ; il n'est pas disponible sur le projet Spark actuel. L'archive applicative `group-v2-partial` conserve groupe, membres, préférences, dépenses, remboursements, imports, commentaires, catégories, activité et octets des reçus privés, mais pas les comptes Firebase Auth.

La restauration du groupe d'origine et de ses préférences a réussi sur TEST avec un reçu privé, puis avec 30 PNG préparés et nettoyés (`#119`). Les lectures propriétaire/membre ont réussi et les accès tiers/révoqué ont été refusés. `#139` a été fusionné après retest réel au SHA `ecf6200` : récupération propriétaire des états `staging` et `cleanup_pending`, préparation concurrente refusée 409, nettoyage 204 et retour `active` 200 ; 30 assets fictifs supprimés. La route est désactivée hors du groupe POC explicitement configuré. Le Worker TEST a été libéré avec flags retirés, `/health` 200 et route 503.

## Décisions et contrôles avant production

- Définir/tester la rotation de la clé de service et un accès de secours ; revoir les rôles IAM sur l'environnement cible.
- Mesurer les quotas Firebase Spark, Cloudflare Free et Cloudinary Free et prévoir alertes/nettoyage des pièces orphelines.
- Les tests locaux simulent déjà un échec d'upload Cloudinary, un échec d'inventaire Firestore, une réponse de commit perdue et un nettoyage différé ; le lecteur de flux est testé à 20 000 000 et 20 000 001 octets. Rejouer sur TEST, avec fixture fictive et nettoyage, les pannes contrôlées pertinentes et le rejet HTTP d'une archive de plus de 20 Mo. Ne pas confondre ces tests locaux avec un essai réel sur Worker TEST.
- Rejouer Security Rules, reçus privés, révocation, invitations QR et refus intergroupes sur le SHA final intégré.
- Valider Google OAuth, emails externes et domaines Auth autorisés sur le TEST final. La preview CSP éphémère n'a pas pu synchroniser son domaine Auth automatiquement.
- Garder la décision de publication production distincte de la fusion des PR.
