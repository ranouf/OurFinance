# M5 — fixture CSV synthétique

La fixture est entièrement fictive et suit l'en-tête fourni par l'utilisateur. Elle contient trois dépenses CAD et trois participants fictifs. L'importeur exige un mapping explicite des colonnes, conserve les impacts nets par participant en unités mineures exactes et vérifie que la somme des impacts est nulle pour chaque ligne. Les paiements et parts restent marqués « indéterminés » : les impacts nets seuls ne permettent pas de les reconstruire.

Le test rapproche les impacts totaux du groupe : +15,00 CAD, −15,00 CAD et zéro ; un second import détecte les trois doublons par `(groupe, identifiant de source)`. Aucune persistance ni annulation de batch n'est encore implémentée.
