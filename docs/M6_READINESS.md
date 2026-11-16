# M6 — revue de préparation production (16 novembre 2026 UTC)

Statut : **non prêt pour la production**. Aucun déploiement ni fusion automatique n'a eu lieu.

## Vérifications exécutées

- `npm run typecheck` : passe.
- `npm run build` : passe ; PWA produit un manifeste et un service worker.
- `npm run test:unit` : 27 tests passent (répartitions, devises, préférences, soldes, CSV et parcours récents).
- `npm run test:rules` : téléchargement du JAR bloqué localement, mais la CI GitHub [run 43806177443](https://github.com/ranouf/OurFinance/actions/runs/43806177443) a démarré l’émulateur et validé **4 tests sur 4**.
- `npm audit --omit=dev --audit-level=high` : **passe** après résolution explicite de `@grpc/grpc-js` en version 1.14.7. L'ancienne version 1.9.16 arrivait par `firebase` → `@firebase/firestore` et était concernée par `GHSA-m9gg-hp2v-232j` et `GHSA-f596-whhp-79r4`. Une installation propre, le typecheck, 27 tests unitaires, 41 tests Worker et la compilation passent. Le verrouillage force une version plus récente que la plage transitive de Firestore ; surveiller la compatibilité et supprimer cette résolution lorsque Firestore adoptera une version corrigée.

L'audit complet conserve **14 alertes modérées**, toutes dans la chaîne de développement `firebase-tools`. L'outil propose des changements majeurs pour la plupart des avis ; ne pas les appliquer sans valider les commandes de test et de déploiement. Le build signale aussi un dépassement du budget initial (947,59 ko pour 500 ko). Ces points restent à traiter avant la production.

## Contrôles bloquants

- POC M0 réel : Auth, appartenance Firestore, validation des dépenses dans Worker et Cloudinary `authenticated` avec refus d'un tiers et d'un membre révoqué.
- Routes Worker de création de groupes, invitation unique, dépenses et règlements, avec tests de transactions et de concurrence.
- Emulator Suite : accès inter-groupes, collection group, préférences et révocation.
- Auth et écrans de bout en bout, puis E2E mobile et desktop.
- Import avec fichier Splitwise synthétique représentatif, rapprochement comptable, annulation de batch et export complet.
- Sauvegarde/restauration des données et pièces jointes avec test réel.
- Contrôle IAM du compte de service, secrets Cloudflare, origines CORS, quotas et facturation des trois fournisseurs.
- Essais Android/iOS, ergonomie et accessibilité. Les icônes PWA générées par Angular sont provisoires.

## Gestion des données privées

Les 27 captures ont été décompressées seulement dans `/tmp/ourfinance-private-screens`. Le dépôt ne contient que des observations anonymisées. Aucun justificatif ou montant réel n'est utilisé pour les tests. Garder les exports de test synthétiques et les secrets hors Git, des PR et des previews.

## Déploiement

Aucun workflow de déploiement n'est activé. La mise en production nécessite l'accord explicite de l'utilisateur après validation des critères ci-dessus. Les previews doivent viser un projet Firebase de test isolé.
