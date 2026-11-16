# Essai réel de restauration V2 — projet TEST uniquement

État : protocole de validation de la PR #102 ; ne pas l’utiliser sur un groupe réel ni en production. La route est désactivée tant que `ENABLE_RESTORE_POC=true` et `RESTORE_POC_GROUP_ID=<groupe fictif>` ne sont pas configurés ensemble.

## Préparation

1. Réserver `ourfinance-test` et `ourfinance-api-dev` dans l’issue #30. Déployer sur TEST le SHA exact de la PR #102 et ses règles `firestore.rules` ; vérifier que les routes non activées répondent 503.
2. Créer un groupe fictif CAD avec propriétaire, membre actif, membre révoqué et tiers hors groupe ; utiliser exclusivement des données, images et comptes fictifs. Créer une dépense, un commentaire, une catégorie personnalisée, un règlement, un lot d’import et des préférences personnelles différentes.
3. Obtenir `group.json` par `GET /groups/{g}/backup/snapshot` sous `ENABLE_BACKUP_POC=true` et `BACKUP_POC_GROUP_ID=<groupe fictif>`, puis construire et vérifier un ZIP V2 de moins de 20 Mo avec `buildBackupPackageV2FromServerSnapshot`, incluant un PNG privé. Conserver ZIP, jetons et identifiants fictifs hors dépôt, hors PR et hors journaux publics. La collecte client `client_partial` doit être refusée par la route de restauration.
4. Capturer les documents attendus, le solde et les médias privés. Modifier ensuite des opérations fictives pour créer un écart visible avec la sauvegarde.
5. Sur le SHA qui inclut la prévisualisation serveur, envoyer le même ZIP à `POST /groups/{g}/backup/preview` et comparer les comptes de créations, remplacements et suppressions à l’inventaire fictif. Cette route ne doit produire aucune écriture ; répéter avec tiers, membre ordinaire et archive altérée.

## Contrôles HTTP

- `POST /groups/{g}/backup/restores/{uuid}` avec jeton Firebase du propriétaire confirmé, `Content-Type: application/zip` et octets du ZIP : attendu 200 si le nettoyage est complet, 202 si les anciens assets restent à nettoyer.
- Répéter avec tiers, membre ordinaire, propriétaire révoqué, autre groupe, devise ou archive altérée : refus sans écriture. Vérifier aussi 413 au-dessus de 20 Mo.
- Pendant le statut `restoring`, le membre actif ne peut lire ni groupe, ni dépense, ni reçu, ni préférence ; les autres routes Worker doivent aussi refuser les écritures.
- Après succès, vérifier les comptes de documents, auteurs de dépense, commentaires, activité, lots d’import, parts exactes, préférence de chaque membre, reçu privé accessible aux membres actifs et 403 pour le tiers/révoqué. Vérifier la suppression des anciens assets Cloudinary et le journal `restoreJobs/{uuid}` terminé.
- Simuler un échec Cloudinary et un échec Firestore avant le commit ; vérifier l’annulation du verrou, la conservation de l’ancien groupe et la possibilité de relancer le nettoyage via `POST /groups/{g}/backup/restores/{uuid}/cleanup`. Si le résultat du commit est incertain, ne pas forcer une nouvelle restauration : vérifier le marqueur serveur `lastRestoreId` et utiliser la reprise documentée.

## Nettoyage et compte rendu

Retirer les quatre variables POC (sauvegarde et restauration), vérifier 503 sur les routes, `/health` 200, supprimer comptes, documents et assets fictifs. Consigner dans la PR le SHA réellement déployé, les codes HTTP observés, les contrôles de données, les limites et les éventuels échecs. Aucune capture privée fournie par le propriétaire ni média de test dans le dépôt.
