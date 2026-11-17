# M3 — dépenses : état

Le moteur pur calcule les cinq méthodes de partage en unités mineures entières, avec arrondi déterministe et validation des sommes/payeurs/membres. Le catalogue de devises vient d'`Intl.supportedValuesOf('currency')` et l'exposant de `Intl.NumberFormat`. Une préférence personnelle `(utilisateur, groupe)` est seulement proposée si les membres de la configuration sont toujours actifs.

Le formulaire, la persistance atomique par Worker, les catégories illustrées, l'historique et l'intégration des préférences ne sont pas encore implémentés. Le critère de fin M3 reste ouvert.
