# Recette Playwright locale

Depuis la racine, installer Node 24 et Java 21, puis exécuter les trois commandes suivantes.

~~~sh
npm ci
npx playwright install chromium
npm run test:ui
~~~

Sur Linux, utiliser la variante `npx playwright install --with-deps chromium` pour installer aussi les bibliothèques système. Libérer les ports locaux 4207, 8080 et 9099 avant le lancement. Firebase démarre Auth et Firestore avec les règles du dépôt. Playwright démarre Angular en développement pour inclure la galerie. Les données éphémères disparaissent à la fermeture. Chaque test utilise un contexte de navigateur neuf. Les appels du navigateur vers des services distants sont bloqués. La réponse du Worker pour l’invitation valide est simulée dans le test concerné.

Le job `ui` de `PR validation` exécute cette même commande à chaque PR et sur `main`. Un échec de scénario fait échouer le workflow. Les résultats et diagnostics locaux sont dans `test-results/`, exclu de Git.

| Parcours de recette | Assertions dans le navigateur |
|---|---|
| A1–A2 | Accès anonyme aux routes privées, validation du courriel, mode récupération, inscription, vérification du courriel émulé, connexion, rechargement, déconnexion et Retour. |
| I1 | Fragment incomplet et invitation valide déclinée. Vérification des appels avant acceptation. |
| H1, G1 et C1 | Navigation authentifiée, choix illustrés du groupe, prévisualisation de catégorie et blocage du nom vide. |
| D2–D3 et R1 | Cinq répartitions de 10,01 CAD, erreur à 99 %, dates inclusives et inversées, détail, refus du reçu invalide et annulation de suppression. |
| S1–S2 | Période au clavier, restitution du focus et refus du remboursement nul. |
| P1, M1–M3 | Persistance du nom et de la langue du profil, restriction membre des commandes de restauration, accès aux commandes du propriétaire, rejet CSV interdevise, téléchargement et lecture du JSON, refus local du ZIP invalide. |
| U1 et contrôles communs | Galerie de développement, navigation privée FR/EN/JA, largeurs 320, 390, 768 et 1280 px. |

La recette fournisseur conserve les scénarios qui nécessitent Google OAuth réel, livraison de courriel, confidentialité Cloudinary, transactions réelles du Worker et restauration complète avec comparaison des octets. Les tests Worker et Firestore du job `web` complètent les contrôles du navigateur. La matrice de référence figure dans [le protocole QA](https://github.com/ranouf/OurFinance/blob/docs/recette-site-et-integration-design/docs/RECETTE_SITE_V1.md).

