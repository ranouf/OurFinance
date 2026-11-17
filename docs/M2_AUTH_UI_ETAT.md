# M2 — interface de connexion de test

L'interface Angular propose inscription email/mot de passe, vérification de l'adresse, connexion email ou Google, réinitialisation et déconnexion. Elle n'initialise Firebase que si `/app-config.json` existe et pointe vers `ourfinance-test`. Sans configuration, elle montre un état explicite. Le fichier est ignoré par Git ; `npm run config:test` le génère à partir de `TEST_FIREBASE_API_KEY`, `TEST_FIREBASE_AUTH_DOMAIN`, `TEST_FIREBASE_PROJECT_ID` et `TEST_FIREBASE_APP_ID` fournis par l'environnement.

Le typecheck et le build passent. Le parcours réel n'est pas encore testé dans un navigateur connecté au projet, et aucun déploiement n'a été effectué. Les groupes, invitations et dépenses restent désactivés tant que les écritures sécurisées du Worker ne sont pas disponibles.
