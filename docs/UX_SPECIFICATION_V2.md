# OurFinance — Spécification UX V2

Statut : orientations validées ; conception détaillée et maquettes à valider par PR.
Direction artistique : Everyday Pop V2. Desktop, tablette et mobile conçus simultanément. FR/EN/JA.
Périmètre : sept PR, sans régression fonctionnelle.

## 1. Objectifs
Enregistrer rapidement une dépense, comprendre sa situation financière et qui doit quoi, retrouver une opération, changer de groupe sans confusion, comprendre les conséquences avant confirmation. La complexité financière ne doit pas devenir une complexité d'interface.

## 2. Contrat UX transversal
- Simplicité progressive : actions fréquentes visibles, options avancées accessibles, pas de formulaires inutilement longs ni de CTA redondants.
- Desktop : navigation latérale, grille et panneaux complémentaires, clavier. Mobile : hiérarchie verticale, navigation basse, actions accessibles au pouce, écrans dédiés pour les formulaires complexes. Même composants, services et données ; compositions adaptées simultanément.
- Groupe actif global : nom, icône, devise, sélection synchronisée et mémorisée, permissions vérifiées. Protéger les brouillons lors d'un changement de groupe. Aucun total multidevise. Navigation disponible même sans groupe.
- Retours : chargement, succès, erreur récupérable, accès refusé, hors ligne, session expirée. Empêcher les doubles soumissions, conserver la saisie après erreur, expliquer les conséquences des actions destructrices.
- Clarté financière : distinguer total, payé, part attribuée, écart de paiement, solde net, dette et remboursement. Devise explicite ; jamais la couleur seule. Calculs issus des services métier.
- WCAG 2.2 AA applicable : clavier, focus visible, contraste, labels, lecteur d'écran, cibles tactiles 44 px, réduction des animations, restauration du focus des dialogues.
- Préserver groupe, recherche, filtres, période, position de scroll et élément consulté au retour d'une liste.

## 3. PR 1 — Navigation, Dashboard et onboarding
Route : /dashboard.
### Navigation
Desktop : sidebar Accueil, Groupes, Dépenses, Statistiques ; compte dans l'avatar en haut à droite. Mobile : cinq emplacements Accueil, Groupes, Ajouter (+), Dépenses, Statistiques. Le + est une action ouvrant la création dans le groupe actif ; sans groupe, orienter vers la création du premier groupe. En-tête : titre, sélecteur global, recherche de dépenses selon contexte, avatar. Éviter les sélecteurs redondants. Équilibrage accessible depuis les soldes et raccourcis. Conserver le décor de sidebar sans masquer le menu.
### Dashboard
Priorité : groupe/devise, solde actuel après remboursements, actions rapides, indicateurs, dettes/créances, dépenses récentes, catégories, autres groupes.
Solde explicite : « On te doit », « Tu dois », « Tes comptes sont équilibrés ». Indépendant de la période statistique. Groupe personnel : privilégier dépenses personnelles.
Indicateurs : dépenses du groupe ce mois-ci, ma part, montant payé personnellement et autres indicateurs existants pertinents ; période explicite.
Trois actions Everyday Pop : Ajouter une dépense, Inviter des membres (QR/lien), Équilibrer les comptes (sans créer automatiquement de remboursement). Respecter les droits.
Dernières dépenses : sélection limitée, détail accessible, lien historique complet.
Desktop : grille avec panneaux complémentaires. Mobile : solde et actions en premier, graphiques secondaires. Conserver les personnages et tables approuvés ; illustration non bloquante.
### Onboarding
Créer mon premier groupe, rejoindre un groupe ou importer mes dépenses (groupe cible explicite). Pas de tutoriel imposé. Après création, suggérer première dépense ou invitation, sans bloquer.
### Acceptation
Navigation cohérente, groupe synchronisé, ajout global, compte via avatar, zéro groupe/personnel/partagé, données réelles uniquement, solde clair, aucun mélange de devises.

## 4. PR 2 — Connexion et invitation reçue
Routes : /login, /join.
Connexion : courriel, mot de passe affichable, Google, récupération, inscription. Erreurs près des champs ; aucun flash du formulaire pendant restauration de session.
Inscription : champs nécessaires, vérification du courriel, renvoi selon contraintes, retour sans perdre l'invitation.
Récupération : courriel, envoi, instructions, retour ; ne pas révéler inutilement l'existence du compte.
Invitation : avant auth, informations publiques uniquement ; après auth et vérification, groupe, devise, compte acceptant, expiration, Rejoindre/Pas maintenant. Préserver l'intention pendant tous les modes d'authentification. Après acceptation sélectionner le groupe et ouvrir son aperçu.
États : expirée, révoquée, utilisée, mauvais compte, groupe indisponible, courriel non vérifié, réseau ; prochaine action explicite.
Desktop : deux zones illustration/formulaire. Mobile : illustration compacte et formulaire accessible. Aucun texte localisé dans les images.
Acceptation : tous les modes fonctionnels, intention conservée, confidentialité, clavier et focus.

## 5. PR 3 — Groupes
Route : /groups. Séparer liste et détail.
Liste : nom, icône, membres, devise, solde personnel, groupe actif ; recherche si nécessaire, création accessible. Ouvrir un groupe le sélectionne.
Création : nom et devise obligatoires ; expliquer verrouillage après première transaction ; aucune répartition imposée.
Détail en quatre sections :
- Aperçu : informations, membres, solde, dettes, accès dépenses et remboursements.
- Membres : membres actifs, rôles, invitations, historique et gestion des accès selon droits.
- Catégories : système non modifiable ; personnalisées créables, modifiables, archivables et réactivables selon droits ; archives visibles dans historique.
- Paramètres : devise et verrouillage, opérations autorisées, actions destructrices séparées.
Invitation : un CTA, QR ouvert/ciblé, copie, partage, expiration, révocation et usage unique selon contrat existant.
Desktop : liste et panneau détail, onglets. Mobile : liste puis détail, retour explicite, onglets sans débordement.
Acceptation : séparation consultation/configuration, groupe personnel, devise, droits, QR lisible, historique préservé.

## 6. PR 4 — Dépenses
Route : /expenses.
Historique : chronologie décroissante par date, catégorie, description, montant total, payeur(s), information personnelle pertinente ; total journalier si exact. Ligne ouvre détail.
Recherche visible ; filtres période, catégorie, participant ; chips actifs, réinitialisation, distinction vide/sans résultat, pagination ; préserver recherche, filtres et scroll au retour.
Création rapide : groupe/devise, montant, description, catégorie, payeur, résumé de répartition, Enregistrer. Date du jour visible et modifiable, utilisateur courant payeur, dernière répartition valide du même utilisateur/groupe explicitement affichée.
Options avancées accessibles : plusieurs payeurs, participants, répartition, reçu, autres champs existants.
Cinq modes : égalitaire, montants exacts, pourcentages, parts, ajustements. Inclusion/exclusion, valeur et montant par participant, restant et erreurs de somme. Aperçu avant confirmation : pour 100 CAD payés par moi et répartis 60/40, Alex me doit 40 CAD pour cette dépense. Utiliser les services métier pour payeurs multiples, arrondis et fractions historiques.
Succès : confirmer, actualiser, revenir au contexte d'origine ou historique. Erreur : conserver saisie, focus approprié, nouvelle tentative sans doublon. Protéger brouillon à la fermeture.
Détail : description/catégorie/date/montant, groupe/devise, payeurs, répartition, conséquence de cette dépense distincte du solde global, reçus, commentaires, modifications. Édition/suppression selon droits.
Reçus : sélection, capture photo si navigateur compatible, aperçu, progression, accès privé, retrait et reprise ; aucune URL publique non autorisée.
Desktop : historique et panneau formulaire/détail simultanés si possible. Mobile : écran dédié création/édition, enregistrement accessible, retour restaurant la liste.
Acceptation : objectif indicatif 15 secondes pour dépense simple après familiarisation ; cinq modes et payeurs multiples préservés, calculs inchangés, saisie et filtres conservés, reçus privés.

## 7. PR 5 — Statistiques
Route : /statistics.
Contexte : groupe, devise, période ; mois courant proposé par défaut, conserver préférence pendant navigation.
Sélecteur générique : Jours/Mois/Années, début/fin inclusifs, Annuler/Appliquer ; actualisation uniquement après confirmation. Granularité graphique indépendante.
Indicateurs : total du groupe, ma part, payé personnellement ; autres indicateurs existants en complément, période et sens explicites.
Anneau : total central, catégories, montants, pourcentages, légende ; accès proposé à l'historique filtré par catégorie/période.
Évolution : granularité adaptée à la durée, éviter comparaisons trompeuses de périodes partielles.
Comparaison membres : payé vs attribué ; écart différent du solde après remboursements.
Accès à Équilibrer les comptes ; si solde actuel affiché, préciser indépendance de la période.
Desktop : grille ; mobile : graphiques empilés, légendes lisibles, aucune donnée essentielle au survol uniquement.
Acceptation : cohérence chiffres/période, catégories archivées, zéro données, aucun total multidevise, distinction soldes/statistiques.

## 8. PR 6 — Équilibrer les comptes
Route proposée : /balances (à confirmer techniquement).
Points d'entrée : Dashboard, groupe, statistiques ; même parcours et composants.
Situation : groupe/devise, solde personnel, dettes/créances, montants restants, membres ; phrases explicites « Alex doit 185,50 CAD à Sam ». Pas de dette artificielle pour groupe personnel.
Remboursement : émetteur, destinataire, montant, date, solde concerné, aperçu impact. Proposer montant restant si pertinent ; partiel/complet selon règles. Libellé « Enregistrer un remboursement » : aucun transfert bancaire.
Confirmation : qui a payé/reçu, montant et impact ; actualiser soldes et historique après succès.
Historique : date, émetteur, destinataire, montant, informations disponibles ; droits existants.
Desktop : panneaux soldes/historique ; mobile : liste puis formulaire dédié.
Acceptation : sens dette clair, partiel/complet, aucune création automatique, aucune simulation de transfert réel, soldes et historique cohérents.

## 9. PR 7 — Compte et données
Route : /account ; routes des sous-pages à décider avant implémentation.
Menu : Profil (nom, courriel, vérification), Préférences (langue, fuseau, autres existantes), Sécurité (méthodes, association Google admissible, déconnexion), Activité (groupe, auteur, date, type, pagination), Données (import, export, sauvegarde, restauration).
Desktop : menu et panneau ; mobile : liste puis écran dédié avec retour.
Import CSV guidé : fichier/groupe cible, association colonnes, association participants, erreurs/doublons/devise, prévisualisation et rapprochement des soldes, confirmation, rapport final et annulation du lot prévue. Aucune conversion silencieuse ; préserver fractions historiques.
Export : groupe, format, options supportées ; distinguer consultation CSV/JSON et sauvegarde restaurable.
Restauration guidée : archive, validation format, aperçu groupe/données/reçus, conflits, conséquences, confirmation, progression, résultat ; annulation avant application et reprise selon contrat. ZIP V2 inclut données et octets privés prévus ; ne pas présenter un résultat incertain comme terminé.
Acceptation : sections séparées, langue immédiate et mémorisée, activité, import prévisualisé, export distinct de sauvegarde, restauration confirmée, confidentialité et droits.

## 10. Everyday Pop
Conserver palette, Nunito Sans, Lucide, arrondis, ombres douces, illustrations chaleureuses et découpes organiques. Illustrations plus présentes sur connexion et Dashboard, jamais au détriment des données/formulaires.
Réutiliser composants Angular génériques ; avant création vérifier bibliothèque et galerie. Nouvelle primitive indépendante du métier, variantes/états documentés, démonstration et tests. Pas de duplication par page.
Si une décision UX remplace une composition approuvée, produire et faire valider les nouvelles maquettes desktop/mobile, mettre à jour les références et marquer les anciennes comme remplacées. Ne pas imposer deux compositions contradictoires.

## 11. Processus obligatoire par PR
1. Analyse : lire documentation fonctionnelle, UX, thème, code actuel et bibliothèque ; inventorier fonctionnalités et états à préserver.
2. UX : wireframes desktop/mobile simultanés, hiérarchie, actions, parcours, états, responsive ; validation avant implémentation.
3. UI : appliquer Everyday Pop, maquettes desktop/mobile, validation.
4. Code : actualiser depuis main, réutiliser primitives, préserver services et permissions, traductions FR/EN/JA, tests.
5. Vérification : typecheck, lint, unitaires, intégration pertinente, build, E2E, CI au HEAD.
6. Validation visuelle : Playwright 1280×800 et 390×844, contrôles 320 et 768 px, trois langues, données fictives ; référence approuvée à gauche, capture réelle à droite, écarts documentés.
7. Fusion : validation UX/UI, review technique, corrections, CI verte et validation visuelle explicite. Production distincte.

## 12. Dépendances et ordre
| PR | Périmètre | Dépendances |
|---|---|---|
| 1 | Navigation, Dashboard, onboarding | Fondations existantes |
| 2 | Connexion et invitation reçue | Conventions communes |
| 3 | Groupes et invitations émises | PR 1 |
| 4 | Dépenses | PR 1, composants groupe nécessaires |
| 5 | Statistiques | PR 1, conventions filtres |
| 6 | Équilibrer les comptes | PR 1, services financiers |
| 7 | Compte et données | PR 1 |

Préparation parallèle possible sans chevauchement ; coordonner composants partagés, vérifier PR ouverts et HEAD avant modification. Les liens vers les parcours non refondus restent fonctionnels pendant transition. Sept PR de refonte, pas sept PR UX plus sept UI.

## 13. Definition of Done globale
Sept PR validés et fusionnés ; fonctionnalités et calculs préservés ; parcours simplifiés ; groupe synchronisé ; desktop/mobile cohérents ; identité Everyday Pop ; composants génériques ; FR/EN/JA ; confidentialité et permissions ; CI verte ; références mises à jour ; parcours intégrés vérifiés sur TEST. Production distincte.

## 14. Références et décisions
- [Périmètre fonctionnel](PAGES_SITE_DESIGN.md)
- [Direction artistique](DESIGN_EVERYDAY_POP.md)
- [UI Kit](ui-kit/README.md)
- [Bibliothèque](COMPONENT_LIBRARY.md)
- [Matrice d'intégration](UI_PAGE_COMPLETION_MATRIX.md)
- [Maquettes](design-references/)
- [Plan technique](PLAN_TECHNIQUE_V1.md)
- [Invitations](INVITATIONS_QR.md)

Préserver règles métier et sécurité en cas de contradiction ; identifier le conflit et faire valider avant implémentation. Les orientations générales sont validées ; la route /balances, le mois initial, la cible de 15 secondes et le drill-down catégorie sont des propositions détaillées à confirmer lors de la conception. Cette spécification est fondée sur la documentation, pas sur un audit live de l'application.
