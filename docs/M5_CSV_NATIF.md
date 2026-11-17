# M5 — rapport CSV natif du groupe

`serializeGroupLedgerCsvV1` produit un rapport UTF-8 à colonnes fixes à partir d'un `GroupExportV1` validé. Une ligne représente l'impact d'une opération sur un membre, dans la devise de cette opération. Les valeurs sont en **unités mineures entières** : aucun taux de change ou arrondi n'est appliqué.

- Dépense : `payé - dû`. Les paiements et parts d'une même personne sont regroupés. Une suppression logique est signalée par `Statut=deleted` ; les lignes restent présentes pour l'audit et ne doivent pas être additionnées comme des opérations actives.
- Règlement : impact positif pour l'expéditeur et négatif pour le destinataire, selon la convention de solde OurFinance. Le statut enregistré ou supprimé est conservé.
- Import historique : l'impact net enregistré est exporté tel quel ; `Répartition=undetermined` empêche de le lire comme des parts reconstruites.

Le CSV est un **rapport de consultation**, pas un format de restauration. Il ne contient ni comptes Auth, ni préférences, commentaires, médias, événements d'activité ou métadonnées complètes des opérations. Pour restaurer, utiliser une sauvegarde JSON/ZIP complète et vérifiée lorsqu'elle sera disponible. Les champs texte commençant comme une formule de tableur sont neutralisés par une apostrophe ; le JSON reste la représentation fidèle. Les cellules sont échappées, l'ordre est déterministe et la taille est bornée à 10 Mo. Le rapport n'a pas encore de commande de téléchargement dans l'interface ni d'essai de navigateur.
