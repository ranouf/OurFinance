# M6 — revue de préparation production (16 novembre 2026 UTC)

Statut : **non prêt pour la production**. Aucun déploiement ni fusion automatique n'a eu lieu.

## Vérifications exécutées

- `npm run typecheck` : passe.
- `npm run build` : passe ; PWA produit un manifeste et un service worker.
- `npm run test:unit` : dix tests passent (répartitions, devises, préférences, soldes, CSV).
- `npm run test:rules` : non exécuté jusqu'au bout ; le téléchargement du JAR Firestore Emulator échoue dans cet environnement. La suite est dans la CI, mais son succès doit être confirmé.
- `npm audit --omit=dev --audit-level=high` : **échoue**. Quatre alertes élevées concernent la chaîne `firebase` → `@firebase/firestore` → `@grpc/grpc-js` ; npm indique « No fix available » pour deux avis gRPC (`GHSA-m9gg-hp2v-232j`, `GHSA-f596-whhp-79r4`). Suivre une mise à jour des dépendances et réévaluer la portée navigateur/serveur avant tout lancement.

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
