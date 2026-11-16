# M6 — état de préparation V1 (16 novembre 2026)

Statut : **V1 incomplète, production non prête**. Le plan `docs/PLAN_TECHNIQUE_V1.md` de `main` au commit `f75fdc5` impose une seule devise stricte par groupe, sans conversion, et FR/EN/JA dès la V1. Aucun PR n’est fusionné automatiquement et aucun déploiement en production n’est autorisé.

## Pile compatible en brouillon

La nouvelle pile part de la PR #59, avant les ajouts FX : #74 (devise stricte), #76 (verrou après première transaction), #77 (import/export dans la devise du groupe), #78 (profil et langue), #79 (couverture Node en CI), #80 (workflow manuel Hosting de test), #81 (accueil/profil traduits), #82 (catégories système traduites), #83 (formats localisés), puis #85 qui intègre les filtres #75 et l’édition/suppression auteur seul #84. Les bases et SHA exacts sont dans chaque PR. **#60–#67 et #73 restent incompatibles** ; #68–#72 demandent réempilement ou remplacement selon leur portée. Aucune de ces PR incompatibles ne doit être fusionnée telle quelle.

## Preuves disponibles et portée

- Sur la branche combinée #85 : `npm run test:unit` **60/60**, `npm run test:worker` **54/54**, `npm run typecheck`, `npm run typecheck:worker` et `npm run build` réussis localement. Bundle initial **451,10 kB**. CI et essai réel du SHA combiné à confirmer.
- La PR #74 au SHA `310d2b0f9c82318dbab962b84f48551c8b90b311` a un essai réel sur le projet de test : CAD accepté, JPY refusé sans écriture dans un groupe CAD, groupe JPY accepté, tiers et membre révoqué refusés. Captures/vidéo fictives et nettoyage consignés dans la PR et l’issue #30.
- La PR #76 au SHA `382bef4f1131bb8c39e89fbc2d8962e7bf6d12cf` a un essai réel : devise modifiable avant la première opération par le propriétaire, verrou après dépense/règlement/import, ancien historique archivé aussi bloquant, membre ordinaire refusé. Fixture nettoyée et route de nouveau désactivée. Ces essais ne valident pas à eux seuls la pile #85.
- Les filtres #75 ont été examinés sur ordinateur et mobile avec données fictives. L’essai de #84 est en cours à la date de cette revue ; ses résultats ne sont pas encore attribués à #85.
- `npm run test:coverage` sur la pile V1 a mesuré **93,10 % lignes**, **84,97 % branches**, **95,68 % fonctions** parmi les modules chargés par les tests Node. Les composants/templates Angular non chargés restent exclus ; voir [M6_COVERAGE.md](M6_COVERAGE.md).
- Le test local des règles Firestore de #78 n’a pas démarré, port 8080 occupé. Sa CI a réussi, mais les scénarios de langue/profil doivent encore être essayés réellement.

## Critères encore ouverts

- **M1 / UX** : design system mobile soigné, previews isolées par PR, workflow test Hosting #80 non exécuté, déploiement coordonné règles/index/Worker/Hosting non automatisé. Le secret Actions de déploiement Hosting ne peut pas être confirmé dans cette session (liste : HTTP 403).
- **M2** : profil FR/EN/JA et règles à examiner sur la pile réelle ; interface pour changer la devise d’un groupe avant sa première transaction ; invitations en parcours complet.
- **M3** : essai réel et visuel de #84 puis du SHA intégré #85 ; catégories personnalisées et tous les cas d’édition/suppression auteur seul. Les autres textes des formulaires restent à traduire.
- **M4** : sélecteur de période en dropdown avec onglets Jours/Mois/Années, bornes inclusives, Appliquer/Annuler ; graphiques interactifs catégorie, membre et temps ; distinction payé/part due/solde ; essais 1/2/3+ membres et mobile.
- **M5** : parcours complet d’import CSV/JSON avec séparation guidée des devises incompatibles, rapprochement et annulation ; sauvegarde/restauration de **l’original** du groupe et des préférences de **chaque membre**, reçus privés inclus. Le ZIP actuel annonce explicitement une portée partielle et ne restaure rien.
- **M6** : traduction complète et immédiate de tous les écrans, erreurs, catégories et graphiques en FR/EN/JA ; tests navigateur E2E, accessibilité clavier/lecteur d’écran, Android/iOS, performance, quotas, audit IAM/Worker/règles, sauvegarde réelle et restauration vérifiée. La couverture globale de 80 % incluant Angular reste ouverte.

## Données privées et déploiement

Les 27 captures Splitwise fournies par le propriétaire sont strictement privées et absentes du dépôt/PR. Les preuves publiques des PR utilisent uniquement des comptes et données fictifs. La pile de test `ourfinance-test` / `ourfinance-api-dev` se réserve et se libère dans l’[issue #30](https://github.com/ranouf/OurFinance/issues/30). Aucune fusion de PR ni production sans décision distincte du propriétaire.
