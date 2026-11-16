# OurFinance — Plan technique V1

Statut : **plan de réalisation**, sans implémentation applicative à ce stade.  
Dernière mise à jour : 16 novembre 2026.  
Dépôt : `ranouf/OurFinance`.

## 1. Objectifs et principes

OurFinance est une application de suivi et de partage de dépenses, accessible sur ordinateur et installable sur téléphone comme **PWA**. Elle doit prendre en charge des groupes indépendants, des utilisateurs individuels ou multiples, toutes les devises monétaires ISO 4217, plusieurs méthodes de répartition et les données historiques importées depuis Splitwise.

### Exigences non négociables

- Aucune limitation quotidienne artificielle du nombre de dépenses dans OurFinance. Les quotas techniques des fournisseurs gratuits restent applicables.
- Chaque utilisateur peut créer plusieurs **groupes** et y inviter d'autres comptes, sans notion obligatoire de foyer/couple.
- Chaque groupe possède ses membres, **une seule devise ISO 4217 obligatoire et stricte**, ses catégories/dépenses, ses remboursements et ses permissions. Aucune conversion ni dépense dans une autre devise au sein du groupe.
- Un groupe peut n'avoir **qu'un seul membre** (suivi des frais personnels ou d'un immeuble).
- Aucun partage 60/40, 50/50 ou autre n'est défini automatiquement à la création d'un groupe.
- La **dernière répartition utilisée par un utilisateur dans un groupe** est sauvegardée après validation d'une dépense et proposée lors de sa prochaine dépense dans ce même groupe. Chaque utilisateur conserve sa préférence distincte.
- La répartition reste modifiable à chaque dépense : égalitaire, montants exacts, pourcentages, parts ou ajustements. Modifier la préférence ne change pas l'historique.
- Authentification Google ou email/mot de passe, vérification d'email, récupération du mot de passe.
- Statistiques interactives par groupe : plage personnalisée **Jours / Mois / Années** dans un seul sélecteur déroulant, graphiques par catégorie, comparaison des paiements et parts dues par membre, évolution temporelle, écarts et soldes.
- Historique, recherche, catalogue de catégories illustrées, catégories personnalisées collaboratives, reçus, remboursements, import/export.
- Application disponible **en français, anglais et japonais dès la V1** : langue initiale selon le navigateur, changement immédiat dans les paramètres, préférence sauvegardée.
- Code Angular moderne, composants réutilisables dans `shared`, Tailwind et CSS personnalisé minimal ; **design system cohérent et UX soignée** sur mobile et ordinateur.
- Déploiement automatisé à partir de GitHub, environnements isolés et contrôle de sécurité sur PR.

### Exemples de groupes, non codés en dur

| Groupe | Devise unique | Membres possibles | Usage |
|---|---|---|---|
| Duplex | CAD | Une personne | Dépenses personnelles d'immeuble |
| Canada | CAD | Deux personnes | Dépenses quotidiennes |
| France | EUR | Trois personnes ou plus | Voyage et famille |
| Voyage Japon 2025 | JPY | Deux personnes | Voyage au Japon |

Les membres et pourcentages des exemples n'imposent aucune règle globale. **La devise choisie est obligatoire pour toutes les transactions du groupe**, sans exception ni conversion. Des groupes différents peuvent utiliser des devises différentes.

## 2. Architecture cible et arbitrages

| Couche | Choix V1 | Raison |
|---|---|---|
| Frontend | Angular (dernière version stable compatible), TypeScript, standalone, Signals | Préférence du projet ; maintenabilité |
| UI / UX | Tailwind CSS 4, Lucide, design system et bibliothèque de graphiques à sélectionner (ECharts ou Chart.js après POC Angular) | Interface originale, accessible, responsive et cohérente |
| PWA | `@angular/pwa`, manifeste, service worker | Installation Android/iOS et cache applicatif |
| Internationalisation | Transloco (ou équivalent validé en M1), `Intl` | FR/EN/JA, changement à chaud, formats locaux |
| Hébergement statique | **Firebase Hosting (Spark)** | HTTPS, domaine gratuit fourni, intégration GitHub et previews PR |
| Auth | **Firebase Authentication** | Google, email/mot de passe, vérification et récupération natives |
| Données | **Cloud Firestore (Spark)** | Données synchronisées, transactions atomiques, quota gratuit sans pause d'inactivité comparable à Supabase |
| Sécurité métier | **Firestore Security Rules** + validations financières | Isolation stricte par groupes et contrôle des écritures |
| Justificatifs | **Cloudinary Free, assets `authenticated`** | Fichiers privés, optimisation d'images et 25 crédits partagés |
| Passerelle fichiers | **Cloudflare Worker (offre Free)** | Vérification Firebase, appartenance au groupe et signatures Cloudinary tenues secrètes |
| CI/CD | **GitHub Actions + Firebase Hosting/CLI** | Validation de PR, publication de l'app, des règles et des index |
| Extension d'import | Chrome Manifest V3, TypeScript | Export initié par l'utilisateur sur Splitwise Web |

**Décision : Firebase + Cloudinary Free, sans carte bancaire pour ces offres.** Supabase a été écarté de la V1 en raison de la pause automatique potentielle quand l'application reste inutilisée deux à trois semaines. Cloudflare R2 reste une alternative future (10 Go inclus mais activation de facturation et moyen de paiement requis). Le modèle Firestore exige davantage de travail que PostgreSQL pour les agrégats financiers et la validation des répartitions ; cette complexité est explicitement prise en charge dans le modèle, les règles et les tests.

### Gratuité, limites et sauvegardes

- Firestore Spark (quota indicatif actuel) : **1 Gio stocké, 50 000 lectures/jour, 20 000 écritures/jour, 20 000 suppressions/jour et 10 Gio de trafic sortant/mois** ; une seule base bénéficiant du quota gratuit par projet.
- Firebase Hosting Spark : hébergement statique/PWA sous quotas ; site sur sous-domaine `web.app` / `firebaseapp.com`, domaine `carnould.com` facultatif via DNS BookMyName.
- Cloudinary Free : **25 crédits partagés** ; 1 crédit = 1 Go stocké **ou** 1 Go de bande passante d'images **ou** 1 000 transformations. Les 25 Go annoncés sont un **maximum théorique de stockage** si aucun crédit n'est consommé autrement. Stockage mesuré au volume actuellement conservé ; bande passante et transformations sur 30 jours glissants.
- Cloudflare Worker Free : quotas d'appels et de temps CPU ; ne pas présumer de capacité illimitée ni d'absence de quotas. À valider avec un prototype de signatures et d'accès privé.
- Aucun quota fournisseur ne garantit un nombre illimité de dépenses. L'application n'applique **aucune limite métier par jour**, mais elle affiche une erreur explicite si un quota fournisseur est atteint.
- Firestore Spark ne fournit pas les sauvegardes managées/restaurations avancées sans facturation. Prévoir export JSON/CSV périodique, sauvegarde des pièces jointes Cloudinary hors service, tests de restauration et plan de sortie des fournisseurs.
- Cloudinary ne doit contenir **aucun justificatif public** ; vérifier avant la production que les fonctions de confidentialité requises sont accessibles dans l'offre Free.

## 3. Conséquences du choix Firebase

### Avantages retenus

- Pas de mécanisme d'arrêt pour faible activité comme celui de Supabase Free : l'application peut rester sans dépense pendant plusieurs semaines.
- Firebase Authentication gère nativement les emails de confirmation et de récupération de mot de passe ; **pas de SMTP Gmail, Resend ou Brevo nécessaire en V1** pour ces messages.
- Firestore permet la synchronisation quasi temps réel entre les participants d'un groupe et un cache local raisonnable pour la PWA.
- Firebase Hosting publie une application Angular statique depuis GitHub et offre des URLs de prévisualisation pour les PR.

### Limites à concevoir dès le départ

- Firestore est une base **documentaire** : aucune jointure SQL ni agrégation relationnelle native équivalente à PostgreSQL. Prévoir des vues calculées et, si nécessaire, des documents de statistiques/soldes matérialisés, régénérables depuis les dépenses.
- Une dépense regroupe les paiements et les parts dans **un document atomique** ; les mises à jour de plusieurs documents utilisent des transactions Firestore et des règles strictes.
- Les **Security Rules** doivent empêcher la lecture des autres groupes, le changement frauduleux du payeur et les invitations abusives. Pour les écritures financières, privilégier une **route serveur dans le Worker** : elle valide toutes les sommes et appartenances avant d'écrire via une identité de service à permissions minimales ; les règles interdisent alors les écritures directes du client dans ces collections. Ne jamais considérer un résultat navigateur comme fiable.
- Les **Cloud Functions Firebase** et **Cloud Storage for Firebase** nécessitent le plan de facturation Blaze pour l'usage visé : ne pas les employer dans la V1 Spark. Utiliser un Worker gratuit indépendant uniquement pour les opérations serveur indispensables.
- Les comptes utilisateurs et les permissions doivent rester exportables ; éviter de lier tout le métier aux particularités des SDK Firebase.

## 4. Authentification et invitations

### Parcours

- Inscription par Google OAuth ou email/mot de passe via Firebase Auth.
- Vérification de l'adresse email, connexion, déconnexion et renouvellement de session via SDK Firebase.
- Mot de passe oublié : email et écran de réinitialisation fournis par Firebase Auth, avec quotas du plan Spark (actuellement 150 emails de réinitialisation/jour).
- Association explicite et sécurisée de plusieurs fournisseurs d'identité à un compte ; ne pas fusionner automatiquement deux comptes seulement parce qu'ils affichent le même email.
- Profil : nom d'affichage, avatar, langue préférée (`fr`/`en`/`ja` ou détection navigateur), préférences et fuseau horaire. La devise est déterminée **par le groupe**, pas par le profil.
- Les utilisateurs sont indépendants de leurs groupes : création, invitation, retrait et changement de groupe actif.

### Invitations de groupe sans service d'envoi d'emails externe

- Générer un **lien d'invitation à usage unique**, expirant et lié à un groupe ; éventuellement limité à une adresse email précise.
- En V1, l'auteur partage ce lien lui-même (copie, messagerie, bouton `mailto:` ou Web Share API). **Ne pas promettre l'envoi automatique d'emails d'invitation** : Firebase Auth n'est pas une plateforme de mails transactionnels arbitraires.
- L'acceptation nécessite une connexion Firebase et une vérification serveur de la validité du jeton, du destinataire éventuel, de son expiration, de l'état du groupe et de l'unicité de l'acceptation.
- Si les Security Rules et transactions Firestore ne permettent pas une acceptation atomique sûre, utiliser une route dédiée du Worker avec autorisation minimale, jamais des secrets d'administration dans Angular.

## 5. Groupes, participants et autorisations

- Un utilisateur crée un groupe avec nom, icône/couleur, **devise ISO 4217 obligatoire et unique** et description facultative. La devise ne peut être modifiée que tant que le groupe n'a enregistré **aucune transaction** (dépense, remboursement ou import), même si ces transactions sont ensuite archivées.
- Il peut inviter des utilisateurs existants ou nouveaux par email/lien à usage unique, avec expiration et vérification de l'identité invitée.
- Rôles par groupe : `owner` et `member` pour la V1, avec possibilité d'étendre les permissions.
- Un utilisateur peut appartenir à plusieurs groupes, chacun dans sa propre devise, et voir ses soldes par groupe ou par relation. Ne jamais additionner des montants provenant de groupes de devises différentes.
- Une personne peut suivre seule son groupe « Duplex » ; le moteur produit des dépenses et statistiques mais aucune dette entre membres.
- Le retrait d'un membre révoque son accès futur, tout en préservant l'intégrité de l'historique comptable. Sa dette historique doit être traitée explicitement avant suppression définitive éventuelle.
- Aucune table `households`, aucune `household_id`, aucune configuration de couple imposée.

### Isolation

Chaque document métier est sous un chemin `groups/{groupId}/...` ou porte un `groupId` vérifié. Les Firestore Security Rules utilisent `request.auth.uid`, `get()`/`exists()` sur la présence du membre actif et des règles de rôle distinctes pour `owner` et `member`. Tester les lectures **et écritures** inter-groupes, les références invalides, les membres révoqués, les invitations frauduleuses et les accès par collection group. Ne jamais considérer le filtrage Angular comme un contrôle de sécurité.

## 6. Modèle documentaire Firestore V1

Le découpage **par groupe** constitue la frontière d'isolation et permet des lectures efficaces de l'historique, tout en gardant les préférences propres à chaque utilisateur.

| Collection / document | Champs principaux / rôle |
|---|---|
| `users/{uid}` | Profil Auth, nom, avatar, `preferredLanguage` (`fr`/`en`/`ja` ou absence = navigateur), fuseau horaire |
| `users/{uid}/groupPreferences/{groupId}` | **Dernier partage réellement enregistré par cet utilisateur dans ce groupe**, et préférences de formulaire |
| `groups/{groupId}` | Créateur, nom, `currencyCode` ISO obligatoire, icône, couleur, état, verrou de devise après première transaction, dates d'audit |
| `groups/{groupId}/members/{uid}` | Rôle, statut, date d'adhésion ; un seul document par membre |
| `groups/{groupId}/invitations/{invitationId}` | Hash/identifiant opaque de jeton, email cible éventuel, expiration, état et usage unique |
| `groups/{groupId}/categories/{categoryId}` | Catégorie personnalisée au groupe : nom, icône Lucide, couleur, `archivedAt`, audit ; catalogue système global distinct et immuable |
| `groups/{groupId}/expenses/{expenseId}` | Description, `amountMinor` **dans la devise du groupe**, catégorie, `expenseDate` (`YYYY-MM-DD`), auteur, payeurs et **allocations embarqués**, instantané du split, audit ; pas de devise indépendante |
| `groups/{groupId}/expenses/{expenseId}/comments/{commentId}` | Auteur, contenu, dates et modération |
| `groups/{groupId}/expenses/{expenseId}/attachments/{attachmentId}` | Cloudinary `publicId` non secret, type `authenticated`, taille, format, propriétaire, statut |
| `groups/{groupId}/settlements/{settlementId}` | Débiteur, créancier, `amountMinor` dans la **devise du groupe**, date ; aucune conversion |
| `groups/{groupId}/activity/{eventId}` | Événements d'audit immuables, acteur, contexte |
| `groups/{groupId}/balances/{balanceId}` | Vue matérialisée **dérivable** des opérations, par personne dans la devise unique du groupe, avec version/source |
| `groups/{groupId}/statistics/{periodId}` | Agrégats mensuels ou périodiques par catégorie et membre (`paidMinor`, `owedMinor`, totaux), dans la devise du groupe ; recalculables et versionnés |
| `users/{uid}/importBatches/{batchId}` | Fichier/source, état, identifiants d'origine et erreurs |

Les identifiants de provenance des transactions importées doivent aussi être indexés pour permettre une détection des doublons **dans un groupe**. Les index Firestore composites sont déclarés dans `firestore.indexes.json`, versionnés avec l'application. Limiter les lectures globales : pagination par curseur, filtres et abonnements seulement aux listes visibles.

### Invariants comptables et cohérence

- Une dépense contient dans **le même document** `payments: [{userId, amountMinor}]` et `allocations: [{userId, amountMinor}]` : leurs sommes sont identiques à `amountMinor` et à chaque autre somme, sans fraction perdue.
- Tous les payeurs et bénéficiaires doivent être membres autorisés à la date appropriée et du **même groupe**. La version persistée de la répartition permet de conserver les faits historiques après une évolution des membres.
- Les montants sont en **unités mineures entières** (jamais en flottants pour le moteur de calcul), bornés à la plage des entiers sûrs JavaScript pour l'enregistrement ; le `SplitEngine` peut utiliser `BigInt` en mémoire. Aucun taux de change n'est enregistré ou calculé en V1.
- Respecter l'exposant ISO de **la devise unique du groupe** (JPY : 0 décimale ; CAD/EUR : 2 ; KWD/BHD : 3) et des arrondis déterministes pour chaque mode. Le Worker et les Security Rules refusent toute mutation qui tenterait de changer la devise d'un groupe ayant eu une transaction.
- Les créations et éditions d'une dépense sont atomiques au niveau de son document. Les mises à jour touchant plusieurs documents (préférence, activité, soldes) utilisent des transactions / écritures groupées **dans une route serveur qui valide tous les invariants**. Le Worker vérifie le jeton Firebase, les permissions et la version du document pour gérer les conflits ; les SDK administrateur et comptes de service contournant les règles Firestore, leurs permissions IAM, leurs clés et leur code sont particulièrement audités.
- Les soldes et statistiques matérialisés ne sont que des **caches reconstruisibles** depuis les dépenses et remboursements. Prévoir versionnement, invalidation, recalcul et tests de concurrence ; ne jamais faire d'un cache la source comptable de vérité.
- Les suppressions sont logiques, auditables et récupérables par un membre autorisé.

Solde individuel **dans la devise du groupe** : `paid - owed + settlements_sent - settlements_received`. Une valeur positive signifie une créance ; négative, une dette. Les statistiques de dépenses utilisent la **date comptable** (`YYYY-MM-DD`) ; les remboursements sont suivis séparément à leur propre date. **La différence entre deux montants payés n'est pas automatiquement le solde à rembourser** : les graphiques distinguent paiement, part attribuée et règlements.

## 7. Édition des dépenses et préférences personnelles

### Formulaire rapide

Description, montant **dans la devise fixe du groupe** (symbole affiché, pas de choix de devise sur la dépense), catégorie illustrée, date, groupe, payeur(s), participants, répartition, note et justificatif facultatif. Navigation mobile inspirée des parcours fournis (bouton d'ajout flottant, sélection rapide, détail puis édition), mais identité visuelle originale.

### Méthodes de partage V1

1. **Égalitaire :** répartir entre les participants sélectionnés.
2. **Pourcentage :** 60/40, 50/50, 25/25/50, etc. ; somme = 100 %.
3. **Montants exacts :** somme des montants attribués = total.
4. **Parts :** poids relatifs (1/1/2 par exemple), avec arrondi contrôlé.
5. **Ajustement :** supplément/retrait explicite pour certains participants puis distribution du reste.

Cas spéciaux : un seul bénéficiaire, un seul payeur, plusieurs payeurs, dépense totalement due par une autre personne, montant prêté, règlement complet ou partiel.

### Sauvegarde de la dernière répartition

La préférence est **personnelle ET limitée au groupe**, clé `(user_id, group_id)` :

- À la première dépense faite par cet utilisateur dans ce groupe : aucune configuration persistée ; l'utilisateur définit ou confirme une méthode et ses participants.
- Après sauvegarde réussie : enregistrer la méthode et les paramètres effectivement utilisés comme préférence pour **ses prochaines dépenses dans ce groupe**.
- À la prochaine création : reprendre cette préférence, visiblement éditable. Changer le groupe recharge la préférence de ce groupe pour cet utilisateur.
- Deux utilisateurs d'un même groupe peuvent conserver des répartitions préférées différentes.
- Une dépense existante garde un **instantané de sa répartition** ; une modification ne change pas les autres transactions.
- Si les membres ont changé ou qu'un paramètre n'est plus valide, demander une nouvelle confirmation plutôt que réutiliser silencieusement une configuration périmée.
- Les préférences du dernier groupe et du dernier payeur peuvent être mémorisées séparément, toujours modifiables. **Aucune préférence de devise par dépense** : la devise dépend exclusivement du groupe.

## 8. Toutes les devises du monde — une seule par groupe

- Proposer à la création du groupe **toutes les devises actives ISO 4217** (code, libellé, symbole, nombre d'unités mineures) depuis un catalogue maintenu ; ne pas coder une union `CAD | EUR | JPY`.
- **Une seule devise obligatoire et stricte par groupe** : toutes les dépenses, répartitions, remboursements, soldes, statistiques et exports de ce groupe utilisent cette devise. Pas de sélecteur de devise au niveau d'une dépense et **aucune conversion**, automatique ou manuelle, en V1.
- La devise est modifiable **uniquement avant la toute première transaction**. Après une dépense, un remboursement ou un import, elle est définitivement verrouillée, même si la transaction est supprimée logiquement.
- Afficher la devise du groupe sur les formulaires, détails, soldes et graphiques ; utiliser `Intl.NumberFormat` selon la langue de l'utilisateur, sans modifier le montant ni la devise.
- Conserver des calculs exacts en unités mineures selon l'exposant ISO (JPY : 0 ; CAD/EUR : 2 ; KWD/BHD : 3). Les montants d'un groupe ne doivent jamais être interprétés avec l'exposant d'un autre groupe.
- Plusieurs groupes peuvent avoir des devises différentes. Les statistiques V1 sont **filtrées par groupe** ; un récapitulatif multi-groupes ne doit jamais additionner des montants de devises différentes. Une vue globale éventuelle regroupe les résultats par devise, sans total fictif.
- **Import Splitwise** : signaler les transactions d'une devise différente de celle du groupe cible ; permettre leur affectation à un groupe distinct de la bonne devise ou les exclure avec rapport d'anomalies. **Aucune conversion silencieuse**, aucune perte de la devise source.

## 9. Catégories illustrées

Catalogue initial de catégories avec logo et couleur, par exemple :

| Catégorie | Icône Lucide indicative |
|---|---|
| Scolarité | `graduation-cap` |
| Épicerie | `shopping-cart` |
| Restaurant | `utensils` |
| Logement / duplex | `house` |
| Transport | `car` |
| Avion / voyage | `plane` |
| Santé | `heart-pulse` |
| Sports et loisirs | `dumbbell` |
| Internet / télécom | `wifi` |
| Cadeaux | `gift` |
| Autres | `receipt` |

Le formulaire propose une icône lors du choix d'une catégorie, affiche l'icône sur l'historique et le détail, et permet de créer des catégories personnalisées (nom, icône de la liste autorisée, couleur). Le code d'icône, et non du HTML arbitraire, est stocké en base.

- **Catalogue système global**, disponible dans tous les groupes sans duplication de documents ; catégories système non modifiables et non supprimables par les utilisateurs, libellés traduits en FR/EN/JA.
- **Catégories personnalisées propres à un groupe** : tous les membres **actifs** peuvent les créer, modifier et archiver ; les autres groupes n'y ont pas accès.
- Une catégorie utilisée dans l'historique est **archivée, jamais supprimée définitivement** ; les dépenses passées conservent leur référence et restent lisibles. Une catégorie archivée ne peut plus être choisie pour une nouvelle dépense, sauf après réactivation.
- Le nom saisi pour une catégorie personnalisée est affiché tel quel, sans traduction automatique ; vérifier unicité appropriée, permissions Firestore et audit.

## 10. Écrans V1

1. **Connexion / inscription / mot de passe oublié**.
2. **Mes groupes** : liste, devise propre à chaque groupe, soldes, groupe personnel ou partagé, invitation, archivage.
3. **Détail d'un groupe** : membres, filtres, opérations regroupées par date, devise fixe visible, solde, bouton d'ajout.
4. **Création / édition** : formulaire rapide, catégories illustrées, pièces jointes.
5. **Éditeur de partage** : cinq modes, mémorisation personnelle par groupe, validations visuelles.
6. **Détail d'une dépense** : paiement, parts, historique, commentaires et justificatifs.
7. **Amis / participants** : dettes entre personnes, regroupement par devise et groupe.
8. **Activité** : ajouts, modifications, suppressions et règlements.
9. **Statistiques** : tableau de bord interactif par groupe avec sélecteur de période en dropdown (onglets Jours / Mois / Années), répartition par catégorie, comparaison par membre, évolution temporelle, montants payés/attribués et soldes après règlements.
10. **Compte / préférences** : nom, langue (FR/EN/JA), sécurité, déconnexion et export.
11. **Import Splitwise** : sélection de fichier, mapping, aperçu, erreurs et rapprochement final.

Navigation fixe adaptée aux petits écrans (Groupes, Amis, Statistiques/Activité, Compte), grand bouton « Ajouter une dépense ». Sur desktop : navigation latérale et tables/graphiques plus larges. **Français, anglais et japonais livrés ensemble en V1**, avec tests de longueur des libellés, navigation clavier, focus, contraste, états vides et chargement.

### Statistiques interactives et sélecteur de période (V1 / M4)

- **Un seul champ déroulant** « Période » dans le tableau de bord, affichant le début et la fin choisis. **Ne pas afficher trois boutons Jours/Mois/Années en permanence dans la page**.
- À l'ouverture, une grande fenêtre de sélection inspirée des captures de calendrier fournies **privément à Codex** (ne pas committer les captures). Trois **onglets dans le dropdown** : **Jours**, **Mois**, **Années** ; ils remplacent les onglets « Dates précises / Dates flexibles » du modèle de référence.
- **Jours** : deux calendriers mensuels côte à côte sur desktop, empilés ou adaptés sur mobile ; sélection d'une date de début puis d'une date de fin, avec surlignage continu de l'intervalle.
- **Mois** : grille de 12 mois par année ; sélectionner le premier puis le dernier mois, avec navigation entre les années. Exemple mai 2020 → juin 2023 = 01/05/2020 au 30/06/2023 inclus.
- **Années** : grille d'années navigable ; sélectionner première et dernière années. Exemple 2024 → 2025 = 01/01/2024 au 31/12/2025 inclus.
- Les dates de début et de fin sont **inclusives**, basées sur la date comptable `YYYY-MM-DD` des dépenses, et `dateFrom <= dateTo`. Ne pas introduire de décalage de fuseau horaire sur une date sans heure.
- Boutons **Appliquer** et **Annuler** : le brouillon de sélection n'affecte pas les graphiques tant que l'utilisateur n'a pas confirmé. Préserver la période choisie lors de la navigation ; raccourcis « Ce mois », « Cette année », « 12 derniers mois », « Depuis le début » possibles sans remplacer les trois onglets.
- Sélectionner **un groupe** avant d'afficher les statistiques : tous les chiffres sont exprimés dans **sa devise unique**. Ne jamais mélanger les devises de groupes distincts.
- **Indicateurs** : dépenses totales de la période, total réellement payé par membre, total attribué/dû par membre, différence entre paiements (notamment pour deux membres), soldes et règlements clairement distingués.
- **Graphique en anneau / camembert** : répartition des dépenses par catégorie (montant, pourcentage, couleur et icône) ; clic sur un segment/légende pour filtrer la liste correspondante.
- **Barres comparatives** : pour chaque membre, « payé » vs « part attribuée ». Avec deux membres, afficher l'écart entre leurs montants payés ; avec 3+ membres, comparer tous les participants sans supposer un couple.
- **Évolution temporelle** : courbe ou histogramme des dépenses par jour/mois/année, avec granularité automatique adaptée à la durée et possibilité de la modifier indépendamment de l'onglet du sélecteur.
- **Sens comptable** : « différence entre ce que deux personnes ont payé » ≠ « dette nette ». Les règlements sont suivis à leur date ; distinguer explicitement les soldes courants (cumulés depuis l'origine) des flux filtrés sur une période, sans les confondre.
- **UX** : graphiques interactifs, infobulles accessibles, légendes cliquables, affichage des montants exacts, formats locaux, palette cohérente, état vide/chargement/erreur, responsive et clavier. Choisir en M1 une bibliothèque maintenable (ECharts ou Chart.js) après POC Angular.
- **Performance Firestore** : requêtes par `groupId` et date comptable, index versionnés, pagination et agrégats mensuels recalculables si nécessaires. Les intervalles arbitraires peuvent combiner mois entiers et bornes partielles, sans erreur d'arrondi ni double comptage.

### Internationalisation FR / EN / JA (V1 / M1–M2)

- Locales supportées dès le départ : **`fr`**, **`en`**, **`ja`**. Détecter la langue initiale via `navigator.languages` / `navigator.language` et leurs sous-tags (ex. `fr-CA` → `fr`, `ja-JP` → `ja`) ; **repli sur `en`** si aucune langue compatible.
- Dans **Paramètres → Langue**, l'utilisateur peut choisir Français, English ou 日本語 ; ce choix **prime sur le navigateur**, est enregistré dans `users/{uid}.preferredLanguage` et se réapplique à la connexion. Pour un visiteur non connecté, conserver localement son choix sans stocker de données financières.
- Changement de langue **immédiat sans rechargement** de la PWA, avec traduction de la navigation, des validations, erreurs, notifications, catégories système, tableaux, graphiques et sélecteur de dates.
- Utiliser `Intl.DateTimeFormat`, `Intl.NumberFormat` et des traductions à clés stables ; les formats de date et de nombre suivent la langue, mais **ne changent jamais la devise du groupe ni les valeurs enregistrées**.
- Prévoir textes longs, polices compatibles japonais, retours à la ligne, accessibilité, pluriels et tests des trois langues. Noms des catégories personnalisées conservés tels que saisis.

### Design system et qualité UI/UX (V1 / M1–M6)

- Définir dès M1 tokens de couleurs, typographie, espacements, rayons, états de composants, grilles et animations discrètes ; Tailwind/Lucide et composants Angular `shared` réutilisables, CSS personnalisé minimal.
- Expérience **mobile-first**, navigation tactile, sélection de dates confortable, formulaires rapides, graphiques lisibles, feedback explicite des sauvegardes et erreurs, chargement progressif, empty states soignés.
- Identité visuelle originale ; les captures Splitwise et du sélecteur de vols sont des **références de parcours**, pas des assets à recopier ou à publier dans GitHub.
- Définir des critères d'acceptation UI/UX pour chaque jalon ; M6 valide notamment les trois langues, les interactions au clavier, les tailles d'écran, les graphiques et les performances.

## 11. Photos de reçus : Cloudinary Free privé

Google Photos Picker permet une **sélection** de photos existantes, mais ses URL de contenu expirent généralement après 60 minutes et requièrent une autorisation OAuth ; ce n'est pas un hébergeur fiable de `<img>` permanent pour les membres d'un groupe.

### Upload et consultation V1

1. L'utilisateur choisit un justificatif depuis la galerie ou son ordinateur ; le navigateur corrige l'orientation, réduit la taille (WebP/JPEG, quelques centaines de Ko ciblés), enlève les métadonnées sensibles inutiles et contrôle le type réel/poids.
2. Angular demande à la route `POST /media/upload-signature` du **Cloudflare Worker Free** une autorisation pour un `groupId`, une dépense et une taille/MIME précisés, en envoyant son **Firebase ID token**.
3. Le Worker vérifie cryptographiquement le jeton, son audience/issuer/expiration, et **l'appartenance actuelle à ce groupe** auprès de Firestore. Il construit lui-même un identifiant d'objet et des paramètres d'upload limités, puis signe la requête Cloudinary. Aucune signature générique réutilisable ni secret Cloudinary n'est exposé dans Angular.
4. Upload dans Cloudinary avec le type de livraison **`authenticated`** : original et dérivés ne sont pas disponibles sur une URL publique par défaut. Firestore conserve seulement l'identifiant Cloudinary, les dimensions, le format, la taille, le groupe/dépense et les dates.
5. Pour voir la photo, le Worker **revérifie l'accès au groupe**, puis sert le contenu protégé ou délivre un accès temporaire adapté aux capacités Cloudinary Free. Une simple URL signée permanente ou le fait de connaître `publicId` ne suffit **pas** comme contrôle d'accès durable.
6. Suppression depuis l'application : retrait logique des métadonnées, suppression sécurisée de l'objet distant par le Worker, et journal d'audit ; prévoir plusieurs justificatifs par dépense et export complet.

Le Worker effectue aussi les validations backend des dépenses lorsque nécessaire. Il reste à déployer sur son domaine gratuit `workers.dev`, avec CORS limité aux origines approuvées, contrôles de taille, anti-abus, limites de fréquence et secrets serveur. **POC M0 indispensable** : prouver que le couple Firebase ID token + vérification Firestore + accès privé Cloudinary fonctionne intégralement avec les offres gratuites.

### Budget et sécurité

- Cloudinary Free : 25 crédits communs au **stockage existant**, à la bande passante sur 30 jours glissants et aux transformations. Exemple : 5 Go stockés + 3 Go consultés + 2 000 transformations = 10 crédits ; **ce n'est pas un quota fixe de 25 Go de stockage en plus de la diffusion**.
- Suivi des crédits depuis le dashboard Cloudinary, alertes de capacité et compression avant envoi ; prévoir une limite par fichier et une politique de nettoyage des pièces non rattachées.
- Les fichiers sont des justificatifs financiers privés : **aucun upload `public` ni mode `unsigned` non restreint**, aucune clé d'API ou clé de service Firebase dans le navigateur ou l'extension.
- Une intégration Google Photos Picker pourra fournir l'image d'origine à copier vers Cloudinary. **Ne jamais enregistrer l'URL temporaire Google comme lien permanent**.

V2 facultative : changement de fournisseur d'images (R2, Google Drive partagé ou autre) via un `AttachmentStorageAdapter`, sans casser les métadonnées d'OurFinance.

## 12. Extraction et migration depuis Splitwise Desktop

Splitwise Web existe. La priorité est de **récupérer les données possédées par les utilisateurs** sans dépendre durablement de Splitwise, puis de les importer dans OurFinance.

### Stratégie en deux voies

**Voie A — officielle, référence de fiabilité :** exports CSV des groupes et relations depuis Splitwise Web ; import JSON complet si une sauvegarde de compte est obtenue (notamment Splitwise Pro). Ce chemin constitue le minimum de la V1 et reste utilisable si le site change.

**Voie B — extension Chrome optionnelle, livrée avec l'outil de migration :** projet Manifest V3 sous `tools/splitwise-exporter/`, s'appuyant sur l'organisation et les tests de `ranouf/ugly-padlet` : scripts de contenu limités aux pages Splitwise, popup « Exporter mes données », actions initiées/confirmées par l'utilisateur, suivi d'avancement, export local JSON/ZIP/CSV et journal de ce qui a été récupéré.

L'extension pourra aider l'utilisateur à naviguer entre ses groupes, déclencher les fonctions d'export **officiellement exposées** et normaliser les fichiers téléchargés ou les informations volontairement affichées. Ne pas contourner les restrictions techniques, réutiliser les jetons de session, sonder des endpoints privés/non documentés, masquer une automatisation interdite, ni prétendre avoir récupéré des éléments que l'interface ne fournit pas. Les conditions de l'API Splitwise restreignent les applications concurrentes et la rétro-ingénierie : réévaluer la conformité avant d'ajouter toute collecte automatisée au-delà des exports officiels.

### Références vérifiées dans les dépôts GitHub

- [`ranouf/ugly-padlet`](https://github.com/ranouf/ugly-padlet) : extension Chrome Manifest V3, `content_scripts`, worker, Prettier, ESLint, Jest, Playwright, CI et packaging.
- [`ranouf/PublishHtmlTab`](https://github.com/ranouf/PublishHtmlTab) : autre extension (Azure DevOps, non Chrome) utile pour la discipline CI/packaging, mais pas pour la collecte Web.
- `ranouf/OurFinance` est initialement **vide** au 13 novembre 2026 ; aucune extension n'y existe encore.

### Format d'import et garantie comptable

- Normalisation locale dans une structure versionnée `OurFinanceImportV1` : utilisateurs, groupes, **devise source de chaque opération**, dépenses, versements, catégories, pièces disponibles, provenance et limitations.
- Import avec mapping explicite des comptes (dont les membres qui n'ont pas encore de compte OurFinance), groupes et **devise unique du groupe cible**. Une transaction dans une autre devise doit être dirigée vers un autre groupe compatible ou exclue avec explication ; jamais convertie automatiquement.
- Chaque transaction importée possède un identifiant/fingerprint de provenance pour éviter les doublons sur réimport.
- CSV Splitwise peut représenter des impacts nets sans détailler exactement les `paid_share` et `owed_share` : ne pas inventer les données manquantes. Préserver le montant d'origine, les impacts et un statut « répartition historique non entièrement déterminable », ou demander confirmation.
- Comparer **par groupe et personne, dans la devise unique de chaque groupe**, les soldes avant/après import ; signaler les différences, permettre d'annuler le batch.
- Import initial réversible et export final JSON/CSV complet depuis OurFinance.
- Données privées : l'extension ne transmet rien automatiquement à un tiers ; fichier local remis volontairement à l'application lors de l'import.

## 13. Code et responsabilités

```text
src/app/
  core/
    auth/
    guards/
    firebase/
    i18n/
    models/
  shared/
    components/
      app-shell/
      bottom-navigation/
      money-input/
      currency-selector/
      category-picker/
      expense-card/
      split-editor/
      user-avatar/
      confirmation-dialog/
      date-range-filter/
      period-range-popover/
      statistics-card/
      category-donut-chart/
      member-payment-chart/
      spending-trend-chart/
    pipes/
    validators/
    utils/
  features/
    authentication/
    groups/
    expenses/
    settlements/
    friends/
    statistics/
    activity/
    profile/
    import-export/
firebase.json
.firebaserc
firestore.rules
firestore.indexes.json
workers/
  ourfinance-api/
    src/
      auth/
      expenses/
      invitations/
      media/
      firestore/
    wrangler.toml
    tests/
tests/
  firestore-rules/
  firebase-emulators/
tools/
  splitwise-exporter/
.github/workflows/
  pr-validation.yml
  firebase-deploy.yml
  worker-deploy.yml
```

- Composants Angular standalone et Signals ; Reactive Forms typés ; RxJS pour les flux asynchrones lorsque nécessaire.
- UI Tailwind et **design system documenté** ; classes utilitaires et variantes partagées, CSS global minimal ; graphes accessibles et responsive.
- Internationalisation FR/EN/JA via Transloco (ou équivalent après POC), détection du navigateur, préférence utilisateur persistée et changement de langue à chaud.
- `SplitEngine` pur, indépendant des services et de la base, avec tests exhaustifs.
- Services ciblés : `AuthService`, `GroupService`, `ExpenseService`, `SplitPreferenceService`, `BalanceService`, `CurrencyService` (catalogue ISO + formatage, **pas de conversion**), `CategoryService`, `StatisticsService`, `LocaleService`, `AttachmentService`, `SplitwiseImportService`.
- Repositories Firestore typés, **converters** explicites, index composites versionnés, cache de statistiques dérivables, lecture paginée et abonnements désinscrits correctement.
- `SplitEngine` commun ou tests de conformité croisés entre Angular et Worker ; validations du format des écritures côté Worker (dont la somme des paiements/parts) et transactions cohérentes avant publication dans Firestore.
- Passerelle Worker limitée aux actions privilégiées : création/édition/suppression de dépenses, remboursements, acceptation sécurisée d'invitations, signatures/accès aux médias. Les vues restent accessibles directement depuis Firebase SDK **sous Security Rules**.
- Secrets Cloudinary, identité serveur Firestore et éventuelles clés de signature dans les secrets Cloudflare ; compte de service **IAM minimal**, rotation, audit. Jamais de clé de service Firebase ou `CLOUDINARY_API_SECRET` dans Angular, Chrome, GitHub en clair ou les logs.

## 14. Tests, sécurité et CI/CD

### Tests obligatoires

- Split égalitaire / pourcentage / montant / parts / ajustements ; 1, 2, 3+ participants ; multi-payeurs ; 0/2/3 décimales ; arrondis et conservation des montants.
- Préférence `(user,group)` : première dépense sans configuration, réutilisation, modification, isolation entre utilisateurs/groupes, changement de membres, non-rétroactivité.
- Sécurité : **tests d'intégration Firestore Security Rules dans Emulator Suite** (lecture/écriture inter-groupes refusées, requêtes de collection group, préférences personnelles), API Worker authentifiée, invitations non réutilisables, membre retiré sans accès aux photos ni aux données.
- Transactions atomiques et concurrence dans les routes Worker, calculs sensibles falsifiés côté client rejetés, historiques et suppressions logiques.
- Cloudinary : uploads `authenticated`, accès refusé sans groupe, signatures de courte durée, suppression à distance, fichiers hors quota, fuite potentielle de liens, MIME et taille abusifs.
- Import idempotent, doublons, annulation du batch, données partielles, **rejet ou répartition explicite des devises incompatibles entre groupes distincts**, comparaison des soldes.
- E2E : création du compte, invitation, dépense, remboursement, photo, statistiques, export et navigation PWA ; au minimum Chrome mobile/desktop, vérification Safari/iOS.
- **Devise stricte** : verrou après première transaction (même archivée), impossibilité de saisir ou rembourser dans une autre devise, cas JPY/CAD/KWD, impossibilité d'additionner des groupes de devises différentes.
- **Statistiques** : sélecteur dropdown et onglets Jours/Mois/Années, début/fin inclusifs, traversée des années, bornes de mois/année, Annuler/Appliquer, graphiques par catégorie/membre/temps, exactitude payé vs dû vs solde, 1/2/3+ membres, périodes sans données.
- **i18n/UX** : détection `fr-CA`/`en-US`/`ja-JP`, repli anglais, préférence persistée, changement instantané, catégories système traduites, affichage local des dates et montants, composants accessibles, navigation clavier et mobile.
- Extension : tests Jest/Playwright sur des fixtures autorisées, packaging Chrome Manifest V3 et permission minimale.
- Objectif de couverture : au moins 80 % global, et couverture renforcée pour le moteur monétaire et les règles de sécurité (scénarios critiques exhaustifs).

### Pipeline

1. PR : formatage, lint, typecheck, build Angular/PWA, tests unitaires, **Firebase Emulator Suite** (règles et transactions), tests du Worker et du stockage privé, E2E critiques, validation de l'extension lorsqu'elle change.
2. Preview Firebase Hosting créée pour chaque PR. **Une preview n'utilise jamais Firestore/Cloudinary de production** : utiliser des projets et environnements d'essai isolés ; aucune clé de service dans les artefacts de preview.
3. Merge `main` : validation puis déploiement explicite des `firestore.rules`, des index Firestore, du Worker et de Firebase Hosting ; smoke tests. L'ordre évite qu'un frontend nouveau voie des règles ou routes anciennes.
4. Migrations documentaires : scripts versionnés et idempotents, sauvegarde/export préalable pour changements importants, compatibilité ascendante puis migration progressive. **Pas de migrations SQL**.
5. Secrets dans GitHub Actions ou Cloudflare exclusivement selon leur usage ; permissions GitHub minimales, protections de branche et checks obligatoires avant merge.

## 15. Jalons et livrables

| Jalons | Travaux | Critère de fin |
|---|---|---|
| **M0 — faisabilité** | POC Firebase Auth/Firestore Spark, Worker Free, Cloudinary `authenticated`, calculs atomiques et règles d'accès, quotas ; évaluation de l'extension/exports officiels | Dépense test sécurisée, image privée accessible au membre autorisé et refusée à un tiers, coût nul démontré |
| **M1 — fondation** | Angular/Tailwind/PWA, **design system**, infrastructure **i18n FR/EN/JA**, POC bibliothèque de graphiques, Firebase Hosting, Firestore Emulator, CI GitHub, Worker, environnements séparés | Site installable, composants UI de base, traductions chargées, PR validées, preview isolée |
| **M2 — comptes/groupes** | Google/email, récupération native, profil, **détection navigateur + préférence de langue modifiable**, groupes libres à **devise unique obligatoire**, invitations par lien, Security Rules | Groupes à 1/2/3 membres ; devise choisie à la création, langue persistée, aucune fuite inter-groupes |
| **M3 — dépenses** | Catalogue global de catégories traduites, catégories personnalisées collaboratives, catalogue ISO pour **choix de devise par groupe**, montants strictement dans cette devise, paiements/parts, cinq répartitions, mémorisation personnelle | Dépenses exactes sans conversion ; devise verrouillée après première transaction ; split réutilisé sans imposer 60/40 |
| **M4 — finances** | Remboursements dans la devise du groupe, soldes exacts, **sélecteur dropdown Jours/Mois/Années**, indicateurs, camembert catégories, barres payé vs dû par membre, courbe temporelle, filtres et interactions | Montants exacts, écarts expliqués, graphiques et bornes de période testés, mobile et desktop |
| **M5 — import/photos** | Reçus Cloudinary privés, export natif OurFinance, import Splitwise CSV/JSON **sans conversion et avec séparation des devises incompatibles**, extension d'aide aux exports, dédoublonnage | Migration rapprochée, fichiers privés, devises source préservées et erreurs signalées |
| **M6 — production** | E2E, audit Firestore Rules/Worker/IAM, sauvegarde/restauration, **tests UX/i18n FR/EN/JA**, graphiques et sélecteur mobile/desktop, performances, Android/iOS, déploiement | Groupes indépendants, 3 langues, graphiques accessibles, validation utilisateur |

### Definition of Done V1

- [ ] Une personne peut créer un compte et plusieurs groupes, seule ou avec d'autres utilisateurs.
- [ ] Les autres groupes sont strictement invisibles sans appartenance autorisée.
- [ ] Les invitations **par lien partageable** et la récupération de mot de passe Firebase fonctionnent avec des adresses externes au projet.
- [ ] Le suivi d'un groupe à un seul membre fonctionne.
- [ ] Une première dépense ne reçoit aucune répartition personnelle préenregistrée.
- [ ] Une dépense suivante du même utilisateur/groupe propose sa dernière répartition, modifiable parmi les cinq modes.
- [ ] Deux personnes dans le même groupe ont des préférences de partage indépendantes.
- [ ] Chaque groupe choisit une **seule devise ISO active** ; toutes ses transactions utilisent cette devise, sans conversion, avec tests sur 0, 2 et 3 décimales ; changement interdit après la première transaction.
- [ ] Le catalogue global de catégories avec icônes/couleurs est traduit en FR/EN/JA ; tous les membres actifs peuvent créer, modifier et archiver les catégories personnalisées de leur groupe, sans altérer l'historique.
- [ ] Les statistiques sont filtrées **par groupe** et par période choisie via **un dropdown à onglets Jours/Mois/Années** (début/fin inclusifs, Annuler/Appliquer) ; camembert par catégorie, comparaison payé vs dû par membre, évolution temporelle et indicateurs exacts.
- [ ] Photos Cloudinary privées (`authenticated`) visibles seulement aux membres autorisés, avec signature/stream protégé et exportables avec leur dépense.
- [ ] CSV Splitwise importé avec historique, anomalies et rapprochement des soldes.
- [ ] PWA installable et responsive, design system soigné, graphiques et sélection de dates accessibles, sans traitement silencieux de données privées en dehors du groupe.
- [ ] UI entièrement disponible en **français, anglais et japonais**, avec langue initiale selon le navigateur, choix dans les paramètres, préférence persistée et changement immédiat.
- [ ] Pipeline PR et déploiement GitHub vers Firebase Hosting/Firestore/Worker validés ; sauvegardes documentées.
- [ ] La V1 fonctionne sur Firebase Spark + Cloudinary Free + Worker Free **sans carte bancaire ni facturation requise**, et les quotas sont surveillés.

## 16. Références documentaires

- Firebase — [Tarifs Spark](https://firebase.google.com/pricing), [Quotas Firestore](https://firebase.google.com/docs/firestore/quotas), [Transactions Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions).
- Firebase — [Authentification](https://firebase.google.com/docs/auth), [Réinitialisation de mot de passe](https://firebase.google.com/docs/auth/web/manage-users), [Règles de sécurité Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions).
- Firebase — [Déploiement Hosting via GitHub](https://firebase.google.com/docs/hosting/github-integration), [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite).
- Cloudinary — [Facturation et 25 crédits Free](https://cloudinary.com/documentation/billing_and_plans), [Médias protégés](https://cloudinary.com/documentation/control_access_to_media), [Upload authentifié](https://cloudinary.com/documentation/upload_images).
- Cloudflare — [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) et [Sécurité des secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
- BookMyName — [FAQ gestion du domaine](https://en.faqs.bookmyname.com/enfaqs/services).
- ISO — [Codes de devises ISO 4217](https://www.iso.org/iso-4217-currency-codes.html).
- Splitwise — [Export de données](https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data) et [conditions API](https://dev.splitwise.com/).
- Google Photos — [Picker : media items](https://developers.google.com/photos/picker/guides/media-items).
- Cloudflare R2 — [Tarifs](https://developers.cloudflare.com/r2/pricing/) (alternative future, pas retenue en V1).

## 17. Décisions à valider avant M1

1. **M0 :** valider le POC de chaîne de confiance Firebase Auth → Worker Free → Firestore/Cloudinary ; démontrer les droits d'accès par groupe, les contraintes de dépenses et les quotas sans carte bancaire.
2. **Invitations :** accepter en V1 le partage manuel d'un lien d'invitation sécurisé, sans email automatique personnalisé. Les emails de vérification et de réinitialisation restent ceux de Firebase Auth.
3. **Splitwise :** disposer d'un échantillon CSV non sensible (et éventuellement JSON de sauvegarde) pour vérifier le degré de fidélité de l'import ; confirmer la portée de l'extension après revue des conditions du service. Les transactions de devise incompatible sont séparées ou refusées, jamais converties.
4. **Accès GitHub :** envisager de rendre `OurFinance` privé si des exemples ou fixtures de données personnelles doivent être conservés ; éviter tout jeu de données réel dans un dépôt public.
5. **Domaine :** garder le domaine Firebase gratuit au démarrage ; sous-domaine `carnould.com` facultatif, via BookMyName, après la mise en production.
6. **Décisions produit confirmées (16/11/2026) :** une seule devise stricte par groupe, sans conversion ; statistiques avec dropdown Jours/Mois/Années et graphiques interactifs ; FR/EN/JA dès la V1 ; design system et UX mobile-first. Ces décisions **remplacent** les anciennes exigences multidevises par dépense et les anciennes mentions « anglais/japonais prévus plus tard ».

