# M5 — export des octets de reçus privés

`downloadReceiptForExport` lit un reçu par la route privée du Worker, avec le jeton Firebase courant. La fonction refuse une URL HTTP, un utilisateur au courriel non confirmé, un identifiant de chemin invalide, une réponse refusée, un type MIME inattendu, une en-tête de fichier incohérente et un corps de plus de 2 Mo. Elle calcule SHA-256 sur les octets récupérés, fournit un nom de fichier relatif et ne retourne ni URL Cloudinary signée ni `publicId`.

Cette tranche ne sauvegarde encore aucun fichier. Le JSON de groupe de la PR #43 reste `mediaIncluded: false` tant que chaque octet n'a pas été écrit dans un paquet privé avec son empreinte et vérifié lors d'une restauration. L'interface locale des reçus est développée sur une autre branche par le fil laptop ; cet export reste dans `src/app/features/import-export/`.

Essai réel ultérieur, après réservation de la pile : créer une dépense et un PNG 1×1 fictifs, télécharger comme propriétaire et autre membre actif, comparer SHA-256, puis vérifier les refus tiers/révoqué et la disparition après suppression. Nettoyer l'asset Cloudinary, les documents et comptes fictifs, retirer les variables POC et vérifier la route à 503. Ne jamais publier octets, jetons ou signatures dans le dépôt ou la PR.
