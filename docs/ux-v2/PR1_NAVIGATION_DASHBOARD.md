# UX V2 — PR 1 : navigation, Dashboard et premier démarrage

Statut : proposition de conception à valider avant implémentation. Les nombres et noms ci-dessous sont fictifs et servent seulement à décrire les états. Source fonctionnelle : `docs/UX_SPECIFICATION_V2.md`. Références de composition : les deux maquettes Everyday Pop V2 du Dashboard dans `docs/design-references/`. Les personnages et tables de `cafe-hero-mobile.webp` restent l'illustration du bandeau.

## Parcours et structure

### Desktop, largeur de référence 1280 px

```text
┌──────────────────┬──────────────────────────────────────────────────────────────────┐
│ marque           │ Bonjour !      Recherche de dépenses       [Groupe ▾] [Avatar ▾] │
│ Accueil          ├──────────────────────────────────────────────────────────────────┤
│ Groupes          │ ┌──────────────────────────────────────────────────────────────┐ │
│ Dépenses         │ │ Café illustré  │ Notre famille · CAD / avatars             │ │
│ Statistiques     │ │ personnages    │ On te doit 127,50 CAD                     │ │
│                  │ │ et tables      │ Dépenses du mois / ma part / payé par moi │ │
│ décor de café    │ └──────────────────────────────────────────────────────────────┘ │
│ en pied          │ [Ajouter une dépense] [Inviter des membres] [Équilibrer]          │
│                  │ [Qui doit quoi ?] [Dépenses récentes] [Par catégorie]             │
│                  │ Autres groupes →                                                  │
└──────────────────┴──────────────────────────────────────────────────────────────────┘
```

- Le sélecteur global est dans l'en-tête ; le bandeau affiche le groupe actif sans second sélecteur. Nom, devise et avatars restent visibles. Le changement de groupe remplace **ensemble** données, devise, soldes, récents et catégories.
- La recherche dans l'en-tête mène à l'historique avec le groupe et le texte saisi conservés. Elle reste accessible au clavier. Sur les pages où un filtre de recherche existe déjà, il n'y a pas deux champs simultanés.
- Le solde principal est le solde net **après remboursements**, sans filtre de période. La phrase change selon son signe : « On te doit », « Tu dois », « Tes comptes sont équilibrés ». Un nombre signé seul ne suffit pas.
- Les trois indicateurs portent explicitement « ce mois-ci » : dépenses du groupe, ma part, payé par moi. Ils ne sont pas confondus avec le solde courant. Le camembert indique sa propre période et un total exact.
- « Inviter des membres » ouvre le parcours QR/lien du groupe actif si le compte a le droit d'émettre une invitation ; sinon il présente une explication et le parcours Groupe → Membres. Il n'y a qu'un seul CTA d'invitation dans cette zone.
- « Équilibrer » ouvre le parcours de remboursement existant pendant la transition, puis `/balances` au PR 6. Ce clic n'enregistre rien.
- Les autres groupes sont montrés individuellement avec leur devise ; aucun montant multidevise agrégé.

### Mobile, largeur de référence 390 px

```text
┌─────────────────────────────────┐
│ marque                    avatar│
│ Recherche de dépenses           │
│ Bonjour !                       │
│ ┌─────────────────────────────┐ │
│ │ Groupe actif · CAD          │ │
│ │ Couple au café + tables     │ │
│ │ On te doit 127,50 CAD       │ │
│ └─────────────────────────────┘ │
│ [ + Dépense ] [ Inviter ]       │
│ [ Équilibrer les comptes ]      │
│ Mes groupes             Tout voir│
│ [Notre famille · CAD]           │
│ Dépenses récentes       Tout voir│
│ [opération 1] [opération 2]     │
│ Qui doit quoi ?                  │
│ Par catégorie                   │
│ [Accueil] [Groupes] [+]         │
│ [Dépenses] [Statistiques]        │
└─────────────────────────────────┘
```

- Le bandeau compact précède les autres cartes ; le solde et les actions restent proches du haut. La scène conserve le couple, la rose et la table ; elle ne recouvre aucun chiffre.
- La navigation basse contient cinq emplacements et un `+` central **sans libellé visuel superflu**. Le `+` ouvre la création dans le groupe actif ; sans groupe il ouvre la création du premier groupe. Aucun détour par une page sans action.
- Le lien « Compte » se trouve dans l'avatar en haut. Son menu contient Profil/préférences et Déconnexion ; fermeture par Échap, clic extérieur et retour de focus.
- Les cartes secondaires sont empilées, sans défilement horizontal de la page. Les actions ont une cible de 44 px minimum à 320 px.

## États à concevoir dans les mêmes maquettes

| État | Contenu et action |
|---|---|
| Aucun groupe | Shell et navigation visibles ; illustration, « Créer mon premier groupe », « Rejoindre un groupe » et « Importer mes dépenses » avec groupe cible explicite. Aucun montant fictif ni widget financier vide. |
| Premier groupe créé | Accès immédiat au groupe ; suggestion facultative de première dépense ou invitation. Aucun tutoriel bloquant. |
| Groupe personnel | Solde interpersonnel et « Qui doit quoi ? » remplacés par une information adaptée ; dépenses, catégories et statistiques restent disponibles. Invitation accessible au propriétaire. |
| Groupe partagé, solde positif | « On te doit » et montant positif avec devise ; liste de membres et créances explicites. |
| Groupe partagé, solde négatif | « Tu dois » et montant à régler sans signe ambigu ; accès à Équilibrer. |
| Groupe partagé, solde nul | « Tes comptes sont équilibrés » ; pas de badge vert comme seule information. |
| Chargement/erreur/hors ligne | Squelette ou message local à chaque panneau ; bouton Réessayer pour échec récupérable ; pas d'ancienne somme présentée comme actuelle après changement de groupe. |
| Session expirée / groupe révoqué | Message explicite, données privées effacées de l'écran, connexion ou autre groupe accessible ; brouillon protégé. |

## Contrat des interactions

1. La sélection globale persiste uniquement pour un groupe auquel le compte appartient encore. Un lien profond vers un autre groupe autorisé le sélectionne ; un groupe inaccessible ne révèle pas ses données.
2. Avant tout changement de groupe, un formulaire avec brouillon demande de conserver/reprendre ou d'abandonner le brouillon. La navigation ne le supprime pas silencieusement.
3. Le groupe actif et sa devise sont propagés à Dépenses, Statistiques, Groupes et Équilibrer. Chaque bloc du Dashboard utilise les mêmes données serveur et la même révision.
4. Les cartes d'opération ouvrent le détail ; « Tout voir » mène à l'historique du même groupe. Retour depuis le détail : groupe, filtres et position préservés.
5. Les trois actions principales sont uniques, libellées et désactivées si l'action n'est pas disponible. Aucun double envoi possible.
6. Les noms et montants dans la maquette ne deviennent jamais des valeurs applicatives. FR/EN/JA, dates et montants locaux, texte japonais long et contraste sont vérifiés dans le rendu réel.

## Composants à réutiliser ou adapter

`AppShell`, `UiGroupCard`, `UiIconBadge`, `UiAlert`, `UiButton`, `GroupOverview`, les composants de dépense et de catégorie existants. Extraire uniquement les primitives réellement partagées : sélecteur de groupe global, résumé de solde, carte d'indicateur et ligne de dépense. Chaque primitive présente des données et émet une action ; le chargement Firebase/Worker, les permissions et les calculs restent dans les services ou conteneurs. La galerie `/ui/components` montre les variantes génériques nouvelles.

## Écarts connus du code actuel à traiter après validation

- Le shell a encore « Compte » comme cinquième entrée mobile et comme lien de sidebar ; la composition V2 demande Compte dans l'avatar et Dépenses dans la barre basse.
- Le `+` bas mène à `/expenses` sans garantir l'ouverture du formulaire ; le lien de création doit transmettre explicitement l'intention et le groupe.
- Le Dashboard place actuellement les autres groupes juste sous la bannière, avant les trois actions ; le nouvel ordre privilégie actions et indicateurs.
- Le bandeau actuel affiche « mon solde », total historique du groupe et remboursements. Le contrat V2 demande un libellé de solde net puis les trois indicateurs du mois, calculés sans confondre leurs périodes.
- Le panneau catégories repose aujourd'hui sur le total historique ; la période doit être visible et cohérente avec le calcul choisi.
- L'invitation et l'équilibrage sont des liens vers des ancres de pages. La première action doit ouvrir un dialogue unique ; la seconde sera migrée au PR 6.
- L'état sans groupe affiche des étapes fixes et seulement « Créer ». Ajouter « Rejoindre » et « Importer » sans exposition de données avant authentification.

## Validation requise avant code

1. Valider ce wireframe desktop/mobile et les états zéro groupe, personnel et partagé.
2. Produire ensuite des maquettes Everyday Pop desktop/mobile avec les vrais assets et les soumettre à validation visuelle. Les captures et vidéos de validation restent hors du dépôt et seront liées dans la description du PR.
3. Après accord, implémenter dans ce même PR, exécuter typecheck, lint, tests unitaires et E2E, build, captures Playwright 1280 × 800 / 390 × 844 et contrôles 320 / 768, FR/EN/JA. Comparer la référence à gauche et le résultat à droite.
