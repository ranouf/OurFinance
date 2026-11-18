# Services métier et vérification V1

La description fonctionnelle des pages est [PAGES_SITE_DESIGN.md](PAGES_SITE_DESIGN.md). Une page peut assembler plusieurs domaines : les droits et transactions sensibles restent dans le Worker ; les services Angular appellent le Worker ou lisent Firestore sous Security Rules. Un service métier n'a pas besoin de contenir toute une page ni d'être une classe unique.

| Domaine et pages | Service Angular actuel | Fonctions Worker / calculs actuels | Tests présents | Reste à démontrer |
| --- | --- | --- | --- | --- |
| Authentification, Connexion et Join | `AuthService` : inscription, connexion email/Google, vérification, reset, déconnexion | `auth.ts` vérifie les jetons sur les routes privées | Tests Worker auth, routes et parcours locaux #129 | Session persistée et transition entre comptes sur le SHA intégré de la page |
| Langue, toutes pages | `LanguageService` : détection, état, locale et messages sur la source `i18n.ts` commune ; `ProfileService` persiste le choix | Aucun Worker nécessaire | Tests directs du service, de la sélection et de la persistance via le profil | Vérification de la réinitialisation entre comptes sur la page intégrée |
| Groupes, Accueil et Groupes | `GroupService` : liste, création, devise ; `BalanceService` : comptes | `groups.ts`, `group-currency.ts`, `group-lifecycle.ts` (#213), profils membres | Tests Worker création/devise/cycle, Rules, soldes ; TEST #213 partiel | Service client couvrant lecture des membres, révocation et archivage ; lecture/export historique et refus des mutations après archive sur TEST |
| Invitations, Join et Groupes | `InvitationService`, `QrInvitationService` : émission, aperçu, acceptation, liste, révocation | `invitations.ts`, `qr-invitations.ts` | Tests Worker de jeton haché, usage unique, refus et concurrence | E2E Auth/QR complet sur UI intégrée |
| Catégories, Groupes et Dépenses | `CategoryService` : liste, création, mise à jour/archivage | `custom-categories.ts` ; catalogue système partagé | Tests Worker de droits et tests des libellés | Vérification de la page finale à trois langues |
| Dépenses et remboursements | `ExpenseService`, `SettlementService`, `BalanceService` | `expenses.ts`, `settlements.ts`, calculs de répartition et de solde | Tests de transactions, devises, droits, course #206 et essais TEST | Parcours E2E page intégrée ; tests directs des méthodes client sans réseau |
| Commentaires et reçus, Dépenses | `CommentService`, `ReceiptService` | `comments.ts`, `media.ts`, nettoyage | Tests Worker, sécurité privée et essais TEST #153/#199/#206 | Vérification E2E sur UI intégrée |
| Statistiques | `BalanceService` et fonctions de graphiques/périodes | Pas d'agrégat serveur requis actuellement | Tests calculs exacts, périodes et isolation | Parcours E2E de la page intégrée |
| Profil et activité, Compte | `ProfileService`, `ActivityService` | Profil sous Rules ; journal par groupe | Tests directs load/save, validation du profil et Rules | Pagination du journal et parcours final sur la page intégrée |
| Import, export, restauration, Compte | `ImportService` et modules de préparation/export ; panneau de restauration | `import-batches.ts`, modules `backup-*` et `restore-*` | Tests unitaires/Worker/Rules et essais TEST #139/#144/#204 | Service d'orchestration client cohérent et E2E de la page intégrée |
| Galerie | Aucun service métier | Aucun backend | Tests UI | Aucun backend à ajouter |

## Seuil CI

`PR validation` et `Validate stacked PR SHA` exécutent `npm run test:coverage`. Le seuil bloquant est **90 % de lignes et 90 % de fonctions** pour les fichiers inclus par les tests unitaires et Worker ; le seuil des branches reste à 80 % tant que les chemins non couverts ne sont pas testés. Avant changement, sur main `0844618`, la mesure était 94,62 % lignes, 82,96 % branches et 95,45 % fonctions. Un seuil global ne prouve pas chaque fonction : la dernière colonne ci-dessus reste à fermer avec des tests ciblés par PR de page. La couverture des fichiers Angular non importés par la suite de tests n'est pas revendiquée.

Les PR de page doivent relier chaque fonction ajoutée aux tests unitaires, aux règles et à l'essai intégré nécessaire, puis indiquer le SHA exact et les limites. Une PR UI qui ajoute un service client conserve ses tests sur cette même page ; les PR backend ajoutent les tests des transactions et des droits correspondants.
