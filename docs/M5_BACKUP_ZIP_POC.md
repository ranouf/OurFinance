# M5 — archive ZIP partielle

`encodeBackupZipV1` vérifie d'abord le paquet en mémoire, puis produit un ZIP standard sans compression avec `manifest.json`, `group.json` et chaque reçu privé actif. Les noms restent relatifs au groupe et ne peuvent pas traverser les répertoires. Le ZIP utilise des noms UTF-8, CRC32 pour les lecteurs ZIP et SHA-256 dans le manifeste. Une archive synthétique a été contrôlée avec `unzip -t` : les deux entrées de l'essai ont réussi. Les tests unitaires couvrent aussi une archive à trois entrées, dont un PNG fictif, et refusent un reçu modifié.

Le résultat est un tableau d'octets en mémoire : aucun bouton de téléchargement ni restauration n'est encore branché. L'archive porte toujours `scope: group-v1-partial` et ne couvre pas les commentaires, événements, préférences, paramètres personnels ou lots personnels. Le snapshot Firestore n'est pas transactionnel. Le ZIP sans compression et la limite de 60 Mo imposent un export par morceaux pour les grands groupes. Le hash détecte la corruption mais ne signe pas l'origine.

Ne déposer ni ZIP de validation ni reçu dans le dépôt ou une PR. Tout essai réel doit être réservé dans l'issue #30, utiliser des comptes et médias entièrement fictifs, puis nettoyer la pile et retirer les variables temporaires. M5/M6 ne sont pas terminés avec cette archive.
