# M4 — POC de règlement enregistré

La route `POST /groups/{groupId}/settlements` ne déclenche **aucun transfert d'argent**. Elle enregistre une déclaration de remboursement par son expéditeur, dans une seule devise et un seul groupe. Elle est désactivée par défaut et limitée au seul groupe fictif `SETTLEMENT_POC_GROUP_ID` si `ENABLE_SETTLEMENT_POC=true`. Elle n'est pas prête pour un groupe réel.

L'expéditeur présente un jeton Firebase valide et un courriel vérifié. Le corps contient `idempotencyKey` (UUID v4), `date` (`YYYY-MM-DD`), `currency` (ISO 4217), `amountMinor` (entier positif), `fromUserId` (identique au compte connecté) et `toUserId` (autre membre). Le Worker ouvre une transaction Firestore, relit le groupe et les deux membres actifs, puis crée ensemble le document du règlement et son événement d'activité. Une même clé est refusée au second essai. Les écritures directes Firestore du navigateur restent interdites.

## Essai réel à planifier depuis la session locale

1. Attendre la fin de tout autre essai sur `ourfinance-api-dev`. Déployer le commit exact de la PR de cette tranche uniquement sur le Worker de test. Créer deux comptes vérifiés et un groupe entièrement fictifs.
2. Activer temporairement `ENABLE_SETTLEMENT_POC=true` et `SETTLEMENT_POC_GROUP_ID` pour ce seul groupe. Conserver les autres routes POC désactivées.
3. Enregistrer 51 unités mineures CAD de l'auteur vers l'autre membre : attendre 201, puis 409 pour la même clé. Vérifier un règlement et un événement d'activité, la devise et le montant entiers.
4. Vérifier qu'un tiers, un faux expéditeur, un destinataire révoqué et un autre groupe ne produisent aucune écriture. Après révocation du destinataire, attendre 403 avec un jeton encore valide de l'auteur.
5. Nettoyer règlements, activité, membres, groupe et comptes fictifs. Vérifier l'absence de résidus, retirer `ENABLE_SETTLEMENT_POC` et `SETTLEMENT_POC_GROUP_ID`, puis relever seulement les codes HTTP et les sommes.

Ce POC ne valide ni la réception effective des fonds, ni l'accord du destinataire, ni la conversion entre devises, ni l'interface, ni la concurrence et les quotas de longue durée. Les soldes restent dérivés des opérations ; aucun cache financier n'est écrit par cette route.
