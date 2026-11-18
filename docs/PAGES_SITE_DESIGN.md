# OurFinance — pages et contenus pour le design V1

Ce document décrit **ce que chaque écran doit montrer et permettre de faire**. Il sert à concevoir les écrans desktop et mobile, leurs états et leurs transitions. Les règles fonctionnelles viennent du [plan V1](PLAN_TECHNIQUE_V1.md) ; les compositions et le thème viennent des [maquettes Everyday Pop](design-references/README.md) et du [guide visuel](DESIGN_EVERYDAY_POP.md). Les montants, noms et reçus montrés dans les maquettes sont fictifs : l'interface affiche les données du groupe courant.

## Navigation et portée

| Destination | Route dans la pile UI en cours | Contenu principal |
| --- | --- | --- |
| Connexion, inscription, récupération | `/login` | Accès au compte et reprise éventuelle d'une invitation. |
| Acceptation d'invitation | `/join` | Vérification puis acceptation explicite d'un lien ou QR. |
| Accueil | `/dashboard` | Vue du groupe actif, soldes, groupes et opérations récentes. |
| Groupes | `/groups` | Liste, création, membres, devise, invitations et catégories. |
| Dépenses | `/expenses` | Recherche, historique, création, édition et détail. |
| Statistiques | `/statistics` | Indicateurs, graphiques, soldes et remboursements. |
| Compte | `/account` | Profil, préférences, activité, import, export et restauration. |

`/` mène à l'accueil et une adresse inconnue revient à l'accueil dans la pile UI en cours. Après connexion, la navigation principale reste présente **même si aucun groupe n'existe** : barre latérale sur ordinateur, barre basse à cinq destinations et bouton central `+` sur mobile. Le design doit prévoir un groupe personnel à un membre, un groupe partagé et plusieurs groupes de devises différentes. Une seule devise est active **dans chaque groupe** ; aucun total ne mélange les devises de groupes distincts.

Les pages publiques n'affichent ni navigation privée ni données de groupe. Les invitations, reçus, dépenses, soldes, statistiques et sauvegardes exigent les droits du membre actif. Une révocation fait disparaître l'accès aux données protégées.

## Pages publiques

### 1. Connexion, inscription et récupération — `/login`

- **En-tête et ambiance :** marque OurFinance, illustration de café, titre de bienvenue et courte promesse. Desktop en deux zones ; mobile avec illustration au-dessus d'un formulaire immédiatement accessible. Référence prioritaire : [connexion mobile V2](design-references/everyday-pop-v2-login-mobile.webp) et [connexion desktop](design-references/connexion-desktop.webp).
- **Connexion :** courriel, mot de passe avec afficher/masquer, lien « Mot de passe oublié », action principale, connexion Google et lien vers l'inscription. Garder la place pour la validation près du champ concerné et un message général sans masquer la saisie.
- **Inscription :** création du compte, explication de la vérification du courriel, confirmation et possibilité de revenir à la connexion. **Récupération :** saisie du courriel, envoi, confirmation et retour à la connexion. Ces modes peuvent partager la même route et la même structure visuelle.
- **États :** formulaire vide, focus clavier, champ invalide, envoi en cours, erreur de service, courriel non vérifié, hors ligne et session en cours de restauration. Une session déjà authentifiée ne doit pas montrer brièvement le formulaire lors d'un rafraîchissement.
- **Invitation en attente :** si l'utilisateur arrive par un lien d'invitation, conserver son intention pendant connexion, inscription ou récupération, puis reprendre la page d'acceptation.

### 2. Rejoindre un groupe — `/join`

- **Avant connexion :** message d'invitation reçue, illustration discrète et action pour se connecter ou s'inscrire ; aucune donnée privée du groupe n'est affichée.
- **Après connexion et vérification du courriel :** nom du groupe et sa devise, identité du compte qui accepte, portée limitée de l'invitation, expiration et actions « Rejoindre » / « Pas maintenant ». Un QR représente le même lien sécurisé ; il n'authentifie personne à lui seul.
- **Résultats :** succès menant au groupe, mauvais compte pour une invitation ciblée, invitation expirée, révoquée, déjà utilisée ou groupe indisponible. Chaque état explique la prochaine action sans exposer le jeton d'invitation.
- **Référence :** [parcours d'invitation QR](INVITATIONS_QR.md). Le QR affiché par le propriétaire appartient au parcours Groupes décrit plus bas.

## Pages connectées

### 3. Accueil — `/dashboard`

- **En-tête :** salutation, recherche de dépense menant à l'historique filtré, accès au profil et au menu des préférences/déconnexion. L'icône de notifications n'est pas requise.
- **Bandeau principal :** illustration actuelle des personnages et tables de café à gauche ; groupe actif, membres, solde personnel dans ce groupe, dépenses et remboursements à droite. Les avatars affichent une image ou des initiales ; au survol et au focus, indiquer le nom et les dettes en cours. La zone financière garde des nuages violets illustrés et lisibles. Références : [desktop V2](design-references/everyday-pop-v2-dashboard-desktop.webp) et [mobile V2](design-references/everyday-pop-v2-dashboard-mobile.webp).
- **Actions :** ajouter une dépense, inviter des membres par QR/lien et équilibrer les comptes. Sur mobile, les raccourcis sont compacts et la navigation basse donne accès à `+`.
- **Contenu :** cartes des groupes (nom, icône, nombre de membres, devise, solde), dernières dépenses, « Qui doit quoi ? » et répartition des dépenses par catégorie. Une carte ou un lien ouvre la page complète correspondante. Les chiffres restent exacts et spécifiques au groupe sélectionné.
- **Sans groupe :** illustration et message de bienvenue, action « Créer mon premier groupe », navigation conservée ; **aucun montant ou membre fictif**. Prévoir aussi chargement, aucune dépense, solde nul, erreur de lecture et nom de groupe long.

### 4. Groupes — `/groups`

- **Vue d'ensemble :** liste des groupes accessibles avec nom, illustration/icône, nombre de membres, devise unique et solde du membre ; sélection du groupe actif. Un groupe personnel à un membre est valide. Prévoir zéro groupe et liste longue.
- **Création :** nom du groupe et choix obligatoire de devise ISO 4217, sans répartition imposée. Le propriétaire peut changer la devise **avant la première transaction seulement** ; après, elle est verrouillée. L'interface doit expliquer cette limite au moment utile.
- **Zone du groupe sélectionné :** membres actifs, rôles, solde, accès aux dépenses et aux remboursements. Le propriétaire peut inviter et révoquer selon les droits du groupe ; un membre révoqué ne voit plus le groupe protégé.
- **Catégories :** catalogue système commun à tous les groupes, non modifiable ; catégories personnalisées propres au groupe, avec nom, icône et couleur. Tous les membres actifs peuvent créer, modifier, archiver et réactiver ces dernières. Une catégorie archivée reste visible dans l'historique mais n'est plus proposée pour une nouvelle dépense.
- **Invitation :** une action « Inviter des membres » ouvre une modale ou un panneau mobile avec QR contrasté, lien à copier/partager, type ouvert ou ciblé, expiration et historique/révocation pour le propriétaire. Une invitation est à usage unique. Ne pas ajouter un second CTA QR redondant.
- **Référence :** [groupes desktop](design-references/groupes-dashboard-desktop.webp), [groupes mobile](design-references/groupes-dashboard-mobile.webp) et [spécification QR](INVITATIONS_QR.md).

### 5. Dépenses et historique — `/expenses`

- **Contexte :** groupe actif, devise fixe, action d'ajout. L'historique affiche date, description, catégorie illustrée, montant, payeur et groupe ; les lignes ouvrent le détail. La recherche par description est immédiatement visible et peut recevoir un terme transmis depuis l'accueil (`/expenses?search=...`).
- **Filtres :** période, catégorie et participant. Afficher clairement les filtres actifs, l'absence de résultat et le chargement d'une autre page. Les résultats et catégories ne mélangent pas deux groupes.
- **Desktop :** historique et formulaire d'ajout côte à côte lorsque la largeur le permet. **Mobile :** historique d'abord ; le bouton `+` ouvre la création dans une vue dédiée ou un panneau couvrant l'écran, avec retour évident à la liste. Références : [dépenses desktop](design-references/depenses-desktop.webp), [dépenses mobile](design-references/depenses-mobile.webp).
- **États :** aucune dépense, recherche sans correspondance, date invalide, chargement/pagination, accès refusé et erreur réseau. Une suppression logique ne doit pas être présentée comme une dépense active.

### 6. Créer ou modifier une dépense — dans `/expenses`

- **Champs :** groupe, description, montant dans la devise du groupe, date, catégorie avec icône/couleur, payeur ou plusieurs payeurs, participants et reçu privé facultatif. Le groupe et la devise doivent rester explicites pendant la saisie ; aucune conversion silencieuse.
- **Répartition :** cinq modes — égalitaire, montants exacts, pourcentages, parts, ajustements. Montrer les personnes incluses, leurs montants et le total restant ou l'erreur de somme. Un aperçu avant enregistrement explique qui paie et qui doit. La dernière répartition **du même utilisateur dans le même groupe** est proposée ; elle reste modifiable et n'altère pas l'historique.
- **Actions :** enregistrer, annuler, et, en édition, supprimer selon les droits applicables. Les erreurs indiquent le champ concerné, conservent la saisie et déplacent le focus de manière prévisible. Après succès, revenir à l'historique actualisé.
- **Reçu :** sélection et aperçu, état d'envoi, accès privé pour les membres actifs, suppression et message de reprise si un nettoyage distant reste en attente. Ne jamais afficher une URL non signée comme lien public.

### 7. Détail d'une dépense — panneau de `/expenses`

Le détail montre la description, la date, le montant, la catégorie, les payeurs, les parts de chaque participant et le calcul du solde. Il regroupe les commentaires, les reçus privés et les modifications pertinentes ; les actions d'édition/suppression apparaissent uniquement si autorisées. Le design prévoit les états sans commentaire, sans reçu, reçu en chargement, accès révoqué et opération supprimée. Une route dédiée n'est **pas encore définie** dans la pile UI : concevoir ce contenu comme un panneau ou écran mobile accessible depuis l'historique, sans inventer d'URL.

### 8. Statistiques, soldes et remboursements — `/statistics`

- **Contexte :** un seul groupe et sa devise, période courante et contrôle de sélection. Aucun graphique ou total ne combine des groupes de devises différentes.
- **Indicateurs :** dépenses de la période, payé par membre, part attribuée à chaque membre, écart de paiement, soldes après remboursements. Distinguer ces notions dans les libellés.
- **Graphiques :** anneau des catégories avec montant total au centre, comparaison payé/attribué par membre et évolution temporelle ; légendes et montants lisibles sur mobile. Prévoir zéro transaction, catégorie archivée encore présente dans l'historique et montants à précision fractionnaire importés.
- **Période :** un seul champ déroulant. Son panneau contient les onglets **Jours / Mois / Années**, sélection début/fin inclusive, puis « Annuler » et « Appliquer ». Les graphiques ne changent qu'après confirmation.
- **Comptes à équilibrer :** liste de qui doit quoi, création d'un remboursement partiel ou complet et historique des remboursements. Le formulaire indique émetteur, destinataire, montant et date ; le solde se met à jour après enregistrement.
- **Référence :** [statistiques desktop](design-references/statistiques-desktop.webp) et [statistiques mobile](design-references/statistiques-mobile.webp).

### 9. Profil et données du compte — `/account`

- **Profil :** nom affiché, courriel et statut de vérification, langue FR/EN/JA, fuseau horaire, association Google lorsqu'elle est admissible, enregistrement des préférences et déconnexion. Le changement de langue est immédiat et reste mémorisé.
- **Activité :** journal par groupe des ajouts, modifications, suppressions, commentaires et remboursements, avec auteur et date ; prévoir état vide et pagination. Cette section vit actuellement dans Compte. Une page autonome « Activité » ou « Amis » figure dans le plan fonctionnel, mais **aucune route dédiée n'est définie** : ne pas la traiter comme un écran déjà livré.
- **Gestion des données :** accès à l'import, à l'export et à la restauration décrits ci-dessous. Les actions destructrices doivent montrer le groupe concerné et demander une confirmation explicite.

### 10. Import, export et restauration — sections de `/account`

- **Import CSV :** choisir un groupe cible et un fichier synthétique ou personnel gardé dans le navigateur, associer explicitement colonnes et participants, prévisualiser lignes, doublons, erreurs, devise et impacts. Présenter le rapprochement des soldes avant confirmation ; permettre l'annulation d'un lot importé. Une devise incompatible n'est pas convertie. Conserver exactement les fractions historiques prises en charge par le format d'import.
- **Export :** choisir groupe et format. Distinguer un CSV/JSON de consultation d'une **sauvegarde restaurable**. La sauvegarde V2 inclut manifeste, données et octets des reçus privés ; un JSON de métadonnées seul ne restaure pas les médias ni les comptes de connexion.
- **Restauration :** choisir une archive, voir un aperçu du groupe d'origine, des opérations, préférences et reçus, puis confirmer. Montrer progression, conflit, annulation avant application et état de reprise si le nettoyage reste en attente. Ne jamais présenter une restauration incertaine comme terminée.
- **Organisation :** ces fonctions sont aujourd'hui des panneaux de Compte. Si le design leur réserve des pages distinctes, leurs routes devront être décidées avant implémentation ; aucune URL séparée n'est spécifiée ici.

## Catalogue de composants et écrans transversaux

- **Catalogue interne `/ui/components` :** galerie de fondations, champs et contrôles, navigation, listes, cartes, graphiques, modales, alertes et états. Une colonne de catégories donne accès à chaque famille. Il sert au contrôle du thème, pas à un parcours financier public ; la PR qui le prépare reste en brouillon. Référence : [guide du catalogue](ui-kit/README.md).
- **États transversaux à dessiner pour chaque page :** chargement, vide, succès, erreur récupérable, accès refusé, session expirée, hors ligne, focus clavier et contenu long en FR/EN/JA. Les contrôles restent utilisables à 320, 390, 768 et 1280 px. Les modales et panneaux ont une fermeture, un retour et un focus explicites.
- **Notifications :** aucune page ou cloche de notifications n'est exigée pour V1. Les confirmations importantes apparaissent près de l'action concernée.

## État de l'implémentation à ne pas confondre avec le design cible

Sur `main` au moment de cette rédaction, l'application conserve encore plusieurs fonctions dans une vue unique. Les routes séparées du tableau sont préparées dans les PR UI ouvertes, sans validation visuelle finale ni publication du client intégré sur le site TEST principal. Le détail de groupe, le détail de dépense, les vues Amis/Activité et les parcours d'import/export/restauration n'ont pas tous une route propre. Ce document **décrit la cible de contenu V1** et signale explicitement ces choix de navigation encore ouverts ; il ne certifie pas que chaque écran est livré.
