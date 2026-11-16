# M6 — essai intégré M3/M4 sur la pile de test

Date : 16 novembre 2026. Environnement : `ourfinance-test` et `ourfinance-api-dev`. Deux comptes, un groupe et toutes les opérations étaient fictifs. Ordinateur : 1365 px ; mobile : 390 px.

## Parcours vérifié

| Étape | Résultat observé |
| --- | --- |
| Cinq partages de dépense | Égalitaire, montants exacts, pourcentages, parts et ajustements : cinq créations HTTP 201 de 1,01 $ CAD. Chaque aperçu répartit exactement 101 unités mineures. |
| Préférence de partage | Chaque mode enregistré est restauré après rechargement de l'écran. |
| Remboursement | Une création HTTP 201 de 0,51 $ CAD, visible dans l'historique des remboursements. |
| Historique des dépenses | Les cinq dépenses sont visibles pour les deux membres sur ordinateur et mobile. |
| Soldes et statistiques | Dépenses : 5,05 $ CAD ; remboursements : 0,51 $ CAD ; soldes des deux membres opposés à +3,05 $ et -3,05 $. |
| Affichage mobile | Aucun débordement horizontal à 390 px. Captures ordinateur et mobile examinées. |
| Nettoyage | Comptes et documents supprimés ; groupe HTTP 404 ; routes d'écriture HTTP 503 après retrait des variables ; santé HTTP 200. |

Les deux captures et les vidéos de cet essai sont jointes à la description du PR correspondant, hors dépôt. Les comptes, les identifiants et les montants utilisés ne proviennent d'aucune personne réelle.

## Périmètre restant

Cet essai part d'un groupe fictif préparé pour le test. Il ne valide donc pas en chaîne la création du groupe et l'invitation. L'ajout et la lecture de reçus privés, l'import/export, la sauvegarde et la restauration, l'accès hors ligne, l'accessibilité complète et les essais sur appareils Android/iOS restent à effectuer. Les PR demeurent en brouillon ; aucune production.
