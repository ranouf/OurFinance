# Déploiement manuel des règles Firestore sur TEST

Le workflow `Deploy test Firestore manually` publie uniquement `firestore.rules` et `firestore.indexes.json` sur **`ourfinance-test`**. Il ne déploie ni Hosting, ni Worker, ni la production. La PR qui introduit ce workflow reste en brouillon tant que son premier essai réel n'a pas été validé.

## Prérequis

1. Réserver la pile TEST dans l'[issue #30](https://github.com/ranouf/OurFinance/issues/30) avec le SHA complet, le protocole et les autres essais en cours. La réservation doit venir du propriétaire, contenir `TEST` et dater de moins d'une heure au contrôle du workflow. Vérifier manuellement qu'elle n'a pas été libérée depuis.
2. Configurer le secret `TEST_FIRESTORE_DEPLOY_SA_JSON` dans l'environnement GitHub `test` avec une identité dédiée au seul projet `ourfinance-test`. Lui accorder uniquement les permissions nécessaires à la publication des règles et index Firestore ; vérifier les permissions IAM effectivement requises sur ce projet avant le premier lancement. Ne pas réutiliser une identité de production ni publier sa clé.
3. Faire passer `PR validation` sur le SHA visé et vérifier le diff des règles et index. Les tests locaux ne prouvent pas l'état de la release TEST active.

## Lancement

Depuis `main`, le propriétaire lance le workflow avec le SHA complet à 40 caractères et l'URL du commentaire de réservation. Le workflow vérifie le commentaire de l'issue #30 et le dernier run `PR validation` réussi pour ce SHA exact, récupère le commit, vérifie les fichiers, exécute `npm run test:rules` sur émulateur local, contrôle que la clé de service annonce `project_id=ourfinance-test`, puis lance `firebase-tools deploy --only firestore:rules,firestore:indexes --project ourfinance-test`.

Le workflow Firestore et celui du Worker partagent une concurrence GitHub pour éviter deux publications backend simultanées. Cela ne remplace pas la coordination avec les essais locaux et le workflow Hosting.

Après le premier essai, relire la release des règles et la liste des index actifs sur TEST, vérifier les refus intergroupes et les membres révoqués sur des comptes fictifs, nettoyer la fixture et libérer la pile dans l'issue #30. Si une étape échoue, ne pas déclarer le déploiement validé et conserver le SHA déployé exact dans le compte rendu.
