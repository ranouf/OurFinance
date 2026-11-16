# M4 — conversion manuelle exacte

`ExchangeRateSnapshot` représente un taux **explicite et daté** : une unité majeure de la devise source vaut `rate` unités majeures de la devise cible. Le taux est une chaîne décimale positive (jusqu'à 18 décimales), jamais un nombre flottant. `convertMinorExact` calcule en `BigInt` et arrondit une demi-unité mineure en s'éloignant de zéro ; `convertMinor` refuse un résultat hors de la plage des entiers sûrs persistables.

Exemples fictifs : 1,01 CAD à 0,5 JPY/CAD donne 1 JPY ; 1 JPY à 0,5 CAD/JPY donne 0,50 CAD ; 1,00 CAD à 1,234 KWD/CAD donne 1,234 KWD. Les devises à 0, 2 et 3 décimales sont prises en charge selon `Intl`.

Cette tranche est un **moteur pur**, sans récupération automatique de taux ni écriture Firestore/Worker. Elle n'autorise pas à compenser automatiquement une dette dans une autre devise. Un remboursement interdevises devra enregistrer les deux montants, les deux devises, le taux, la date et les membres dans une route serveur atomique avec vérification d'accès ; son interface et son essai réel restent ouverts.
