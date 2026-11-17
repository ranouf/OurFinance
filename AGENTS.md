# Instructions Codex — OurFinance

Avant toute modification, lire intégralement `docs/PLAN_TECHNIQUE_V1.md`, `docs/DESIGN_EVERYDAY_POP.md` et `docs/REFERENCES_UI.md`. Examiner les SVG locaux de `public/illustrations/`. Les captures Splitwise sont transmises **privément** à certaines tâches : **ne jamais les ajouter au dépôt, aux PR ou aux artefacts publics** ; ne pas inventer les détails des captures absentes.

Respecter les décisions validées : Angular + Tailwind, Firebase Auth/Firestore/Hosting Spark, Cloudinary Free pour les reçus, groupes indépendants, devise ISO 4217, répartition mémorisée par utilisateur et groupe, cinq méthodes de partage, statistiques et migration Splitwise.

Créer des composants génériques dans `src/app/shared`, minimiser le CSS personnalisé, utiliser des types stricts, des calculs monétaires exacts et des tests d'isolation inter-groupes. Aucune donnée financière réelle, clé API ou secret dans le dépôt. Les photos de justificatifs doivent rester privées.

Travailler par jalon M0 à M6 avec PR petites et vérifiables. Avant de fusionner, exécuter compilation, lint, tests et contrôles de sécurité. Ne pas déclarer une intégration Firebase/Cloudinary/Cloudflare opérationnelle sans test réel. Ne jamais contourner les restrictions de Splitwise.

Lors d'une tâche autonome, poursuivre les étapes non bloquantes, documenter les obstacles et ouvrir une PR plutôt que fusionner automatiquement les changements sensibles.

Appliquer `docs/PR_REVIEW.md` à chaque commit et push, ainsi qu'avant toute fusion. Un PR `[UI]` requiert des captures réelles et une vidéo dans sa description ; ces médias de validation restent toujours hors dépôt.

## Direction UI approuvée (16 novembre 2026)

**Everyday Pop est obligatoire pour toute nouvelle tâche UI.** Lire `docs/DESIGN_EVERYDAY_POP.md` avant de modifier Connexion, Dashboard/Groupes, Dépenses ou Statistiques. Réutiliser les assets SVG locaux de `public/illustrations/` (terrasse de café, groupe d'amis avec bières jaunes, couple avec rose rouge, catégories/devises sans texte ni tour Eiffel). Les SVG sont des illustrations vectorielles originales et simplifiées, pas des PNG déguisés. Ne pas réintroduire la mascotte ronde jaune ou le style turquoise générique de la PR #101. Conserver ses améliorations fonctionnelles et responsive lorsqu'elles sont utiles.

Cloud et local : travailler sur branches distinctes, tenir compte des PR ouvertes (#100, #101, #105 notamment), éviter les modifications concurrentes, ne pas fusionner automatiquement, ne pas perdre les traductions FR/EN/JA ni les règles de devise unique. Une tâche déjà en cours doit récupérer les changements de `main` explicitement ; elle ne les reçoit pas automatiquement.
