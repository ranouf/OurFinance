# Restauration V2 dans le groupe d’origine — protocole de travail

État : **non disponible dans l’application**. Ce document décrit les contrôles à réaliser avant d’activer une route d’écriture. Le format `group-v2-partial` ne doit pas être présenté comme une sauvegarde complète tant que tous les points ci-dessous ne sont pas couverts.

## Portée

- Restaurer exclusivement le groupe d’origine, avec sa devise inchangée et les mêmes identités, rôles et statuts de membres. Une restauration ne réactive pas un membre révoqué.
- Remplacer les dépenses, règlements, imports, catégories personnalisées, commentaires, activité, reçus privés et préférences personnelles de chaque membre, y compris l’absence de préférence.
- Préserver les auteurs des dépenses pour maintenir la règle « auteur seul » après restauration. Préserver les lots d’import sous `users/{ownerId}/importBatches` pour permettre l’annulation.
- Révoquer les invitations en attente ; invalider ou recalculer tout document dérivé de soldes/statistiques. Inventorier les sous-collections inattendues et refuser plutôt que laisser un état ancien silencieux.

## Conditions préalables

1. Authentifier le jeton Firebase, confirmer le courriel et vérifier côté Worker que le demandeur est propriétaire **actif** au moment de chaque étape.
2. Vérifier le manifeste ZIP, le hachage et la taille de `group.json`, puis le hachage et le type de chaque reçu. Refuser un groupe, une devise ou un ensemble de membres différents.
3. Obtenir le JSON V2 par `GET /groups/{g}/backup/snapshot` : toutes ses lectures Firestore, dont les préférences des membres, partagent une transaction serveur. La collecte cliente V1 suivie d’une lecture serveur des préférences reste marquée `client_partial` et est refusée par la restauration. Vérifier aussi après chaque téléchargement privé que le `publicId` du reçu est celui de l’instantané, ou refuser le ZIP.
4. Comparer l’inventaire du paquet aux documents réellement présents, y compris les préférences absentes et les lots d’import personnels. Montrer le nombre de créations, remplacements et suppressions avant confirmation.

## Séquence sûre recherchée

1. Verrouiller le groupe avec un statut `restoring` et créer atomiquement un journal serveur contenant les `publicId` versionnés attendus. Les règles Firestore doivent refuser les lectures membres pendant ce statut ; toutes les routes Worker doivent aussi le vérifier.
2. Préparer chaque reçu sous son `publicId` Cloudinary **versionné**, sans écraser l’asset actif. Une interruption laisse le journal et le verrou récupérables ; l’annulation déplace ces IDs dans une file de nettoyage durable avant de rouvrir le groupe.
3. Écrire l’état cible et retirer l’état ancien avec un protocole qui ne rend jamais visible un mélange de versions. Une transaction unique doit respecter la taille Firestore de 10 MiB ; au-delà, prévoir une reprise durable avec journal de progression, compensation et contrôle du verrou.
4. Vérifier côté serveur les nombres de documents, les références, les préférences et les médias. Réactiver le groupe seulement après succès. Un échec laisse le groupe verrouillé et une reprise ou un retour arrière documenté ; ne jamais réactiver un état partiel.
5. Après réactivation, supprimer les anciens assets Cloudinary devenus orphelins. Une erreur de suppression doit être enregistrée et relançable sans rendre les médias accessibles à un membre révoqué.

## Essais obligatoires avant ouverture de la route

- Restauration d’une fixture fictive avec dépense modifiée/supprimée, commentaire, remboursement, import annulé, catégorie archivée, plusieurs préférences dont une absente et un reçu privé.
- Refus du tiers, membre ordinaire, propriétaire révoqué, autre groupe/devise/membres, ZIP altéré, requête répétée et opération concurrente.
- Échec injecté à chaque étape de préparation média, transaction, reprise et nettoyage ; aucun état mixte visible, aucun asset orphelin, aucun droit restauré par erreur.
- Émulateur Firestore Rules, tests Worker, essai réel sur `ourfinance-test` avec comptes et données entièrement fictifs, puis nettoyage. Aucun déploiement en production sans décision séparée.
