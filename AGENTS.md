# Instructions Codex — OurFinance

Avant toute modification, lire intégralement `docs/PLAN_TECHNIQUE_V1.md`, `docs/DESIGN_EVERYDAY_POP.md` et `docs/REFERENCES_UI.md`. Examiner les SVG locaux de `public/illustrations/`. Les captures Splitwise sont transmises **privément** à certaines tâches : **ne jamais les ajouter au dépôt, aux PR ou aux artefacts publics** ; ne pas inventer les détails des captures absentes.

Respecter les décisions validées : Angular + Tailwind, Firebase Auth/Firestore/Hosting Spark, Cloudinary Free pour les reçus, groupes indépendants, devise ISO 4217, répartition mémorisée par utilisateur et groupe, cinq méthodes de partage, statistiques et migration Splitwise.

Créer des composants génériques dans `src/app/shared`, minimiser le CSS personnalisé, utiliser des types stricts, des calculs monétaires exacts et des tests d'isolation inter-groupes. Aucune donnée financière réelle, clé API ou secret dans le dépôt. Les photos de justificatifs doivent rester privées.

Travailler par jalon M0 à M6 avec des PR de fonctionnalité vérifiables, sans fragmenter inutilement une même API ou interface. Avant de fusionner, exécuter compilation, lint, tests et contrôles de sécurité. Ne pas déclarer une intégration Firebase/Cloudinary/Cloudflare opérationnelle sans test réel. Ne jamais contourner les restrictions de Splitwise.

Regrouper les changements d'une même fonctionnalité dans une pile lisible, généralement une PR API et tests puis une PR UI. Chaque titre de PR commence par un seul préfixe `[UI]`, `[API]`, `[IA]`, `[ARCH]` ou `[CI/CD]`, suivi d'un titre descriptif en français. Ne pas employer `[IA]` pour les imports ou l'interface. Décrire dans la PR les validations, limites et dépendances exactes. Le propriétaire a autorisé la fusion squash des changements compatibles après CI verte et essai intégré ; une fusion ne doit pas déployer en production sans accord distinct.

Lors d'une tâche autonome, poursuivre les étapes non bloquantes, documenter les obstacles et ouvrir une PR. Ne fusionner que les changements compatibles et validés, selon l'autorisation du propriétaire ; signaler les critères encore ouverts dans la PR.

Appliquer `docs/PR_REVIEW.md` à chaque commit et push, ainsi qu'avant toute fusion. Un PR `[UI]` requiert des captures réelles et une vidéo dans sa description ; ces médias de validation restent toujours hors dépôt.

## Direction UI approuvée (16 novembre 2026)

**Everyday Pop est obligatoire pour toute nouvelle tâche UI.** Lire `docs/DESIGN_EVERYDAY_POP.md` avant de modifier Connexion, Dashboard/Groupes, Dépenses ou Statistiques. Réutiliser les assets SVG locaux de `public/illustrations/` (terrasse de café, groupe d'amis avec bières jaunes, couple avec rose rouge, catégories/devises sans texte ni tour Eiffel). Les SVG sont des illustrations vectorielles originales et simplifiées, pas des PNG déguisés. Ne pas réintroduire la mascotte ronde jaune ou le style turquoise générique de la PR #101. Conserver ses améliorations fonctionnelles et responsive lorsqu'elles sont utiles.

Cloud et local : travailler sur branches distinctes, tenir compte des PR ouvertes et de la pile consolidée, éviter les modifications concurrentes, ne pas perdre les traductions FR/EN/JA ni les règles de devise unique. Une tâche déjà en cours doit récupérer les changements de `main` explicitement ; elle ne les reçoit pas automatiquement.

## Invitations QR — décision produit (16 novembre 2026)

**Lire `docs/INVITATIONS_QR.md` avant toute modification de l'authentification, des groupes, des membres ou des invitations.** Un QR code d'invitation contient le même lien HTTPS temporaire qu'un partage classique. Utiliser `angularx-qrcode` (version compatible avec le major Angular installé), génération locale ; aucun service QR externe ni lecteur caméra intégré requis en V1. Couvrir compte connecté, connexion, nouveau compte Google/email, email non vérifié, **mot de passe oublié et réinitialisation**, changement de compte, déjà membre, expiration/révocation/usage unique, refus et concurrence. Ne jamais accepter une invitation automatiquement : confirmation explicite et validation atomique via Worker/Firestore. Les jetons ne doivent jamais apparaître dans les logs, Firestore en clair, les captures ou les PR. Respecter Everyday Pop desktop/mobile et FR/EN/JA.

## Références visuelles obligatoires pour toutes les PR UI

**Ouvrir réellement les huit images de `docs/design-references/`**, puis lire `docs/design-references/README.md`. Elles constituent les **maquettes approuvées des écrans complets** ; les SVG de `public/illustrations/` ne sont que des assets décoratifs. Les références sont des images générées avec **données fictives**, distinctes des captures privées Splitwise.

Pour chaque écran modifié, lancer l'application et capturer avec Playwright à **1280 × 800 desktop** et **390 × 844 mobile** ; comparer visuellement aux références, corriger les écarts de composition et répéter. Fournir **référence + rendu réel** dans la PR, avec différences résiduelles et tests. **Build et tests verts ne suffisent pas** ; attendre la validation visuelle du propriétaire avant merge/déploiement.

**Navigation** : utiliser de vraies pages Angular Router ; ne pas empiler Dashboard, formulaires, Profil, Dépenses et Statistiques sur une page unique. Le shell desktop/mobile doit rester visible pour tout utilisateur authentifié même avec **zéro groupe** ; afficher alors un état vide Everyday Pop et CTA de création de groupe, sans montant fictif. Préserver Firebase/Worker, les règles métier et les traductions FR/EN/JA.

## Dernières maquettes Everyday Pop V2 — référence prioritaire (17 novembre 2026)

**Avant de déclarer une PR UI conforme**, ouvrir les trois images `docs/design-references/everyday-pop-v2-dashboard-desktop.webp`, `everyday-pop-v2-dashboard-mobile.webp` et `everyday-pop-v2-login-mobile.webp`, puis lire la section V2 dans `docs/design-references/README.md`. Sur Dashboard/connexion mobile, elles **priment** sur les anciennes captures V1. La dernière préférence est **Everyday Pop V2 : amis au café sur le hero desktop, couple à une table avec rose rouge dans la bannière mobile, illustration complète sur la connexion mobile** ; grands raccourcis colorés, panneaux Dettes / Dépenses récentes / Catégories, navigation responsive. Style illustratif **vectoriel-cartoon**, pas pictural/photoréaliste.

**Le code doit suivre les maquettes**. Toute PR UI doit fournir les vraies captures Playwright à 1280×800 (desktop) et 390×844 (mobile), comparées côte à côte, avec écarts explicités et corrigés ; ne pas confondre « images présentes », « tests verts » et « écran conforme ». Les pages Dépenses/Statistiques utilisent les références V1 existantes tant qu'une V2 n'est pas validée. Sans groupe : état vide beau mais aucun montant fictif. Pas de fusion/déploiement sans validation visuelle de l'utilisateur.
