# M5 — Préparer un lot CSV pour le Worker

`previewMappedCsv` lit un CSV local avec colonnes choisies explicitement. `prepareImportBatch` transforme cet aperçu en corps de requête pour `POST /groups/{groupId}/imports`, après correspondance explicite des identifiants de participants source vers des identifiants de membres OurFinance. Cette fonction reste pure : elle n'envoie aucun fichier ni jeton.

Elle refuse tout aperçu avec erreur ou doublon, plusieurs groupes source, impacts manquants ou déséquilibrés, mapping incomplet ou ambigu, identifiant de lot invalide et lot de plus de dix lignes. Le groupe cible et le lot doivent être choisis par le parcours appelant. Le Worker de la PR #25 vérifie ensuite à nouveau les données, le propriétaire et l'appartenance active avant toute écriture.

Exemple synthétique : les colonnes `Alex Exemple`, `Camille Exemple`, `Sam Exemple` sont associées à trois comptes fictifs actifs du groupe cible ; les trois lignes de `tests/fixtures/splitwise-synthetique.csv` donnent +15,00 / −15,00 / 0,00 CAD. Aucun payeur ni partage n'est déduit.

Cette tranche ne fournit pas encore d'écran de mapping, de téléversement, de traitement de plus de dix lignes, de lecture des doublons Firestore ni de rapprochement interactif. Elle n'active aucune route de production.
