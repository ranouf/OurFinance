# M6 — couverture mesurée en CI

`npm run test:coverage` exécute ensemble les tests unitaires et Worker avec la couverture V8 de Node. La validation PR exige **90 % de lignes, de branches et de fonctions**. La commande inclut explicitement les services métier Angular, les utilitaires financiers/import, les calculs de statistiques/accueil et les modules Worker, afin qu'un fichier non importé par les tests ne disparaisse pas silencieusement du dénominateur. Les composants de panneau d'interface sont exclus de cette mesure Node ; ils exigent des essais Angular et navigateur distincts.

Sur le SHA de cette tranche (18 novembre 2026), la dernière mesure locale avec ce périmètre explicite est **96,91 % lignes, 90,14 % branches, 95,50 % fonctions** (422 tests, aucun échec). Les tests supplémentaires exercent notamment les refus d'accès, conflits, transactions, nettoyages, archives et métadonnées malformées. La validation PR échoue désormais sous 90 % pour chacun des trois indicateurs ; publier la ventilation par fichier à chaque PR de page.

Ce chiffre **n’est pas la couverture globale d’OurFinance** : les composants et templates Angular non chargés par les tests Node en sont absents. Le critère du plan « au moins 80 % global » reste donc ouvert. Il nécessite une instrumentation Angular/E2E distincte, notamment pour les formulaires, l’authentification, les états asynchrones et l’accessibilité. Le test des règles Firestore reste un job séparé dans la même CI.

Les modules financiers purs et les routes Worker ont des tests, mais une moyenne élevée peut masquer un module sensible insuffisamment exercé. Continuer les scénarios réels membre/tiers/révoqué, reçus privés et transactions ; ne pas utiliser ce seuil comme preuve unique de sécurité.
