# OurFinance — Direction UI/UX validée : **Everyday Pop**

**Décision produit du 16 novembre 2026.** Cette direction remplace le style générique de la PR #101 (cartes turquoise, grande carte blanche centrale, sections empilées) et la mascotte jaune initialement proposée. **Ne pas modifier les règles métier ni les calculs financiers pour appliquer ce thème.**

## 1. Référence visuelle et assets livrés

Les illustrations vectorielles **SVG authentiques** sont versionnées dans `public/illustrations/` :

| Asset | Utilisation |
|---|---|
| `cafe-terrace-desktop.svg` | Hero illustré de la page de connexion desktop et éventuel onboarding |
| `cafe-terrace-mobile.svg` | Bandeau de connexion mobile et onboarding, avec cadrage adapté |
| `ourfinance-mark.svg` | Marque OurFinance (pictogramme corail incliné) |
| `category-groceries.svg` | Bulle décorative épicerie + devise |
| `category-dining.svg` | Bulle décorative restaurant + devise |
| `category-transport.svg` | Bulle décorative transport + devise |
| `category-travel.svg` | Bulle décorative voyage + devise |
| `category-home.svg` | Bulle décorative logement + devise |

**Sujet approuvé** : terrasse de café chaleureuse, trois amis partageant des bières **jaunes**, un couple assis à une table avec **rose rouge**, chaises de bistrot blanches à tressage rouge, décor convivial, bulles de catégories et symboles monétaires. **Pas de tour Eiffel, de nom de bistrot, de phrases dans l'illustration ni de texte dépendant d'une langue.** Les symboles $, €, ¥, £ sont uniquement décoratifs : **chaque groupe possède toujours une seule devise stricte**, sans conversion.

Ces SVG sont des **interprétations vectorielles originales et plus épurées** de la direction illustrée approuvée, pas un tracé fidèle pixel par pixel des images de conception. Les fichiers doivent rester vectoriels, sans `<image>` embarquant un PNG, sans scripts, sans ressources distantes et sans données personnelles.

**Important :** les captures d'écran Splitwise fournies séparément à Codex restent privées et **ne doivent jamais être ajoutées au dépôt**. Les maquettes d'interface servent de direction, pas d'éléments graphiques à reproduire à l'identique.

## 2. Personnalité de marque

**Everyday Pop** = chaleureux, joyeux, contemporain, rassurant, social et ludique **sans devenir enfantin**. L'utilisateur doit se sentir dans une application conviviale de dépenses partagées, pas dans un back-office financier.

- Grandes formes arrondies, illustrations narratives, touches de confettis/étoiles discrètes et petites micro-interactions.
- Hiérarchie claire : d'abord le groupe actif et les montants, puis les opérations, puis les détails.
- Ton humain mais précis : « On te doit 185 $ » peut coexister avec « Solde net à recevoir » dans le détail. Aucun libellé ambigu sur payé/dû/remboursé.
- Les illustrations sont **fortes sur la connexion** et **ponctuelles sur le dashboard**, jamais derrière des montants ou des formulaires complexes.
- Aucun mascotte ronde jaune géante à la place de la terrasse. Ne pas faire de l'illustration une bannière géante sur tous les écrans.

## 3. Design tokens (base de travail)

| Rôle | Valeur |
|---|---|
| Primaire | `#6455EC` — violet lumineux |
| Primaire foncé | `#4735B9` — hover/active |
| Corail | `#FF806D` — accent/CTA secondaire avec **texte foncé** |
| Jaune soleil | `#F7C85F` — illustrations et touches joyeuses |
| Menthe | `#A8D9BF` — solde positif, accents |
| Fond général | `#F6F5FF` — lavande très claire |
| Surface | `#FFFFFF` |
| Texte principal | `#302752` — prune foncé |
| Texte secondaire | `#7B6C93` — suffisamment contrasté |
| Bordures | `#EAE6F5` |
| Fond violet pâle | `#ECE8FF` |
| Fond corail pâle | `#FFF0E9` |
| Fond menthe pâle | `#E4F4EA` |

- Typographie recommandée : **Nunito Sans** ou police libre arrondie équivalente avec couverture FR/EN/JA ; fallback système et police japonaise adaptée. Aucun téléchargement de police propriétaire.
- Arrondis : `12px` contrôles, `16–20px` cartes, `24px` grandes surfaces, `9999px` pills.
- Ombres : très douces, limitées aux cartes principales et popovers ; pas de bordures épaisses partout.
- Espacements : grille de 4/8 px, rythme vertical généreux, touch targets **≥ 44 × 44 px**.
- **Accessibilité** : violet primaire + blanc acceptable pour les boutons ; corail `#FF806D` **avec texte prune foncé** (blanc sur corail clair manque de contraste). Les informations de dette/créance ne reposent jamais uniquement sur la couleur.
- Implémenter les tokens en variables CSS/Tailwind et les utiliser dans les composants partagés ; ne pas disséminer des couleurs hexadécimales dans chaque composant.

## 4. Écrans — desktop et mobile

### 4.1 Connexion / inscription / récupération — priorité M1

**Desktop** : mise en page en deux panneaux. À gauche, illustration de terrasse (`cafe-terrace-desktop.svg`) sur fond violet, marque, titre et sous-titre **en HTML traduisible** (pas dans le SVG). À droite, carte/formulaire blanc : logo, bienvenue, email, mot de passe, afficher/masquer, récupération, CTA principal, Google, inscription. L'illustration est décorative et ne doit pas gêner les champs.

**Mobile** : une seule colonne. Logo compact, bandeau illustré `cafe-terrace-mobile.svg` **moins haut que la moitié de l'écran**, puis titre et formulaire directement accessibles sans défilement excessif. Éviter d'imposer une hauteur fixe qui coupe les champs sur un téléphone 320 px. Pas de navigation de l'application avant authentification.

**États** : validation de formulaire, loading, erreurs Auth, email non vérifié, offline, succès, inscription, récupération. Les trois langues FR/EN/JA doivent fonctionner avec textes plus longs et glyphes japonais.

### 4.2 Dashboard / Mes groupes — priorité M1–M2

**Desktop** : sidebar persistante (Accueil, Groupes, Dépenses, Statistiques, Profil), en-tête avec salutation, sélection du groupe actif, CTA « Ajouter une dépense », carte héro violette **compacte** indiquant le solde du **groupe sélectionné**, 2–3 KPI pertinents, liste de groupes (cartes) et opérations récentes. Petite illustration ou détail de la terrasse **dans un espace non critique**, pas de texte masqué.

**Mobile** : en-tête marque + avatar, salutation courte, carte violette du groupe actif et solde, deux KPI prioritaires, liste de groupes et dernières dépenses ; **bottom navigation** et bouton `+` central. Les cartes de groupes ont une icône, un nom, **une seule devise**, le nombre de membres et le solde. Ne jamais sommer des montants CAD/JPY/EUR dans un total unique.

**Cas** : groupe personnel à 1 membre, 2 membres, 3+ membres, aucun groupe, aucun solde, soldes positifs/négatifs, noms longs, langue japonaise, listes longues, chargement, erreur.

### 4.3 Dépenses / édition — priorité M3

**Desktop** : groupe actif + devise fixe, filtres clairs, historique par date et catégorie, CTA principal ; ajout rapide en panneau latéral ou dialogue, pas de liste interminable de formulaires sous le dashboard.

**Mobile** : liste lisible avec icônes colorées, montant, date, payeur et catégorie ; bouton `+` persistant ouvrant une **page dédiée ou bottom sheet** pour la dépense. Saisie rapide et validation claire, puis éditeur de répartition en cinq modes. Respecter la **dernière répartition de cet utilisateur dans ce groupe**. Aucune sélection de devise par dépense.

**Catégories** : utiliser Lucide et la palette pour les **icônes métier réelles**. Les SVG `category-*.svg` sont décoratifs/marketing ; ils ne remplacent pas nécessairement les icônes de liste, car leurs symboles monétaires sont décoratifs et pourraient prêter à confusion.

### 4.4 Statistiques — priorité M4

**Desktop** : barre de contexte (groupe actif, devise, période), 3–4 KPI, graphique en anneau des catégories, barres **payé vs part attribuée** par membre, évolution des dépenses dans le temps ; espace suffisant pour les légendes et montants.

**Mobile** : KPI en 2 colonnes, graphiques **empilés verticalement**, légendes lisibles, pas de mini-graphiques compressés ni de défilement horizontal imposé.

**Période** : **un seul dropdown** dans la page ; son popover contient **trois onglets Jours / Mois / Années**. Jours = calendrier à deux mois sur desktop, adapté sur mobile ; Mois = grille de mois ; Années = grille d'années. Sélection début puis fin, plage inclusive, `Annuler` et `Appliquer`. Ne pas confondre la granularité du sélecteur avec celle du graphique temporel.

**Sémantique financière** : « payé », « part attribuée », « écart des paiements » et « solde après remboursements » sont distincts. Tous les chiffres du dashboard d'un groupe sont dans sa devise stricte.

## 5. Composants Angular réutilisables

`AppShell`, `BrandMark`, `SidebarNavigation`, `BottomNavigation`, `GroupSwitcher`, `GroupCard`, `BalanceHero`, `StatCard`, `ExpenseListItem`, `CategoryIcon`, `ExpenseEditor`, `SplitEditor`, `PeriodRangePopover`, `CategoryDonutChart`, `MemberPaymentChart`, `SpendingTrendChart`, `EmptyState`, `LoadingSkeleton`, `Toast`, `ConfirmDialog`.

Créer une couche de tokens commune, **ne pas dupliquer** les vues pour desktop/mobile : les mêmes données et composants changent de disposition via responsive. Pas de refonte des services métier ou de la sécurité pour appliquer un thème.

## 6. Découpage des travaux pour Codex Cloud et Codex local

| Jalon | Travaux de refonte Everyday Pop | Validation |
|---|---|---|
| **M1 — Design foundation** | Tokens, marque SVG, composants partagés, shell desktop/mobile, **connexion responsive illustrée** | 320/390/768/1280 px ; FR/EN/JA ; contraste et clavier |
| **M2 — Groupes / Dashboard** | Cartes de groupes, sélecteur de groupe, balance hero, états vides, navigation | 1/2/3+ membres ; devise unique ; aucun total multidevise |
| **M3 — Dépenses** | Liste de dépenses, ajout rapide desktop, éditeur mobile, catégories, états de formulaire | Split en cinq modes ; devise fixe ; données réelles non simulées |
| **M4 — Statistiques** | KPI, camembert, comparatif membres, courbe, dropdown de période | Périodes exactes, responsive, accessibilité, données financières cohérentes |
| **M6 — QA** | Tests E2E/visuels, FR/EN/JA, focus, 320 px, performance, poids SVG et animations réduites | Aucune régression métier, build et tests verts |

**Coordination** :
1. Lire `AGENTS.md`, `docs/PLAN_TECHNIQUE_V1.md` et **ce document** avant d'implémenter l'UI.
2. Examiner les SVG **réellement présents** dans `public/illustrations/`.
3. La PR **#101** est un travail de responsive/structure, **pas une validation de sa direction graphique**. Les PR #100 (statistiques) et #105 (navigation clavier) doivent être conservées fonctionnellement autant que possible.
4. Cloud et local doivent travailler sur des **branches distinctes** et coordonner les zones de code pour éviter les modifications concurrentes. Ne pas fusionner automatiquement les PR empilées ; rebaser/reconcilier avec la base réelle et les tests.
5. Les assets et la spécification sont partagés sur `main`. Une tâche démarrée avant ces commits doit **mettre à jour son contexte Git** ; ne pas supposer qu'une tâche en cours relit automatiquement le dépôt.
6. Les illustrations n'ont aucun texte internationalisé. Les titres, boutons et erreurs restent dans les ressources de traduction.
7. **Ne pas committer les captures Splitwise privées** ni les ZIP transmis directement aux tâches.

## 7. Definition of Done UI

- [ ] Écran de connexion **desktop + mobile** avec illustration de terrasse, sans mascotte ronde, sans texte dans l'illustration.
- [ ] Dashboard et groupes Everyday Pop en desktop/mobile, avec hiérarchie financière claire.
- [ ] Dépenses et statistiques Everyday Pop en desktop/mobile, sans régression fonctionnelle.
- [ ] Tous les composants utilisent les tokens partagés, pas une accumulation de styles locaux.
- [ ] FR/EN/JA et formats monétaires/date corrects ; devise unique par groupe.
- [ ] Tests responsive 320/390/768/1280 px, accessibilité clavier, focus, contraste, loading/empty/error.
- [ ] SVG locaux utilisés sans requête à un service externe ; poids/performance vérifiés.
- [ ] Tests unitaires, intégration et E2E existants toujours verts ; aucune capture personnelle dans Git.
