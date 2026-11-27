# UX V2 — PR 4 : dépenses

Statut : cadrage et wireframes à valider avant l'intégration. Les maquettes PR 4 desktop/mobile seront produites à partir de ce cadrage puis soumises au propriétaire ; les images `design-references/depenses-*` sont des références, **pas une validation des nouvelles maquettes**. Base : `docs/UX_SPECIFICATION_V2.md`, `docs/PAGES_SITE_DESIGN.md` et `docs/PLAN_TECHNIQUE_V1.md`. Le périmètre est l'ensemble du parcours `/expenses` : historique, création, détail, édition, suppression, commentaires et reçus privés. Les services métier existants restent la source des calculs et des droits.

## Hiérarchie

1. **Contexte** : groupe actif et devise fixe, visibles en permanence. La recherche est immédiatement accessible.
2. **Historique** : chronologie, filtres appliqués et lignes ouvrant le détail. La sélection ne réinitialise ni filtres ni position.
3. **Création rapide** : description, montant, catégorie, date du jour modifiable, payeur courant et dernière répartition valide du même utilisateur dans ce groupe, avec un résumé explicite avant enregistrement.
4. **Options de répartition** : participants, plusieurs payeurs et cinq modes. Les montants exacts restent visibles ; les choix avancés n'encombrent pas le premier écran.
5. **Détail** : conséquence de cette opération, parts, payeurs, reçu privé, commentaires, historique pertinent et actions autorisées. Aucun solde global n'est présenté comme le résultat de cette seule dépense.

```text
Ordinateur ≥ 1100 px                     Mobile ≤ 700 px
┌────────┬────────────────────────────┐  ┌───────────────────────────┐
│ Menu   │ Groupe · devise  [+ Ajouter]│  │ Groupe · devise           │
│        │ Recherche + filtres         │  │ Recherche + filtres       │
│        │ ┌──────────┐ ┌────────────┐ │  │ Liste de dépenses         │
│        │ │ Historique│ │ Formulaire  │ │  │ [+ Ajouter]               │
│        │ │ dates/    │ │ rapide ou   │ │  └───────────────────────────┘
│        │ │ lignes    │ │ détail      │ │  Création ou détail :
│        │ │ paginées  │ │ sélectionné │ │  ┌───────────────────────────┐
│        │ └──────────┘ └────────────┘ │  │ ← Historique              │
└────────┴────────────────────────────┘  │ Contexte / contenu / CTA   │
                                        └───────────────────────────┘
```

À 768 px, empiler historique et panneau sans perdre la recherche ; à 320 et 390 px, ouvrir création, édition et détail sur un écran dédié. Le CTA d'enregistrement reste accessible quand le clavier mobile est visible. Le retour restaure la recherche, les filtres, la page, l'élément sélectionné et le défilement. Un brouillon non enregistré demande confirmation avant fermeture ou changement de groupe.

## Historique et filtres

- Chaque ligne indique date, description, catégorie avec icône/couleur, montant total avec devise, payeur(s) et, si utile, information personnelle. Les opérations supprimées logiquement ne figurent pas comme actives.
- Recherche par description, période inclusive, catégorie et participant. Des chips décrivent les filtres appliqués et peuvent être retirés individuellement ; « Réinitialiser » efface l'ensemble. Le terme `?search=` venu de l'accueil est appliqué sans duplication.
- Pagination et ordre décroissant stables ; un total par jour n'est ajouté que si les données chargées permettent de le calculer exactement. Distinguer aucun enregistrement, aucun résultat après filtre, chargement, page suivante et erreur récupérable. Les catégories archivées restent lisibles dans l'historique.
- Le groupe global est l'unique contexte de la liste. Une nouvelle sélection de groupe vide les résultats précédents avant le chargement ; aucun montant provenant d'un autre groupe ou d'une autre devise ne persiste à l'écran.

## Création, édition et répartition

Le formulaire rapide affiche d'abord groupe/devise, description, montant, catégorie, date du jour, payeur courant et le résumé de la dernière répartition **valide du même utilisateur et du même groupe**. Le résumé permet « Modifier la répartition » ; s'il n'existe aucune préférence exploitable, proposer l'égalitaire avec les membres actifs, explicitement. Ne jamais appliquer silencieusement une ancienne répartition à un autre groupe.

La zone avancée permet plusieurs payeurs, inclusion/exclusion de participants, reçu et les cinq modes : égalitaire, montants exacts, pourcentages, parts, ajustements. Chaque ligne montre le nom, la valeur saisie et le montant attribué dans la devise du groupe. Le restant, l'écart de somme et les règles d'arrondi sont expliqués avant confirmation. Une synthèse d'impact distingue **total**, **payé**, **part attribuée** et **dette de cette dépense** ; par exemple, pour 100 CAD payés par moi et partagés 60/40, Alex me doit 40 CAD pour cette dépense. Les calculs viennent des services métier, y compris payeurs multiples et fractions historiques.

L'édition recharge la répartition réellement enregistrée, respecte les droits existants et ne se fonde pas sur une préférence plus récente. La suppression exige une confirmation et n'est offerte qu'à l'utilisateur autorisé. Double clic bloqué ; la création réutilise la **même clé d'idempotence déjà prise en charge par le formulaire et le Worker** tant que le corps de dépense reste identique. Après une réponse perdue, vérifier l'état de l'opération avant toute nouvelle tentative ; un corps modifié reçoit une nouvelle clé. L'envoi d'un reçu n'a pas le même contrat d'idempotence : si sa réponse est incertaine, rafraîchir la liste privée des pièces jointes et proposer un rapprochement avant tout nouvel envoi, jamais une reprise aveugle. Après succès confirmé, l'historique est rafraîchi puis le contexte d'origine est restauré.

## Détail, commentaires et reçus

- Le détail montre description, catégorie, date, groupe, devise, total, chaque paiement et chaque part, puis les conséquences de **cette** opération. Les commentaires sont accessibles avec leur auteur et leur date ; état vide et erreurs distincts.
- Reçu : choisir un fichier ou capturer une photo si le navigateur le permet, aperçu local, progression, confirmation d'accès privé, lecture réservée aux membres actifs, retrait selon droits et reprise d'un nettoyage distant en attente. Le navigateur reçoit uniquement le Blob via le Worker après contrôle du membre actif ; l'URL Cloudinary signée reste côté Worker, et sa réponse porte `Cache-Control: no-store`. Tout `objectURL` local est révoqué et l'aperçu fermé lors de la fermeture, d'un changement de groupe ou compte, d'une déconnexion ou d'une révocation détectée. Une image déjà téléchargée dans la mémoire d'un appareil ne peut pas être effacée à distance : ne pas promettre une révocation rétroactive de ces octets. Une nouvelle lecture après révocation est refusée côté Worker.
- Les actions Éditer et Supprimer sont visibles uniquement selon les droits réels. Une dépense supprimée ouverte depuis un ancien lien affiche un état explicite, sans faux détail. Le focus revient à la ligne déclenchante après fermeture quand elle existe encore.

## États à maquetter et vérifier

| État | Résultat attendu |
|---|---|
| Aucun groupe | Invitation à créer ou rejoindre un groupe ; aucune dépense fictive. |
| Groupe personnel | Dépense personnelle sans dette artificielle ni invitation exigée. |
| Recherche sans résultat | Filtres visibles, effaçables, message distinct de l'historique vide. |
| Erreur de champ ou somme | Message lié au contrôle, focus utile, saisie conservée. |
| Réseau ou session expirée | Réessayer ou se reconnecter ; conserver temporairement le brouillon uniquement pour le même compte et le même groupe encore autorisé, après réauthentification. |
| Changement de compte/groupe ou membre révoqué | Isoler ou purger le brouillon et les données financières de l'ancien contexte ; fermer et révoquer les aperçus Blob. Aucun détail ni nouveau reçu privé après révocation ; état d'accès refusé clair. |
| Navigation avec brouillon | Confirmation avant perte ; retour sans effacement intempestif. |

## Composants communs

Réutiliser `UiFormField`, `UiControlErrors`, `UiInput`/`UiTextarea`, `app-dropdown` avec icône de catégorie, `UiIconBadge`, `UiButton`, `UiAlert`, les composants d'état vide/chargement, dialogue et pagination existants. Si une primitive manque, la créer dans `shared/components`, démontrer ses variantes dans `/ui/components`, la tester comme contrôle générique et garder appels Firebase/Worker et calculs hors de la primitive. Icônes Lucide, focus visible, contrastes et cibles tactiles de 44 px.

## Preuve de complétion

- Maquettes desktop **et** mobile approuvées avant modification du parcours ; conserver la référence Everyday Pop V2 et les illustrations sans cacher les champs.
- Tests locaux à 320, 390, 768 et 1280 px, FR/EN/JA, clavier, lecteur d'écran applicable, focus, brouillon, filtres et retour. Scénarios de cinq modes, plusieurs payeurs, création/édition/suppression, commentaires et reçu privé avec comptes fictifs ; aucun total multidevise.
- Typecheck, lint, tests unitaires et intégration pertinents, build, Playwright, revue IA après chaque commit/push et workflow PR Validation vert au HEAD. Captures réelles 1280 × 800 et 390 × 844, vidéo, comparaison aux références et écarts restants dans la description du PR ; aucun média de validation dans le dépôt.
- Validation visuelle explicite du propriétaire avant squash merge. La revue, les tests locaux et la CI sont les portes de fusion de ce PR. Le parcours intégré sera revérifié sur TEST **après** fusion dans la validation globale des sept PR ; cette vérification ne constitue pas une porte de fusion rétroactive. Toute défaillance trouvée sur TEST fera l'objet d'un correctif distinct avant la clôture du plan. La production relève d'une décision distincte.
