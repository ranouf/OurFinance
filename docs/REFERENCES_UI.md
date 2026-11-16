# Références d'interface — OurFinance

Les captures de référence proviennent de l'application Splitwise et servent à comprendre les **parcours et fonctionnalités**, pas à copier son identité visuelle. Les images ne sont pas encore ajoutées au dépôt : elles doivent être déposées dans `docs/screenshots/` avant une analyse visuelle par Codex.

## Parcours à examiner dans les captures

| Domaine | Points à relever |
|---|---|
| Groupes | Liste, soldes, devise, membres, ajout et navigation |
| Dépenses | Historique, dates, montants, payeurs, édition, suppression |
| Création | Description, montant, devise, groupe, payeur, date, catégorie |
| Répartition | Égalitaire, pourcentages, montants exacts, parts, ajustements |
| Catégories | Icône spécifique, par exemple chapeau pour scolarité |
| Remboursements | Soldes entre participants et règlements |
| Activité | Journal des opérations et modifications |
| Statistiques | Payé, dû, avance, soldes par période |
| Profil | Connexion, paramètres, devise, sécurité |

## Différences obligatoires par rapport à Splitwise

- Groupes autonomes, y compris un groupe personnel à un seul membre.
- Aucune répartition initiale imposée.
- Dernière répartition mémorisée **par utilisateur et par groupe**, modifiable sur chaque dépense.
- Toutes les devises actives ISO 4217.
- Catégories illustrées et personnalisables.
- Aucune limite quotidienne métier sur le nombre de dépenses.
- Import de ses propres données via exports autorisés, avec rapprochement comptable.
- Design original et responsive, PWA installable.

## Consignes d'analyse

Pour chaque PNG réellement présent : relever son nom, le parcours, les champs, les contrôles, les états et les composants `shared` potentiels. Mettre ensuite à jour ce document avec un tableau **fichier → écran → comportements → composants**, en distinguant observations et hypothèses. Ne pas inclure de noms, emails ou montants personnels dans la documentation.
