# M0 — POC de dépense atomique

Le Worker prépare `POST /groups/{g}/expenses`, désactivé par défaut. Il exige `ENABLE_EXPENSE_POC=true` et `EXPENSE_POC_GROUP_ID` égal au seul groupe fictif autorisé. L'auteur doit présenter un ID token Firebase vérifié et un courriel confirmé. Le Worker valide la devise ISO, la date, l'identifiant d'idempotence, le montant en unités mineures, les payeurs et l'une des cinq répartitions, puis recalcule les allocations avec `SplitEngine` et exige la conservation exacte des sommes.

Avec l'identité de service de test, il ouvre une transaction Firestore, lit le groupe et **tous** les membres référencés dans cette transaction, refuse les membres inactifs, puis écrit atomiquement la dépense (paiements et parts dans un seul document), la préférence personnelle `(utilisateur, groupe)` et un événement d'activité. Une répétition de la même clé d'idempotence est refusée par la précondition `exists: false`. Les Security Rules continuent de refuser les écritures financières directes du navigateur. Cette route ne doit pas être activée pour un groupe réel avant les tests de concurrence et d'abus.

## Essai réel à faire depuis la session locale

1. Déployer le commit de cette PR **sur `ourfinance-api-dev` uniquement**. Conserver la création de groupes et les médias désactivés si non nécessaires.
2. Préparer deux comptes Auth fictifs actifs avec courriel confirmé et un groupe Firestore fictif `status: active`, avec deux membres `status: active`. Configurer `ENABLE_EXPENSE_POC=true` et `EXPENSE_POC_GROUP_ID` seulement pour ce groupe.
3. Exécuter `tools/expense-poc/check.mjs` avec `TEST_WORKER_URL`, `TEST_GROUP_ID`, `TEST_AUTHOR_UID`, `TEST_OTHER_UID`, `TEST_AUTHOR_ID_TOKEN` dans l'environnement local. Le script envoie une dépense fictive de 101 unités mineures CAD et doit obtenir 201, puis 409 en répétant la même clé. Il n'affiche pas le jeton.
4. Vérifier dans Firestore : un document dépense, des paiements de 101, des allocations de 51 et 50, la préférence de l'auteur dans son groupe et un événement d'activité. Modifier un membre en `revoked`, réessayer avec une **nouvelle** clé et vérifier 403 sans nouveau document. Tester un tiers absent et un autre groupe. Noter seulement les codes HTTP et le rapprochement des montants.
5. Supprimer les données et comptes fictifs, retirer `ENABLE_EXPENSE_POC` et `EXPENSE_POC_GROUP_ID`. Aucun secret ou montant réel dans les journaux, PR ou commits.

## Limites

Le protocole n'a pas encore été exécuté sur le projet réel de test. L'édition, la suppression logique, les règlements, le rapprochement de concurrence, les catégories, le formulaire Angular et la limitation de fréquence restent à faire. Un statut d'erreur précis sera fixé à partir des réponses réelles de Firestore si le protocole expose un écart. Le POC ne démontre pas la V1 complète ni les quotas de long terme.
