# M5 — exports de groupe V2

Le choix « JSON V2 avec remboursements multidevises » ajoute `fxSettlements` au JSON de groupe V1. Chaque entrée conserve séparément le montant et la devise de la dette, le montant et la devise transférés, le taux manuel, sa date, la date du transfert, les deux membres et l’état de suppression logique. Le sérialiseur vérifie l’appartenance des membres, les identifiants uniques, les devises et la conversion arrondie avant de remettre le fichier au navigateur.

L’exporteur lit cette collection sous les règles Firestore d’un membre actif et revérifie son appartenance après la lecture. Si un accès ou une donnée échoue, aucun JSON n’est proposé. Le JSON V1 et le ZIP V1 conservent leur format et leur portée historiques ; ils continuent à omettre les opérations FX. Le CSV reste un rapport de consultation V1.

Le JSON V2 est **partiel et non restaurable à ce stade**. Il n’inclut pas les identités Auth, préférences personnelles, commentaires, activité ni les octets des reçus. Le ZIP V2 ajoute les octets des reçus privés avec un manifeste SHA-256 vérifiable ; il reste lui aussi partiel et non restaurable. Une procédure de restauration transactionnelle vérifiée reste à développer avant de considérer ce format comme une sauvegarde complète. Ne pas importer un fichier V2 avec le lecteur ZIP V1.

Essai réel à faire sur `ourfinance-test`, après réservation dans l’issue #30 : créer une dépense et un règlement FX entièrement fictifs, exporter JSON V2 depuis un membre actif, vérifier les deux montants, le taux et la date, puis vérifier qu’un tiers et un membre révoqué ne peuvent pas exporter. Nettoyer tous les comptes et documents fictifs ; ne publier ni contenu du JSON, ni jeton, ni données privées.

Pour le ZIP V2, ajouter un reçu PNG fictif `authenticated`, vérifier `manifest.json`, `group.json`, l’unique fichier média et les SHA-256 avec `decodeBackupZipV2`. L’URL Cloudinary non signée doit rester refusée. Supprimer l’asset et ses métadonnées à la fin.
