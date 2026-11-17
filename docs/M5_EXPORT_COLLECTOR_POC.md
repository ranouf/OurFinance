# M5 — collecte cliente du JSON de groupe

`FirebaseExportReader` parcourt les sous-collections du groupe sous les règles Firestore avec des pages de 50 documents, puis `collectGroupExportV1` construit le format de la PR #43. La fonction relit l'appartenance active à la fin et refuse les champs absents ou les sommes incohérentes. Elle ne crée aucun fichier dans l'interface et ne télécharge aucun reçu. Le JSON contient seulement les métadonnées des reçus avec `mediaIncluded: false`.

## Protocole de test fictif, après réservation de la pile

1. Partir du SHA exact de cette PR et vérifier que les règles Firestore de la pile intégrée autorisent seulement le membre actif à lire chaque collection. Créer un groupe fictif avec deux membres, une dépense de 101 unités mineures ayant un instantané de catégorie, un règlement de 51, un import historique `undetermined`, une catégorie personnalisée et un reçu PNG fictif. Aucun compte ou reçu réel.
2. Se connecter comme membre actif avec courriel confirmé. Appeler la collecte avec le SDK client et vérifier que toutes les lignes attendues sont présentes, que les paiements/parts valent 101, que les impacts historiques restent équilibrés et que le reçu porte `mediaIncluded: false` sans `publicId` ni octets. Vérifier la pagination avec plus de 50 opérations synthétiques si la fixture est disponible ; compter les pages et les documents.
3. Essayer un tiers et un membre révoqué : aucune sortie JSON. Révoquer le membre pendant la collecte et vérifier le refus de la relecture finale. Les règles Firestore constituent la frontière d'accès ; un contrôle client seul ne suffit pas.
4. Supprimer groupe, sous-collections, comptes fictifs et asset Cloudinary, puis vérifier zéro résidu. Ne jamais publier les jetons, le JSON de fixture ou les médias dans le dépôt ou la PR.

Ce test ne validera **pas** un instantané transactionnel : une dépense peut changer pendant la pagination, et une révocation immédiatement après la dernière lecture n'est pas couverte. Il ne validera pas non plus une sauvegarde restaurable : commentaires, événements, préférences, informations de compte et octets des reçus restent hors format. Avant tout export final, prévoir un instantané serveur cohérent ou une stratégie de verrouillage/version, puis l'intégrité et la restauration des médias privés.
