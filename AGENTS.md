# Instructions Codex — OurFinance

Avant toute modification, lire intégralement `docs/PLAN_TECHNIQUE_V1.md` et `docs/REFERENCES_UI.md`. Examiner visuellement toutes les images sous `docs/screenshots/` si elles sont présentes. Ne pas inventer les détails des captures absentes.

Respecter les décisions validées : Angular + Tailwind, Firebase Auth/Firestore/Hosting Spark, Cloudinary Free pour les reçus, groupes indépendants, devise ISO 4217, répartition mémorisée par utilisateur et groupe, cinq méthodes de partage, statistiques et migration Splitwise.

Créer des composants génériques dans `src/app/shared`, minimiser le CSS personnalisé, utiliser des types stricts, des calculs monétaires exacts et des tests d'isolation inter-groupes. Aucune donnée financière réelle, clé API ou secret dans le dépôt. Les photos de justificatifs doivent rester privées.

Travailler par jalon M0 à M6 avec PR petites et vérifiables. Avant de fusionner, exécuter compilation, lint, tests et contrôles de sécurité. Ne pas déclarer une intégration Firebase/Cloudinary/Cloudflare opérationnelle sans test réel. Ne jamais contourner les restrictions de Splitwise.

Lors d'une tâche autonome, poursuivre les étapes non bloquantes, documenter les obstacles et ouvrir une PR plutôt que fusionner automatiquement les changements sensibles.
