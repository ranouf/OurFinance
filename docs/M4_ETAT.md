# M4 — finances : état

Un calcul dérivé reconstitue les soldes par groupe, devise et utilisateur à partir des paiements, parts et règlements, avec filtres de dates et exclusion des suppressions logiques. Il utilise `BigInt` pour les totaux et vérifie la conservation des dépenses. Les règlements partiels sont couverts par tests.

L'interface de remboursement/statistiques, les conversions à taux explicite, la persistance et les tests de concurrence restent à faire. Aucun solde multidevise n'est additionné. Le critère de fin M4 reste ouvert.
