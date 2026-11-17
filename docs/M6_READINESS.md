# M6 — état de préparation V1 (17 novembre 2026)

Statut : **V1 non prête pour la production**. Chaque résultat vaut pour le SHA et l'environnement cités, pas automatiquement pour une pile UI réempilée. Les PR UI attendent la validation visuelle du propriétaire ; aucun déploiement en production n'est autorisé.

## Ce qui a été vérifié

| Domaine | Preuve | Limite actuelle |
| --- | --- | --- |
| Comptes et groupes | Connexion Firebase, groupes à devise unique, invitations par code/QR et refus tiers/révoqué testés avec comptes fictifs sur TEST. | Rejouer Google OAuth, emails réels, réinitialisation et concurrence QR sur la pile finale, y compris iOS/Android. |
| Dépenses et finances | Cinq répartitions, préférences indépendantes, catégories, commentaires, remboursements et soldes testés par tranches. L'historique Splitwise à précision fractionnaire est conservé sans arrondi ni conversion (`#123` et `#127` fusionnés). | Vérifier calculs et navigation sur le SHA UI intégré ; rapprochement privé complet hors dépôt. |
| Reçus et sauvegarde | Reçus Cloudinary privés et refus tiers/révoqué testés. Archive V2 et restauration du groupe d'origine, préférences incluses, éprouvées sur TEST. `#119` fusionné après essai à 30 PNG. `#139` fusionné après retest TEST au SHA `ecf6200` : staging 200, annulation 202, reprise cleanup_pending 200, préparation concurrente 409, nettoyage 204 et retour active 200. Les tests locaux simulent échec Cloudinary, échec d'inventaire Firestore, réponse de commit perdue et nettoyage à reprendre ; le flux accepte exactement 20 000 000 octets et rejette 20 000 001 octets. | Ces pannes et la limite 20 Mo n'ont pas été injectées sur TEST ; l'UI de reprise après fermeture d'onglet doit être validée sur la pile finale. Le format `group-v2-partial` ne sauvegarde pas les comptes Firebase Auth. |
| Sécurité | Firestore Rules : 13/13 tests sur émulateur local ; release TEST comparée au SHA intégré de l'essai M6. `#134` fusionné après essai réel : profils 401 sans jeton, 200 propriétaire/membre, 403 tiers/révoqué, seulement les noms actifs ; route 503 après nettoyage. | Recontrôler règles, index, IAM, rotation de clé et quotas sur le SHA final et l'environnement cible. |
| Hosting et CI | `#121` fusionné après CI et preview isolée du SHA `e4e6979` : `/` et `/dashboard` 200 avec CSP, `no-referrer`, `nosniff`, `DENY`, CSS chargé et aucune violation CSP de la page observée. Le workflow manuel ne déploie le site TEST principal que depuis `main`. | Le domaine de preview n'a pas été synchronisé avec Firebase Auth ; Google OAuth et appels Worker/QR depuis cette URL n'ont pas été rejoués. Contrôler le site TEST principal après son prochain déploiement du `main` final. |
| Qualité | Sur `#139`, 139 tests Worker, typecheck et CI verts ; `npm run test:coverage` : 93,84 % lignes, 82,15 % branches, 95,36 % fonctions des modules Node chargés. `npm audit --omit=dev` : zéro alerte de production. | Les templates Angular ne sont pas inclus dans cette couverture. Revalider budget du bundle, accessibilité et E2E du build final. |

## Interface Everyday Pop

Les huit maquettes et `docs/ui-kit/README.md` font référence. `#124` (Connexion, Dashboard, shell), `#128` (Groupes, Profil), `#131` (Dépenses), `#132` (Statistiques) et `#137` (galerie/composants) restent des tranches UI soumises à validation visuelle. Leurs captures Playwright desktop/mobile et vidéos réelles doivent être dans chaque description de PR, hors dépôt, au SHA exact ; une fixture locale en mémoire ne prouve pas un déploiement TEST. La PR UI des noms des membres `#135` a été fermée automatiquement après suppression de la branche API parente `#134` ; la tâche locale réempile son code sur `#124`. Aucun de ces écrans n'est déclaré conforme sur `main` à ce stade.

## TEST et critères de sortie

Les réservations et nettoyages de `ourfinance-api-dev`/`ourfinance-test` sont consignés dans l'[issue #30](https://github.com/ranouf/OurFinance/issues/30). Les essais utilisent des fixtures fictives et retirent les flags POC après chaque créneau. `#139` a été fusionné après le retest exact au SHA `ecf6200` et la libération de TEST. La preview CSP de `#121` n'a pas remplacé le site TEST principal.

Avant la V1 : valider visuellement les écrans finaux, intégrer les piles compatibles, rejouer M1–M6 sur les SHA intégrés exacts, prouver les refus intergroupes et les reprises de restauration, tester Android/iOS, lecteur d'écran, performances et quotas Free, puis vérifier les workflows de déploiement TEST. La production exige une décision séparée du propriétaire.
