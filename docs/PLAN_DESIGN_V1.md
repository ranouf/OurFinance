# OurFinance — plan de réalisation du design V1

Ce plan transforme le [descriptif des pages](PAGES_SITE_DESIGN.md) en livrables de design. Il couvre les pages déjà amorcées **et** celles restant à concevoir. Le thème est une **terrasse parisienne vivante**, accueillante pour les familles, les couples et les amis. Les images jointes sont des **repères d'ambiance et de composition**, pas des écrans à reproduire à l'identique. Les règles financières, les droits et les contenus des pages restent ceux du [plan technique](PLAN_TECHNIQUE_V1.md).

## Références à remettre au designer

| Référence fournie | Ce qu'elle aide à décider | Liberté de création |
| --- | --- | --- |
| [Connexion et scène de terrasse](design-references/inspiration/connexion-terrasse.png) | Équilibre entre grande scène illustrée, marque et formulaire desktop/mobile. | Recomposer les personnages, le café et le cadrage ; garder le formulaire réel lisible et immédiatement accessible. |
| [Parcours desktop et mobile](design-references/inspiration/parcours-desktop-mobile.png) | Densité des écrans Groupes, Dépenses et Statistiques ; navigation et petites touches d'illustration. | Réorganiser les cartes selon les données et les contraintes responsive, sans recopier les chiffres de l'image. |
| [Galerie des composants](design-references/inspiration/galerie-composants.png) | Catalogue à colonne latérale, familles de composants, volumes doux et détails chaleureux. | Adapter chaque composant aux usages réels et à la [spécification du catalogue](ui-kit/README.md). |
| [Accueil illustré et nuages](design-references/inspiration/accueil-illustre.png) | Bandeau violet, actions illustrées, décor de bistrot et frise de maisons/plantes. | Varier les personnes et les scènes ; garder l'effet de nuages transparents décrit ci-dessous. |

Ces quatre fichiers sont des **références de conception** fournies pour ce plan, pas des captures de validation de l'application. Les [maquettes existantes](design-references/README.md), le [guide Everyday Pop](DESIGN_EVERYDAY_POP.md) et les [illustrations du produit](../public/illustrations/) complètent le brief. En cas d'écart avec une règle métier ou d'accessibilité, adapter la composition et documenter le choix. Les textes ou nombres figurant dans les références n'ont aucune valeur fonctionnelle.

## Direction artistique

- **Personnalité :** généreuse, expressive et légèrement artisanale. Associer surfaces claires, violet profond, corail, jaune et touches menthe à des illustrations détaillées : feuillage, auvent rayé, chaises de bistrot, tables, fleurs, façades et nuages. Garder des ombres courtes et colorées et des contours doux, sans transformer les pages en grille de cartes identiques.
- **Typographie :** Nunito Sans réellement chargée, titres et montants à graisse affirmée, textes courants faciles à lire. Le designer définit une échelle de tailles et d'interlignages pour desktop et mobile ; aucun texte essentiel ne doit devenir minuscule pour faire tenir une illustration.
- **Icônes :** bibliothèque **Lucide** pour navigation, actions, catégories et états. Fixer tailles, épaisseur de trait et couleurs par contexte. Les icônes de catégorie peuvent être posées sur un fond arrondi coloré ; ne pas utiliser d'émojis comme système d'icônes.
- **Images :** présence d'illustrations à plusieurs endroits — bandeaux, zones vides, décor de fond, actions et confirmations — sans répéter le même groupe de personnages sur chaque page. Prévoir au moins des scènes distinctes pour une famille, un couple et des amis, avec diversité d'âges, d'apparences et de compositions. Varier plans larges et petites vignettes.
- **Neutralité internationale :** terrasse et architecture parisiennes sans tour Eiffel. Aucun mot français, prix, devise, panneau lisible ou texte incrusté dans les dessins : les vrais libellés restent dans l'interface traduite en FR/EN/JA. Les personnages, repas et situations doivent rester compréhensibles dans ces trois langues.
- **Densité maîtrisée :** ne pas épurer au point de perdre l'identité. Un décor peut prolonger une carte, apparaître sous un bouton ou relier la navigation au contenu ; préserver toutefois les zones de saisie, les montants, la hiérarchie et les cibles tactiles.
- **Décor de page :** conserver une frise légère de maisons parisiennes, plantes et nuages en bas à droite du contenu, visible derrière les sections sans gêner leur lecture. La sidebar peut avoir son propre décor de terrasse en bas à gauche ; aucune vignette de famille supplémentaire ne doit être ajoutée à cet endroit. Sur mobile, adapter la frise plutôt que la cacher derrière la barre de navigation.

### Signature du bandeau violet

La partie droite du bandeau principal doit former une **silhouette de nuages violets superposés**, avec plusieurs nuances, des courbes organiques et une profondeur illustrée. En **haut à droite**, certaines formes sont **transparentes ou découpées** : elles laissent voir le fond clair de la page derrière le bandeau. Ce détail est une signature visuelle à conserver sur desktop et à adapter sur mobile. Prévoir un dessin vectoriel avec transparence réelle plutôt qu'un simple dégradé linéaire ; contrôler la continuité à la jonction avec la scène humaine et la lisibilité des chiffres posés devant. Le bord droit peut déborder légèrement, sans être coupé de façon arbitraire.

## Bibliothèque d'illustrations à préparer

| Famille d'assets | Variantes à concevoir | Emplacements possibles |
| --- | --- | --- |
| Scènes humaines | Famille, couple, amis ; personnes et tables différentes ; cadrages large, carré et mobile. | Connexion, accueil, groupe sans activité, invitation. |
| Décor de terrasse | Auvent, chaises, tables, café, feuillage, fleurs, façades, nuages. | Bandeaux, fonds de cartes, sidebar, pied de contenu. |
| Formes de liaison | Nuages violets à transparence, frise de maisons/plantes, petites étincelles ou motifs. | Bandeau principal, fond de page, transitions entre sections. |
| États et actions | Scène de groupe vide, première dépense, succès, aucun résultat, reçu privé, export. | États vides, confirmations, boutons illustrés si le contraste le permet. |

Livrer des images **sans texte intégré**, avec variantes de cadrage desktop/mobile, fond transparent lorsque le décor doit se fondre dans la page, et espace réservé au contenu réel. Garder les sources haute définition et produire des formats web optimisés ; nommer les assets par scène et usage. Éviter de réutiliser une illustration complète là où une petite plante ou une icône suffit. Une nouvelle image peut être générée à partir de ce brief, puis corrigée par le designer pour la cohérence des visages, mains, chaises, perspectives, ombres et bords coupés. Les images finales du produit seront distinguées des quatre références ci-dessus.

## Parcours à concevoir

Pour **chaque** ligne, produire une maquette desktop et mobile, puis les états vides, chargement, erreur et succès pertinents. Les contenus précis et les permissions sont dans [Pages et contenus](PAGES_SITE_DESIGN.md) ; cette matrice donne la priorité visuelle.

| Parcours | Intention de composition | Illustration à varier |
| --- | --- | --- |
| Connexion, inscription, récupération | Scène accueillante + formulaire lisible ; mobile : image plus courte, formulaire sans défilement inutile. | Couple ou amis à la terrasse, distincts du Dashboard. |
| Invitation et rejoindre un groupe | QR/lien net, identité du groupe, action principale et états expiré/révoqué ; aucun jeton visible. | Petite scène d'accueil ou objet de bistrot, sans concurrencer le QR. |
| Accueil | Bandeau principal habité, solde et membres au premier regard ; actions rapides, groupes, dépenses, dettes et catégories. | Scène de famille ou d'amis, nuages découpés, frise urbaine au bas du contenu. |
| Groupes et catégories | Cartes de groupes avec devise et membres, création et réglages, catégories système/personnalisées. | Une vignette propre à chaque groupe ou décor de lieu ; pas le même portrait répété. |
| Dépenses et historique | Recherche/filtres, lignes d'opérations denses et lisibles, ajout rapide desktop ; mobile centré sur la liste. | Icônes de catégories colorées et petites touches de terrasse. |
| Création, édition et détail | Champs, cinq répartitions, aperçu des parts, reçu privé, commentaires et erreurs au bon endroit. | Illustration secondaire discrète ; priorité aux données et au focus. |
| Statistiques et remboursements | Montants dominants, anneau, graphiques, période et « qui doit quoi » ; légendes lisibles. | Motifs légers et visages variés dans les soldes, jamais comme remplacement des graphiques. |
| Profil, activité, import/export/restauration | Sections distinctes, confirmations et progression claires ; préserver la perception de sécurité. | Petits objets de terrasse ou décors de fond, sans détourner l'attention des données. |
| Galerie `/ui/components` | Colonne de navigation à gauche sur desktop ; fondations, formulaires, navigation/données, composants métier, responsive et guides. | Décor de bistrot en bordure, sans couvrir les variantes ou leurs légendes. |

## Galerie des composants réutilisables — `/ui/components`

La galerie est une **page réelle de consultation du design system**, pas un assemblage de captures. Sa navigation latérale desktop et son menu accessible mobile ouvrent : **Fondations et actions**, **Formulaires et sélection**, **Navigation, données et superpositions**, **Composants métier**, **Responsive et tokens**, **Guides et bonnes pratiques**. Le [catalogue existant](ui-kit/README.md) et l'[inventaire de composants](PAGES_SITE_DESIGN.md#composants-génériques-réutilisables-à-prévoir) fixent le périmètre.

Prévoir dans cette galerie : couleurs et typographie ; boutons et actions illustrées ; champ avec label/aide/erreur, saisies texte/courriel/mot de passe/nombre/montant/téléphone/recherche/date, textarea et sélecteur de catégorie avec icône ; checkbox, radio, switch, stepper, onglets et période ; avatar avec image ou initiales, badges et filtres ; navigation latérale/basse, cartes, lignes, tableau responsive, pagination, graphiques ; alertes, confirmation, chargement, état vide, dialogue, QR, popover et tooltip. Montrer les états normal, survol, focus visible, désactivé, erreur, chargement et succès selon le composant. Les exemples financiers utilisent uniquement des personnes et montants fictifs.

Les composants génériques portent style et interactions communes ; les règles de partage, permissions et calculs restent dans les parcours. Un même champ ou bouton garde le même comportement sur connexion, groupe et dépense. Documenter chaque variante, son usage, ses contraintes clavier/tactiles et son comportement à **320, 390, 768 et 1280 px**.

## Séquence de réalisation et livrables

1. **Fondations visuelles.** Planche de palette, typographie, espacements, icônes Lucide, relief, surfaces, nuages transparents et frise ; prototypes desktop/mobile du bandeau et de la navigation. Valider la direction avant d'étendre les pages.
2. **Bibliothèque illustrée.** Trois scènes humaines distinctes au minimum, décors séparables, variantes de cadrage et fichiers optimisés ; vérifier les raccords et l'absence de texte dans l'image.
3. **Galerie des composants.** Toutes les familles ci-dessus, états et exemples responsives. Faire valider la composition globale de la galerie, pas seulement les contrôles isolés.
4. **Pages prioritaires.** Connexion → Accueil → Groupes → Dépenses → Statistiques, chacune à 1280 et 390 px avec données fictives plausibles et états vides. Les comportements financiers restent ceux du descriptif.
5. **Parcours complémentaires.** Invitations, création/édition/détail, remboursements, profil, activité, import/export/restauration et leurs superpositions ; couvrir erreurs, confirmations et reprise.
6. **Revue transversale.** Vérifier 320, 390, 768 et 1280 px, FR/EN/JA, textes longs, clavier, focus, contraste, erreurs et ordre de lecture. Ajuster les recadrages sans cacher chiffres ni actions.

Pour chaque lot, fournir maquettes desktop/mobile, inventaire des assets et composants utilisés, états manquants, décisions d'accessibilité et différences assumées avec les références. Une fois intégré, comparer les **captures réelles de l'application** aux maquettes et corriger les écarts visibles. Les captures et vidéos de validation restent hors du dépôt et figurent dans la description du PR UI ; les quatre images de ce dossier sont des références de conception. Le design est approuvé séparément de la fusion et du déploiement de l'application.
