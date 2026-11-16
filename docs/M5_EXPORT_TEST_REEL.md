# M5 — essai intégré de l'export partiel sur la pile de test

Réservation et libération dans l'issue #30. Utiliser le SHA exact de la PR du script et les règles Firestore de la pile intégrée, uniquement `ourfinance-test` et `ourfinance-api-dev`. Aucun déploiement production. Le script `tools/export-poc/check.mts` n'enregistre ni ZIP, ni JSON, ni reçu ; il n'affiche que des comptages synthétiques et le marqueur de portée.

## Préparation locale

- Créer quatre comptes Auth fictifs au courriel confirmé : propriétaire, second membre, tiers et membre qui sera révoqué. Créer un groupe fictif avec les trois membres, une dépense de 101 unités mineures avec catégorie instantanée et paiements/parts totalisant chacun 101, un règlement de 51, une catégorie personnalisée, un import historique équilibré et un PNG 1×1 fictif lié à la dépense. Toutes les données doivent être nettoyables par identifiant de fixture.
- Vérifier les règles publiées sur le projet test. Activer temporairement `ENABLE_MEDIA_POC=true` et `MEDIA_POC_GROUP_ID` seulement pour ce groupe ; garder les autres routes POC fermées. Le Worker et Hosting peuvent conserver leur code actuel si les routes médias de la PR #14 et les règles des imports sont présentes.
- Fournir les variables `TEST_FIREBASE_API_KEY`, `TEST_FIREBASE_AUTH_DOMAIN`, `TEST_FIREBASE_APP_ID`, `TEST_FIREBASE_PROJECT_ID=ourfinance-test`, `TEST_WORKER_URL=https://ourfinance-api-dev.ur-inance.workers.dev`, `TEST_GROUP_ID`, `TEST_MEMBER_EMAIL`, `TEST_MEMBER_PASSWORD` seulement dans l'environnement local. Ne rien coller dans le chat, l'issue ou les journaux.

## Contrôles

1. En tant que membre actif, exécuter `npx tsx tools/export-poc/check.mts`. Attendus : groupe fictif, nombres exacts de dépenses et reçus, ZIP en mémoire, manifeste vérifié et `scope=group-v1-partial`. Vérifier séparément que le JSON conserve les 101 unités mineures et les impacts historiques, sans `publicId`, URL signée ni octets du PNG.
2. Refaire le script comme tiers puis comme membre révoqué avec `TEST_EXPECT_DENIED=true`. Attendu : `Export refusé comme attendu` à cause d'un `permission-denied` Firestore, sans paquet. Pour une révocation pendant le téléchargement, utiliser un contrôle ciblé de la fixture ou le test de régression local de la PR #47 ; ne pas présenter un simple refus initial comme preuve de cette course.
3. Si la fixture comporte 51 dépenses synthétiques, vérifier que le résultat en compte 51 pour exercer la seconde page. Cette variante ne doit pas dépasser les limites de 10 Mo JSON et 25 reçus actifs.
4. Supprimer l'asset Cloudinary, les documents et comptes fictifs ; retirer `ENABLE_MEDIA_POC` et `MEDIA_POC_GROUP_ID`, vérifier `/health=200` et route médias `503`. Publier seulement les codes et comptages non sensibles dans l'issue #30 et la PR.

Ce contrôle ne valide ni snapshot transactionnel, ni données de compte et commentaires absents du format, ni restauration. L'archive reste partielle. Ne jamais ajouter le ZIP, le JSON, les reçus ou captures de validation au dépôt ou à la PR.
