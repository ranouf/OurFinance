# M6 — revue des accès et de la sauvegarde (16 novembre 2026)

## Pile de test observée

| Contrôle | Résultat |
| --- | --- |
| Identité du Worker | Identité dédiée à `ourfinance-test`, avec le seul rôle projet `roles/datastore.user`. Ce rôle couvre la base du projet ; l'isolation entre groupes repose sur les vérifications du Worker et les règles appliquées aux clients. |
| Clés de cette identité | Une clé gérée par la plateforme et une clé utilisateur active. La clé utilisateur n'a pas de date d'expiration automatique : prévoir une rotation et supprimer l'ancienne clé après vérification du remplacement. |
| Secrets du Worker de test | `FIREBASE_SERVICE_ACCOUNT_JSON`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` et `CLOUDINARY_CLOUD_NAME` présents. Les variables temporaires d'activation des catégories et dépenses sont absentes après l'essai. Aucune valeur de secret n'a été lue pour cette revue. |
| Origine HTTP | Une origine étrangère reçoit 403 ; `/health` reçoit 200. |
| Base Firestore de test | Protection contre la suppression et restauration à un instant donné désactivées. Le projet n'a pas de facturation active. |

## Sauvegarde et restauration

L'[export/import géré de Firestore](https://firebase.google.com/docs/firestore/manage-data/export-import) exige une facturation active et un bucket Cloud Storage. Il n'est donc pas utilisable sur le projet de test Spark actuel sans changement de plan. Aucune sauvegarde complète ni restauration n'a été validée.

Le parcours à vérifier avant une mise en production doit couvrir les groupes, membres, invitations, dépenses, remboursements, imports, préférences et événements, ainsi que les octets des reçus privés et leurs métadonnées. Un export applicatif doit préserver les identifiants et les relations entre documents, confirmer les comptes restaurés, puis prouver sur une fixture isolée que les accès membre, tiers et membre révoqué restent corrects. Le format d'export M5 doit être arrêté avant de construire ce contrôle.

## Décisions restantes

- Définir la méthode de rotation de la clé de service et l'accès de secours en cas de révocation.
- Valider le format d'export applicatif ou choisir séparément une offre permettant l'export géré ; aucun changement de facturation n'a été fait.
- Réaliser un essai réel de restauration et de lecture des reçus privés après restauration.
- Réexaminer ces paramètres sur l'environnement de production avant toute ouverture.
