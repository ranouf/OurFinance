# M6 — état de préparation V1 (16 novembre 2026)

Statut : **V1 incomplète, production non prête**. Le plan et la direction Everyday Pop publiés sur `main` imposent une devise unique stricte par groupe, FR/EN/JA, des graphiques interactifs et un parcours mobile soigné. Les résultats ci-dessous sont attachés aux SHA indiqués dans les PR, pas à une pile déjà fusionnée. Aucune PR n'est fusionnée automatiquement ; aucun déploiement en production n'est autorisé.

## Fonctionnalités et preuves disponibles

| Jalon | État vérifié | Reste à faire avant la V1 |
|---|---|---|
| M0 — faisabilité | Chaîne Firebase Auth → Worker → Firestore/Cloudinary testée avec membres actifs, tiers et membre révoqué ; reçu privé `authenticated` lu seulement par les membres actifs. Dépense atomique et idempotence éprouvées sur TEST. | Suivi réel des quotas Free et audit final de la configuration avant production. |
| M1 — socle | Angular, PWA, CI, trois langues et environnement TEST existent. La PR UI #107 applique tokens, illustrations et connexion Everyday Pop sur la base clavier #105. Son HEAD exact `8997a0c` a été contrôlé sur TEST avec fixtures fictives, FR/EN/JA et 320/390/768/1280 px sans débordement. | Preview isolée, installation Android/iOS et cohérence de toute l'interface après intégration. |
| M2 — comptes/groupes | Création de groupe, invitations sécurisées et règles d'appartenance éprouvées sur TEST. Sur le HEAD #107, zéro groupe puis groupes de 1/2/3 membres : comptage, solde et activité restent propres au groupe choisi. | Google OAuth et courriels externes réels non rejoués dans ce contrôle. |
| M3 — dépenses | Cinq modes et préférences personnelles, édition/suppression auteur seul, commentaires, catégories collaboratives et devise stricte testés par tranches. Refonte Everyday Pop de l'éditeur/historique dans #108 : 64 tests, typecheck/build et contrôle FR/EN/JA à 320/390/768/1280 px ; captures/vidéo fictives au PR. | Essai intégré avec les autres jalons sur son SHA final. |
| M4 — finances | Remboursements, statistiques, dropdown Jours/Mois/Années #90 et graphiques catégorie/membre/temps #100 testés avec données fictives. Refonte Everyday Pop des statistiques dans #109 : 68 tests, typecheck/build, contrôle réel avec 3 dépenses et 1 remboursement fictifs, FR/EN/JA desktop/mobile. | Refonte des écrans remboursements/soldes en cours dans le fil local ; revalider chiffres, accessibilité et bornes sur la pile intégrée. |
| M5 — import/reçus | Import et annulation, export V1/V2, reçus privés et révocation éprouvés. Le format V2 conserve préférences et pièces dans son périmètre déclaré. | Essai de migration plus large, rapprochement final, limites de volume et reprise sur panne ; maintien explicite des omissions du format `group-v2-partial`. |
| M6 — sécurité/qualité | Rules 12/12 sur émulateur isolé ; restauration réelle #102 au SHA `68b2a4c`, puis preview/UI intégrée #102/#104 aux SHA `97e7fd4`/`ceb95c9`. Owner 200, membre/révoqué/tiers 403, ZIP altéré 400, reçu privé rétabli. Trois tests supplémentaires de reprise ont été ajoutés à #102 ; 96 tests Worker passent. | Tests de panne Cloudinary/Firestore en environnement réel, interruption/reprise et groupe >20 Mo ; E2E complets, lecteur d'écran, Safari/iOS, performance, revue IAM/quota, workflow de déploiement TEST→production. |

## Piles de PR à revoir

- **Sécurité, reçus et restauration** : #98 → #102 API → #104 UI, toutes en brouillon. La restauration remplace le groupe d'origine et les préférences de chaque membre ; elle reste désactivée par défaut et limitée à un groupe fictif en TEST quand les variables POC sont activées. Le format `group-v2-partial` n'inclut pas les comptes Firebase Auth et n'est pas une sauvegarde totale de l'application.
- **Interface Everyday Pop** : #101 → #105 → #107 → #108 M3 → #109 M4, toutes en brouillon. #101 fournit la structure et le responsive, **pas** la direction graphique finale. #107 intègre explicitement les SVG et documents du `main` plus récent. Les dépendances doivent être réconciliées avant revue/fusion.
- Les 14 anciennes PR #60–#73, devenues incompatibles ou supplantées après la devise unique et la consolidation, ont été fermées avec commentaire et sans suppression des branches. Les essais d'une PR ne valident pas automatiquement un SHA intégré ultérieur.

## Contrôles transverses

- `npm run test:coverage` sur #107 : 124 tests passés ; 92,97 % lignes, 83,66 % branches, 95,63 % fonctions **des modules chargés par les tests Node**. Les templates Angular ne sont pas inclus dans cette mesure.
- Branche d'intégration locale #104+#107+#108+#109 au SHA `0e20eec` : 85 tests unitaires et 96 Worker, typechecks et build réussis ; couverture combinée 181 tests, 93,57 % lignes, 82,20 % branches et 94,76 % fonctions des modules Node chargés. Aucun déploiement TEST de ce SHA. Le bundle initial fait 500,56 kB pour un budget 500 kB (563 octets de dépassement).
- `npm audit --omit=dev` sur #107 : zéro alerte de production. Une revue séparée avait relevé 14 alertes modérées dans les outils de développement `firebase-tools` et transitives, sans correctif compatible proposé par `npm audit fix --dry-run`.
- Les essais TEST utilisent uniquement des comptes, dépenses, groupes et reçus fictifs ; la pile est réservée/libérée dans l'[issue #30](https://github.com/ranouf/OurFinance/issues/30). Après les essais #102/#104, six variables temporaires ont été retirées, les fixtures et assets supprimés, `/health` répondait 200 et les routes POC 503.
- Les 27 captures Splitwise du propriétaire restent privées, absentes du dépôt, des PR et des preuves publiées. Les captures/vidéos de validation de #104 ont été examinées localement mais ne sont pas encore jointes nativement à la PR ; leur absence est documentée.

## Critères de sortie

Avant une décision de production : intégrer les piles compatibles, exécuter les essais complets sur leur **SHA intégré exact**, fermer les routes POC, tester sauvegarde et restauration avec pannes/récupération et volumes, vérifier Firestore Rules/Worker/IAM et les quotas, terminer l'UX Everyday Pop et les trois langues sur tous les parcours, valider Android et iOS, puis faire approuver séparément la fusion et le déploiement. Les PR restent en brouillon tant que ces critères ne sont pas démontrés.
