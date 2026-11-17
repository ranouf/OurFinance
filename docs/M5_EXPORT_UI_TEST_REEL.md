# M5 — essai de l'interface d'export sur la pile de test

Utiliser le SHA exact de la PR #54 et réserver/libérer `ourfinance-test` et `ourfinance-api-dev` dans l'issue #30 avant tout déploiement. Déployer uniquement Firebase Hosting de **test** avec la configuration publique actuelle. Le Worker médias existant peut rester à son SHA validé. Aucun déploiement production.

## Fixture fictive

Créer un groupe à deux membres actifs, un tiers et un membre à révoquer, tous avec comptes Auth fictifs. Ajouter une dépense de 101 unités mineures CAD (paiement 101, parts 50 et 51), un règlement de 51, un import historique équilibré, une catégorie personnalisée et un PNG 1×1 fictif. Noter les identifiants pour pouvoir supprimer tous les documents. Activer temporairement `ENABLE_MEDIA_POC=true` et `MEDIA_POC_GROUP_ID` pour ce seul groupe, uniquement pendant l'essai ZIP.

## Contrôles

1. Depuis un navigateur ordinateur connecté comme membre actif vérifié, ouvrir le panneau « Exporter un groupe ». Choisir le groupe et télécharger successivement CSV, JSON et ZIP. Vérifier les noms `ourfinance-<groupId>-partiel-<date>.*`, les types de fichiers, leur ouverture et les contenus attendus. Le CSV doit garder les impacts +51/−51 du règlement, les 101 unités mineures de la dépense et `undetermined` pour l'import. Le JSON doit contenir les montants et la catégorie, mais ni `publicId`, ni URL signée, ni octets PNG. Le ZIP doit contenir `manifest.json`, `group.json` et le PNG privé, avec empreintes valides ; ne pas publier ses octets.
2. Vérifier que l'écran avertit de la portée partielle et du caractère privé des reçus, et que le bouton est désactivé sans groupe. Sur mobile 390 px, contrôler lisibilité, navigation clavier/tactile et absence de débordement horizontal. Capturer uniquement l'interface avec données fictives, sur ordinateur et mobile ; joindre deux images et, si utile, une courte vidéo n'exposant ni fichiers téléchargés, ni jetons.
3. Comme tiers puis membre révoqué, vérifier que le groupe n'est pas offert dans l'interface ; refaire le contrôle négatif du script `tools/export-poc/check.mts` avec `TEST_EXPECT_DENIED=true` si nécessaire. Ne pas confondre l'absence de groupe dans la liste avec une preuve de refus Firestore. Vérifier le comportement de la session si elle est révoquée pendant la préparation, selon les possibilités de la fixture.
4. Après l'essai, supprimer les fichiers téléchargés et les captures non destinées au PR de l'espace privé local. Supprimer l'asset Cloudinary, tous les documents et comptes fictifs ; retirer les deux flags médias. Confirmer `/health=200`, route médias `503`, et libérer explicitement la pile dans l'issue #30.

N'ajouter au PR que les captures/vidéo de l'application de test avec données entièrement fictives si la visibilité des pièces jointes convient. Aucun CSV, JSON, ZIP, reçu, jeton, mot de passe, journal ou capture Splitwise privée ne va dans le dépôt, le PR ou le chat. Ce test ne prouve ni restauration, ni cohérence transactionnelle, ni compatibilité Safari/iOS.
