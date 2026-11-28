# M0 — POC de dépense atomique

Le Worker prépare `POST /groups/{g}/expenses`, désactivé par défaut. Il exige `ENABLE_EXPENSE_POC=true` et `EXPENSE_POC_GROUP_ID` égal au seul groupe fictif autorisé. L'auteur doit présenter un ID token Firebase vérifié et un courriel confirmé. Le Worker valide la devise ISO, la date, l'identifiant d'idempotence, le montant en unités mineures, les payeurs et l'une des cinq répartitions, puis recalcule les allocations avec `SplitEngine` et exige la conservation exacte des sommes.

Avec l'identité de service de test, il ouvre une transaction Firestore, lit le groupe et **tous** les membres référencés dans cette transaction, refuse les membres inactifs, puis écrit atomiquement la dépense (paiements et parts dans un seul document), la préférence personnelle `(utilisateur, groupe)` et un événement d'activité. Le POC initial refusait toute répétition par la précondition `exists: false` ; la révision UX V2 reconnaît désormais la même clé, le même auteur et le même corps canonique comme un succès idempotent, et refuse un corps différent avec HTTP 409. Les Security Rules continuent de refuser les écritures financières directes du navigateur. Cette route ne doit pas être activée pour un groupe réel avant les tests de concurrence et d'abus.

## Essai réel effectué sur le projet de test

Le 16 novembre 2026 à 07:13:07 UTC, le commit `23d1716ee0cd3e0e00dbdff931a7fb34cf7b7c71` a été déployé sur `ourfinance-api-dev` (version Cloudflare `cb59de1e-302a-4c8f-8f7f-c5dbfdc162be`). L'essai a utilisé trois comptes fictifs et un groupe fictif : création 201, répétition de la clé 409, paiements 101 et allocations 50 + 51, préférence personnelle et activité présentes. Après révocation d'un membre, une nouvelle dépense a été refusée 403 ; le tiers a reçu 403, l'autre groupe 503 et une écriture directe Firestore côté client 403.

Les variables temporaires d'activation ont été retirées. Le premier nettoyage local n'a supprimé que 3 des 6 documents ; une passe complémentaire a retiré les documents membres, les préférences éventuelles et le groupe. La vérification finale n'a trouvé aucun groupe `expense-poc-*` ni dépense ou activité résiduelle, et les trois comptes fictifs ont été supprimés. Le script `check.mjs` ne nettoie pas la fixture : sa suppression doit être vérifiée séparément à chaque essai.

## Protocole de répétition depuis la session locale

1. Déployer le commit de cette PR **sur `ourfinance-api-dev` uniquement**. Conserver la création de groupes et les médias désactivés si non nécessaires.
2. Préparer deux comptes Auth fictifs actifs avec courriel confirmé et un groupe Firestore fictif `status: active`, avec deux membres `status: active`. Configurer `ENABLE_EXPENSE_POC=true` et `EXPENSE_POC_GROUP_ID` seulement pour ce groupe.
3. Exécuter `tools/expense-poc/check.mjs` avec `TEST_WORKER_URL`, `TEST_GROUP_ID`, `TEST_AUTHOR_UID`, `TEST_OTHER_UID`, `TEST_AUTHOR_ID_TOKEN` dans l'environnement local. Le script envoie une dépense fictive de 101 unités mineures CAD et doit obtenir 201, puis 201 en répétant exactement la même clé et le même corps, puis 409 avec la même clé et un corps différent. Il n'affiche pas le jeton. Ce protocole révisé exige le Worker UX V2 ; les codes de l'essai historique ci-dessus restent ceux du commit de novembre.
4. Vérifier dans Firestore : un document dépense, des paiements de 101, des allocations de 51 et 50, la préférence de l'auteur dans son groupe et un événement d'activité. Modifier un membre en `revoked`, réessayer avec une **nouvelle** clé et vérifier 403 sans nouveau document. Tester un tiers absent et un autre groupe. Noter seulement les codes HTTP et le rapprochement des montants.
5. Supprimer les données et comptes fictifs, retirer `ENABLE_EXPENSE_POC` et `EXPENSE_POC_GROUP_ID`. Aucun secret ou montant réel dans les journaux, PR ou commits.

## Limites

L'édition, la suppression logique, les règlements, le rapprochement de concurrence, les catégories, le formulaire Angular et la limitation de fréquence restent à faire. Le POC ne démontre pas la V1 complète ni les quotas de long terme.
