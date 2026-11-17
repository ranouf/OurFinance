# M5 — import et photos : état

Un parseur CSV local et un aperçu versionné permettent un mapping explicite de colonnes, signalent doublons et lignes invalides, et marquent chaque répartition historique comme indéterminée. Le format CSV réel Splitwise n'a pas été fourni ; aucune correspondance implicite n'est inventée. Aucune donnée n'est transmise.

La persistance, le rapprochement de soldes, l'annulation de batch, l'export natif, l'extension et le stockage privé Cloudinary restent à faire. Les pièces jointes nécessitent le POC M0. Le critère de fin M5 reste ouvert.

Les clés de provenance sont composées de `(groupId, sourceId)` ; l'appelant transmet les clés existantes dans ce format JSON pour garantir le dédoublonnage par groupe.
