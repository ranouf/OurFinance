# M2 — groupes dans l’interface, état

Pour un compte dont le courriel est confirmé, l’application lit les références personnelles `users/{uid}/groupMemberships` puis les documents de groupe autorisés par les règles. Le formulaire de création propose toutes les devises ISO prises en charge par `Intl` et appelle `POST /groups` avec le Firebase ID token. Il apparaît seulement si une URL Worker HTTPS de test est configurée dans `app-config.json` via `TEST_WORKER_URL`.

Le service Firestore est chargé à la demande pour conserver le bundle initial sous le budget Angular. En l’absence du Worker et de son identité serveur, la création est annoncée indisponible. Le serveur Angular local répond HTTP 200, mais aucun parcours réel de groupe n’a été exécuté. La tentative de validation visuelle ordinateur/mobile a échoué car le navigateur cloud retourne « Browser Use could not read requirements » avant d’afficher l’application ; aucune capture ni vidéo n’est jointe.

Il reste à configurer le secret de service Firestore dans Cloudflare, déployer sur une URL de test, vérifier la création et l’isolation avec plusieurs comptes fictifs, puis valider les écrans desktop/mobile. Aucun déploiement de production n’est prévu.
