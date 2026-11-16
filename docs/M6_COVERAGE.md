# M6 — couverture mesurée en CI

`npm run test:coverage` exécute ensemble les tests unitaires et Worker avec la couverture V8 de Node. La CI exige au moins **80 % de lignes, branches et fonctions parmi les modules chargés par ces tests**. Lors de la mesure locale du 16 novembre 2026, avant l’ajout du seuil, 93,17 % des lignes, 85,34 % des branches et 95,77 % des fonctions de ces modules étaient couverts.

Ce chiffre **n’est pas la couverture globale d’OurFinance** : les composants et templates Angular non chargés par les tests Node en sont absents. Le critère du plan « au moins 80 % global » reste donc ouvert. Il nécessite une instrumentation Angular/E2E distincte, notamment pour les formulaires, l’authentification, les états asynchrones et l’accessibilité. Le test des règles Firestore reste un job séparé dans la même CI.

Les modules financiers purs et les routes Worker ont des tests, mais une moyenne élevée peut masquer un module sensible insuffisamment exercé. Continuer les scénarios réels membre/tiers/révoqué, reçus privés et transactions ; ne pas utiliser ce seuil comme preuve unique de sécurité.
