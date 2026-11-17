# Références d'interface — OurFinance

Les captures de référence proviennent de Splitwise et servent à comprendre les **parcours et fonctionnalités**, pas à copier son identité visuelle. Elles ont été transmises **privément à Codex** et ne doivent **pas** être ajoutées au dépôt. La nouvelle direction graphique approuvée est **[Everyday Pop](DESIGN_EVERYDAY_POP.md)**, avec ses illustrations SVG versionnées dans `public/illustrations/`.

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

## Observations visuelles privées (27 captures, 13 novembre 2026)

Les fichiers ont été inspectés dans un répertoire temporaire. Ce tableau ne reprend aucune donnée personnelle. Les composants sont des propositions OurFinance, distinctes de l'identité visuelle de référence. Aucun PNG n'est versionné.

| Fichier PNG (`Screenshot_20261113-…`) | Écran observé | Comportements et contrôles observés | Composants OurFinance possibles |
|---|---|---|---|
| 085141 | Conversion externe | Deux devises, taux affiché, inversion | `currency-selector`, `money-input` |
| 085409 | Groupes | Synthèse des soldes, cartes de groupe, groupes quittés, ajout | `app-shell`, `bottom-navigation`, `group-card` |
| 085504 | Conversion externe | Montant source/cible et taux | `currency-selector`, `money-input` |
| 085655 | Détail de dépense | Paiement, solde, graphique, commentaire, édition | `expense-detail`, `statistics-card` |
| 085941 | Groupes | Soldes dans plusieurs devises, filtres | `group-card`, `money-display` |
| 085948 | Détail de groupe | Membres, régler, convertir, historique daté, ajout | `group-header`, `expense-card` |
| 090002 | Dépenses hors groupe | Solde, actions, historique daté | `expense-card`, `balance-summary` |
| 090005 | Soldes | Créanciers/débiteurs, règlement et rappel | `balance-list`, `settlement-action` |
| 090018 | Statistiques | Devise, histogramme mensuel, période, total | `date-range-filter`, `statistics-card` |
| 090024 | Activité | Chronologie des créations et modifications | `activity-list` |
| 090031 | Compte | Profil, préférences, sécurité | `profile-menu` |
| 090037 | Compte suite | Notifications, aide, déconnexion | `profile-menu` |
| 090040 | Compte fin | Déconnexion et informations d'application | `profile-menu` |
| 090050 | Détail de dépense | Historique de modification et commentaires | `expense-detail`, `activity-list` |
| 090054 | Édition | Description, montant, groupe, date, photo, partage | `expense-form`, `money-input`, `category-picker` |
| 090058 | Choix de partage | Raccourcis égalitaire, dette totale, autres options | `split-editor` |
| 090102 | Partage égalitaire | Participants cochés, part par personne | `split-editor`, `user-avatar` |
| 090106 | Montants exacts | Somme saisie par participant, reste à répartir | `split-editor`, `money-input` |
| 090110 | Pourcentages | Pourcentage par participant, total et reste | `split-editor` |
| 090113 | Parts | Poids par participant, nombre total de parts | `split-editor` |
| 090116 | Ajustements | Ajustement signé, distribution du solde | `split-editor`, `money-input` |
| 090132 | Catégories | Recherche et catégories illustrées par famille | `category-picker` |
| 090135 | Catégories suite | Catégories logement, alimentation et loisirs | `category-picker` |
| 090140 | Catégories suite | Catégories services et transport | `category-picker` |
| 090144 | Catégories suite | Catégories transport | `category-picker` |
| 090147 | Catégories suite | Catégories santé, cadeaux et scolarité | `category-picker` |
| 085158 | Amis | Soldes par personne, détail par groupe, ajout | `friend-balance-list`, `bottom-navigation` |

Hypothèses à valider dans OurFinance : les écrans de conversion sont externes à Splitwise ; ils illustrent un besoin de conversion explicite, sans prouver un parcours intégré. Les captures ne montrent ni inscription, ni invitation, ni import/export, ni réglage de confidentialité des pièces jointes.
