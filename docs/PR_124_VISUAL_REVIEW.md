# Revue visuelle de la PR #124 — Everyday Pop V2

**Date : 17 novembre 2026.** Revue du code et des illustrations de la PR [#124](https://github.com/ranouf/OurFinance/pull/124), HEAD `5084900511057ce139875175fc927389877cf5c3`. **Cette revue ne prétend pas avoir vu les captures Playwright locales**, non jointes dans la PR ; conclusions vérifiées à partir du code, de la description et des fichiers images réellement consultés.

## Verdict

**Modifications demandées avant validation visuelle et fusion.** Bonne progression structurelle (Angular Router, vrai shell authentifié même avec zéro groupe), mais la PR n'apporte pas les éléments nécessaires pour démontrer une fidélité au **dernier design V2 choisi**.

## Références à respecter

- [Dashboard V2 desktop approuvé](design-references/everyday-pop-v2-dashboard-desktop.webp)
- [Dashboard V2 mobile avec couple à table et rose rouge](design-references/everyday-pop-v2-dashboard-mobile.webp)
- [Connexion V2 mobile](design-references/everyday-pop-v2-login-mobile.webp)
- [Connexion V1 desktop](design-references/connexion-desktop.webp)
- [Dépenses et Statistiques V1, desktop/mobile](design-references/README.md)

## Observations du code PR #124

| Point | État contrôlé | Correction attendue |
|---|---|---|
| Routage réel | **Présent** dans `src/app/app.routes.ts` : routes login, dashboard, groups, expenses, statistics, account, join. | Préserver sans réintroduire un monolithe. |
| Navigation sans groupe | `app.ts` passe `signedIn=!!auth.user()` ; le shell s'affiche pour l'utilisateur authentifié sans groupe. | Préserver et tester sur un compte fictif sans groupe. |
| Hero Dashboard desktop | `app-pages.ts` utilise `couple-cafe.webp` à droite d'une bannière violette. La V2 desktop demande **amis au café à gauche + groupe/avatars/indicateurs à droite**, avec scène dessinée et format panoramique. | Recomposer le hero desktop selon V2 et les proportions de la référence. |
| Hero Dashboard mobile | Le même `couple-cafe.webp` est utilisé comme image flottante ; l'asset montre surtout des portraits sans **table complète**, contrairement à la V2 mobile. | Inclure le couple **assis à sa table avec rose**, sur une bannière violette cohérente, sans masquer texte/CTA. |
| Actions rapides desktop | Le composant Dashboard montre surtout un CTA, quelques KPI et une liste ; il n'a pas les **trois grands raccourcis** de la V2 desktop. | Ajouter **Ajouter une dépense**, **Inviter avec QR**, **Équilibrer les comptes** en emplacements attendus. |
| Panneau « Qui doit quoi ? » | Pas de panneau dette par membre correspondant à la V2 dans le Dashboard (le `GroupOverview` ne remplace pas sa disposition). | Afficher les dettes/créances par membre si les données existent ; états vides propres, aucune donnée fictive en prod. |
| Catégories / donut | Pas de **panneau donut des catégories** dans le Dashboard V2, même si une page Statistiques existe. | Ajouter un résumé catégories du groupe et un lien vers Statistiques, alimenté par les données existantes. |
| Groupes / activité | Cartes et dépenses récentes **présentes** ; composition encore plus sobre et moins visuelle que la V2. | Harmoniser pictogrammes, densité, hiérarchie, cartes, avatars et animations discrètes. |
| Connexion | Deux panneaux avec image de café et formulaire, **structure correcte** ; l'asset `cafe-hero.webp` a un rendu pictural et une composition différente de la scène vectorielle approuvée. | Reprendre un aspect **vectoriel-cartoon** et la composition de la connexion V2 mobile et V1 desktop. |
| Écrans Dépenses et Statistiques | Routes existantes, mais l'auteur indique que les composants gardent encore leur UI actuelle. | Garder les refontes comme travaux séparés clairement non validés ; comparer aux références V1 avant toute validation globale. |
| Comparaison réelle | La PR dit que des captures Playwright ont été examinées mais **aucune n'est jointe** pour comparer avec les références. | Fournir les paires référence/rendu à **1280×800 et 390×844**, y compris état zéro groupe, 1 et 3 groupes. Ne pas confondre test d'absence de débordement et conformité. |

## Règles métiers à ne pas sacrifier

Devise unique par groupe, pas de somme multidevises, distinction **paiements / parts dues / dettes et remboursements**, pas de montants démonstratifs en production, permissions d'invitation QR, Firebase, FR/EN/JA, accessibilité. Les captures générées sont **des maquettes**, pas une source de valeurs ni une justification pour reprendre de faux montants.

## Conditions d'acceptation

1. Ouvrir visuellement toutes les images V2 et V1 pertinentes.
2. Reconcevoir Dashboard desktop/mobile et Connexion mobile en suivant les **dernières** compositions choisies.
3. Valider à 1280×800, 390×844 et 320×844 ; tester **sans groupe**, 1 groupe et plusieurs groupes (3+ membres), avec données fictives.
4. Fournir dans la PR une **table de comparaison illustrée** : maquette de référence / capture Playwright réelle / écarts / corrections appliquées.
5. Exécuter typecheck, build, tests unitaires, Firestore/Worker appropriés et contrôles d'accessibilité ; signaler clairement les services simulés.
6. Garder la PR **en brouillon** et ne pas fusionner/déployer avant le feu vert visuel explicite de l'utilisateur.

Cette revue distingue le **travail structurel conservable** de la **non-conformité visuelle non résolue**.
