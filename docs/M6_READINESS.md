# M6 — état de préparation à la production

Mise à jour : 16 novembre 2026 (UTC). **Le projet n’est pas prêt pour la production.** Toutes les PR sont en brouillon ; aucune n’est fusionnée et aucun déploiement de production n’a eu lieu. Le site et le Worker de test sont distincts de la production et leurs routes sensibles restent désactivées hors essais fictifs.

## État des jalons

| Jalon | Réalisé et vérifié | Encore ouvert |
| --- | --- | --- |
| M0 | Chaîne Firebase Auth → Worker → Firestore/Cloudinary testée avec membre, tiers et membre révoqué ; reçu `authenticated` privé ; dépense atomique fictive. | Suivi durable des quotas et coûts gratuits. |
| M1 | Angular, Tailwind, PWA et CI de PR ; Hosting de test utilisé manuellement. Un workflow manuel Hosting de test est préparé, sans exécution. | Identité Hosting limitée et essai du workflow après intégration autorisée ; preview isolée par PR et déploiement contrôlé des règles et du Worker. |
| M2 | Auth email/Google, récupération, création de groupe et invitations essayées avec comptes fictifs. | Profil et association Google du PR #68 à tester sur Firebase ; groupe personnel et groupe à trois membres à inclure dans un E2E consolidé. |
| M3 | Cinq partages, préférence par utilisateur/groupe, historique, catégories, commentaires et recherche progressive. | Édition et suppression logique par **l’auteur seulement** : décision reçue, code et essai encore ouverts. |
| M4 | Remboursements ordinaires, soldes et statistiques ; route FX du PR #61 essayée réellement, UI du PR #62 essayée sur ordinateur/mobile. | Statistiques FX du PR #63 en essai ; validation du parcours intégré et historique FX sur plusieurs pages. |
| M5 | Import CSV fictif avec rapprochement et annulation ; reçus privés ; export CSV/JSON/ZIP V1 partiel. JSON/ZIP V2 avec FX et prévisualisation locale dans #64–#67, CI verte. | Essai réel V2 et **restauration réelle** des données et reçus ; identités, préférences, commentaires et activité absents des archives. Extension Chrome limitée aux exports autorisés à compléter. |
| M6 | Tests unitaires, Worker, règles et contrôles de sécurité en CI ; essais visuels ciblés et médias de test dans les PR. | E2E complet, couverture de 80 %, essais Safari/iOS et Android sur appareils, accessibilité complète, IAM/quotas/performances, sauvegarde/restauration, automatisation de déploiement et validation utilisateur. |

## Validation du dernier ensemble intégré

La PR #67 combine les piles FX M4 et export V2 M5 sans fusion GitHub. Son typecheck, build, 64 tests unitaires, 50 tests Worker et tests de règles Firestore passent en CI. Le bundle initial fait **442,01 kB** pour un budget de 500 kB. La PR #68 ajoute le profil sur cet ensemble : sa CI est verte et son bundle initial fait **442,91 kB** ; l’association Google n’a pas encore été essayée dans Firebase. Les essais navigateur de #63 et #67 restent à consigner séparément.

Les preuves des essais fictifs déjà exécutés sont dans les descriptions des PR concernées, hors dépôt. Les 27 captures privées de référence ne sont ni versionnées ni publiées. Aucun test avec données financières réelles n’est revendiqué.

## Blocages de sortie

1. Définir puis tester une restauration vérifiée des collections, comptes associés et reçus privés. Les formats V1/V2 actuels sont explicitement partiels et ne constituent pas une sauvegarde complète.
2. Terminer l’édition/suppression logique M3 avec autorisation serveur de l’auteur uniquement, audit et effets sur reçus/export.
3. Exécuter un E2E consolidé : compte, groupe personnel et groupe multi-membres, invitation, cinq partages, reçu, remboursement, statistiques, import rapproché/annulé, export et changement de membre.
4. Vérifier la PWA, l’accessibilité et le responsive sur Chrome Android et Safari iOS réels ; mesurer performances et quotas sur la pile gratuite.
5. Configurer une identité Hosting limitée pour le workflow manuel de test, puis l’essayer après intégration autorisée du fichier ; mettre en place les previews PR et le déploiement distinct des règles/index/Worker, sans secret dans les artefacts. Aucun workflow de déploiement automatique n’est activé.
6. Revoir les PR empilées, les dépendances et les contrôles de branche avant toute fusion. Le déploiement de production et les PR non brouillon demandent une décision distincte de Cédric.

Voir [M6_SECURITY_REVIEW.md](M6_SECURITY_REVIEW.md) et [M6_E2E_SMOKE.md](M6_E2E_SMOKE.md) pour les essais ponctuels déjà documentés. Les résultats du projet de test ne remplacent pas les critères de production.
