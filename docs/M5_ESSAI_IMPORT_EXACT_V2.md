# Essai intégré M5 — fractions historiques exactes

Périmètre : pile des PR #123 et #127 sur **ourfinance-test** seulement. Employer une fixture entièrement fictive. Ne jamais importer de données Splitwise personnelles dans TEST, le dépôt, un PR ou les journaux.

## Préparation

1. Réserver la pile TEST dans l'issue #30. Déployer le SHA intégré exact (Worker, règles, application) et consigner ce SHA avant les essais. Vérifier `/health=200` et les routes POC à 503 avant activation.
2. Créer un groupe fictif en JPY, un propriétaire confirmé, un second membre actif, un membre révoqué et un tiers. Activer temporairement `ENABLE_IMPORT_POC=true` et `IMPORT_POC_GROUP_ID` pour ce seul groupe.
3. Envoyer au Worker une ligne normalisée `sourceId=synthetic-exact-001`, `currency=JPY`, `sourceCostExact="101.50"`, `sourcePrecision=2`, `netImpactsExact={propriétaire:"50.75", autre membre:"-50.75"}`. Vérifier HTTP 201, l'absence des champs `amountMinor`/`netImpactsMinor` dans le document Firestore et le refus 409 d'une provenance dupliquée. Les valeurs sont des chaînes exactes ; aucun arrondi vers l'exposant ISO du JPY.
4. Vérifier les refus pour devise différente du groupe, impacts déséquilibrés, champs exacts et legacy mélangés, tiers et membre révoqué. Contrôler qu'aucune écriture ne suit ces refus.

## Export et restauration

1. Avec le propriétaire actif, télécharger le CSV, JSON V1 et ZIP V2 du groupe. Vérifier que les trois champs exacts sont présents et inchangés ; les colonnes legacy en unités mineures doivent rester vides pour cette ligne. Préparer le ZIP V2 à partir du snapshot serveur, sans `client_partial`.
2. Activer temporairement les routes de sauvegarde/restauration pour ce seul groupe. Prévisualiser le ZIP : HTTP 200, aucune écriture. Modifier un champ historique fictif, puis restaurer **une seule fois** avec un identifiant de tentative neuf. Vérifier HTTP 200/202, groupe actif et job terminé selon le protocole M6.
3. Relire Firestore et un nouvel export : `101.50`, précision `2`, `50.75` et `-50.75` identiques, toujours sans champs legacy. Vérifier que la ligne historique n'entre pas dans les soldes actifs calculés depuis les dépenses réparties. Tester la lecture membre actif et les refus tiers/révoqué.

## Nettoyage

Supprimer documents historiques, batch, activité, restoreJob, membres, groupe et comptes fictifs. Retirer tous les flags POC activés ; contrôler `/health=200` et les routes à 503. Supprimer ZIP/CSV/JSON locaux et noter dans les PR les codes observés, le SHA déployé, les éventuelles limites et tout résidu. Ne pas recommencer une restauration si son résultat est incertain : contrôler d'abord `lastRestoreId`.
