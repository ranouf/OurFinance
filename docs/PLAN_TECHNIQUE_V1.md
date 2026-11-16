# OurFinance — Plan technique V1

Statut : **plan de réalisation**, sans implémentation applicative à ce stade.  
Dernière mise à jour : 15 novembre 2026.  
Dépôt : `ranouf/OurFinance`.

## 1. Objectifs et principes

OurFinance est une application de suivi et de partage de dépenses, accessible sur ordinateur et installable sur téléphone comme **PWA**. Elle doit prendre en charge des groupes indépendants, des utilisateurs individuels ou multiples, toutes les devises monétaires ISO 4217, plusieurs méthodes de répartition et les données historiques importées depuis Splitwise.

### Exigences non négociables

- Aucune limitation quotidienne artificielle du nombre de dépenses dans OurFinance. Les quotas techniques des fournisseurs gratuits restent applicables.
- Chaque utilisateur peut créer plusieurs **groupes** et y inviter d'autres comptes, sans notion obligatoire de foyer/couple.
- Chaque groupe possède ses membres, sa devise proposée, ses catégories/dépenses, ses remboursements et ses permissions.
- Un groupe peut n'avoir **qu'un seul membre** (suivi des frais personnels ou d'un immeuble).
- Aucun partage 60/40, 50/50 ou autre n'est défini automatiquement à la création d'un groupe.
- La **dernière répartition utilisée par un utilisateur dans un groupe** est sauvegardée après validation d'une dépense et proposée lors de sa prochaine dépense dans ce même groupe. Chaque utilisateur conserve sa préférence distincte.
- La répartition reste modifiable à chaque dépense : égalitaire, montants exacts, pourcentages, parts ou ajustements. Modifier la préférence ne change pas l'historique.
- Authentification Google ou email/mot de passe, vérification d'email, récupération du mot de passe.
- Statistiques : dépenses réellement payées, parts dues, écarts et soldes par mois, année, totalité et plage personnalisée.
- Historique, recherche, catégories illustrées, reçus, remboursements, import/export.
- Code Angular moderne, composants réutilisables dans `shared`, Tailwind et CSS personnalisé minimal.
- Déploiement automatisé à partir de GitHub, environnements isolés et contrôle de sécurité sur PR.

### Exemples de groupes, non codés en dur

| Groupe | Devise proposée | Membres possibles | Usage |
|---|---|---|---|
| Duplex | CAD | Une personne | Dépenses personnelles d'immeuble |
| Canada | CAD | Deux personnes | Dépenses quotidiennes |
| France | EUR | Trois personnes ou plus | Voyage et famille |
| Japon | JPY | Deux personnes | Voyage au Japon |

Les membres et pourcentages des exemples n'imposent aucune règle globale. La devise proposée n'empêche pas une dépense ponctuelle dans une autre devise.

## 2. Architecture cible et arbitrages

| Couche | Choix V1 | Raison |
|---|---|---|
| Frontend | Angular (dernière version stable compatible), TypeScript, standalone, Signals | Préférence du projet ; maintenabilité |
| UI | Tailwind CSS 4 et Lucide | Peu de CSS, icônes cohérentes |
| PWA | `@angular/pwa`, manifeste, service worker | Installation Android/iOS et cache applicatif |
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
- Profil : nom d'affichage, avatar, langue, préférences, devise de référence et fuseau horaire.
- Les utilisateurs sont indépendants de leurs groupes : création, invitation, retrait et changement de groupe actif.

### Invitations de groupe sans service d'envoi d'emails externe

- Générer un **lien d'invitation à usage unique**, expirant et lié à un groupe ; éventuellement limité à une adresse email précise.
- En V1, l'auteur partage ce lien lui-même (copie, messagerie, bouton `mailto:` ou Web Share API). **Ne pas promettre l'envoi automatique d'emails d'invitation** : Firebase Auth n'est pas une plateforme de mails transactionnels arbitraires.
- L'acceptation nécessite une connexion Firebase et une vérification serveur de la validité du jeton, du destinataire éventuel, de son expiration, de l'état du groupe et de l'unicité de l'acceptation.
- Si les Security Rules et transactions Firestore ne permettent pas une acceptation atomique sûre, utiliser une route dédiée du Worker avec autorisation minimale, jamais des secrets d'administration dans Angular.

## 5. Groupes, participants et autorisations

- Un utilisateur crée un groupe avec nom, icône/couleur, devise proposée et description facultative.
- Il peut inviter des utilisateurs existants ou nouveaux par email/lien à usage unique, avec expiration et vérification de l'identité invitée.
- Rôles par groupe : `owner` et `member` pour la V1, avec possibilité d'étendre les permissions.
- Un utilisateur peut appartenir à plusieurs groupes et voir ses soldes par groupe ou par relation.
- Une personne peut suivre seule son groupe « Duplex » ; le moteur produit des dépenses et statistiques mais aucune dette entre membres.
- Le retrait d'un membre révoque son accès futur, tout en préservant l'intégrité de l'historique comptable. Sa dette historique doit être traitée explicitement avant suppression définitive éventuelle.
- Aucune table `households`, aucune `household_id`, aucune configuration de couple imposée.

### Isolation

Chaque document métier est sous un chemin `groups/{groupId}/...` ou porte un `groupId` vérifié. Les Firestore Security Rules utilisent `request.auth.uid`, `get()`/`exists()` sur la présence du membre actif et des règles de rôle distinctes pour `owner` et `member`. Tester les lectures **et écritures** inter-groupes, les références invalides, les membres révoqués, les invitations frauduleuses et les accès par collection group. Ne jamais considérer le filtrage Angular comme un contrôle de sécurité.

## 6. Modèle documentaire Firestore V1

Le découpage **par groupe** constitue la frontière d'isolation et permet des lectures efficaces de l'historique, tout en gardant les préférences propres à chaque utilisateur.

| Collection / document | Champs principaux / rôle |
|---|---|
| `users/{uid}` | Profil Auth, nom, avatar, langue, devise de référence, fuseau horaire |
| `users/{uid}/groupPreferences/{groupId}` | **Dernier partage réellement enregistré par cet utilisateur dans ce groupe**, et préférences de formulaire |
| `groups/{groupId}` | Créateur, nom, devise proposée ISO, icône, couleur, état et dates d'audit |
| `groups/{groupId}/members/{uid}` | Rôle, statut, date d'adhésion ; un seul document par membre |
| `groups/{groupId}/invitations/{invitationId}` | Hash/identifiant opaque de jeton, email cible éventuel, expiration, état et usage unique |
| `groups/{groupId}/categories/{categoryId}` | Libellé, icône Lucide, couleur, éventuelle personnalisation ; catalogue système distinct en lecture |
| `groups/{groupId}/expenses/{expenseId}` | Description, devise, `amountMinor`, catégorie, date, auteur, payeurs et **allocations embarqués**, instantané du split, audit |
| `groups/{groupId}/expenses/{expenseId}/comments/{commentId}` | Auteur, contenu, dates et modération |
| `groups/{groupId}/expenses/{expenseId}/attachments/{attachmentId}` | Cloudinary `publicId` non secret, type `authenticated`, taille, format, propriétaire, statut |
| `groups/{groupId}/settlements/{settlementId}` | Débiteur, créancier, montant/devise, date, références de conversion explicite |
| `groups/{groupId}/activity/{eventId}` | Événements d'audit immuables, acteur, contexte |
| `groups/{groupId}/balances/{balanceId}` | Vue matérialisée **dérivable** des opérations, par personne et devise, avec version/source |
| `groups/{groupId}/statistics/{periodId}` | Totaux matérialisés par période/catégorie/devise, recalculables, versionnés |
| `users/{uid}/importBatches/{batchId}` | Fichier/source, état, identifiants d'origine et erreurs |
| `exchangeRateSnapshots/{rateId}` | Devise source/cible, taux décimal exact sous forme de chaîne, date et origine |

Les identifiants de provenance des transactions importées doivent aussi être indexés pour permettre une détection des doublons **dans un groupe**. Les index Firestore composites sont déclarés dans `firestore.indexes.json`, versionnés avec l'application. Limiter les lectures globales : pagination par curseur, filtres et abonnements seulement aux listes visibles.

### Invariants comptables et cohérence

- Une dépense contient dans **le même document** `payments: [{userId, amountMinor}]` et `allocations: [{userId, amountMinor}]` : leurs sommes sont identiques à `amountMinor` et à chaque autre somme, sans fraction perdue.
- Tous les payeurs et bénéficiaires doivent être membres autorisés à la date appropriée et du **même groupe**. La version persistée de la répartition permet de conserver les faits historiques après une évolution des membres.
- Les montants sont en **unités mineures entières** (jamais en flottants pour le moteur de calcul), bornés à la plage des entiers sûrs JavaScript pour l'enregistrement ; le `SplitEngine` peut utiliser `BigInt` en mémoire. Les taux de change exacts sont sérialisés en chaînes décimales et calculés avec une bibliothèque décimale adaptée.
- Respecter l'exposant ISO de chaque devise (JPY : 0 décimale ; CAD/EUR : 2 ; KWD/BHD : 3) et des arrondis déterministes pour chaque mode.
- Les créations et éditions d'une dépense sont atomiques au niveau de son document. Les mises à jour touchant plusieurs documents (préférence, activité, soldes) utilisent des transactions / écritures groupées **dans une route serveur qui valide tous les invariants**. Le Worker vérifie le jeton Firebase, les permissions et la version du document pour gérer les conflits ; les SDK administrateur et comptes de service contournant les règles Firestore, leurs permissions IAM, leurs clés et leur code sont particulièrement audités.
- Les soldes et statistiques matérialisés ne sont que des **caches reconstruisibles** depuis les dépenses et remboursements. Prévoir versionnement, invalidation, recalcul et tests de concurrence ; ne jamais faire d'un cache la source comptable de vérité.
- Les suppressions sont logiques, auditables et récupérables par un membre autorisé.

Solde individuel dans une devise et un groupe : `paid - owed + settlements_sent - settlements_received`. Une valeur positive signifie une créance ; négative, une dette. Les statistiques de dépense sont calculées sur la **date de la dépense** ; les règlements sont suivis séparément sur leur date de transfert.

## 7. Édition des dépenses et préférences personnelles

### Formulaire rapide

Description, montant, devise, catégorie illustrée, date, groupe, payeur(s), participants, répartition, note et justificatif facultatif. Navigation mobile inspirée des parcours fournis (bouton d'ajout flottant, sélection rapide, détail puis édition), mais identité visuelle originale.

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
- Les préférences du dernier groupe, de la dernière devise et du dernier payeur peuvent être mémorisées séparément, toujours modifiables.

## 8. Toutes les devises du monde

- Cataloguer les **devises actives ISO 4217** (code, libellé, symbole, nombre d'unités mineures) à partir d'une source maintenue ; ne pas coder une union `CAD | EUR | JPY`.
- Utiliser `Intl.NumberFormat` avec la locale de l'utilisateur pour affichage et saisie ; tests sur JPY, KWD/BHD (3 décimales), CAD/EUR et autres exposants.
- Proposer une devise par groupe et autoriser toute devise prise en charge sur une dépense.
- Garder des soldes **séparés par devise**, par personne et par groupe. Ne jamais additionner des CAD, EUR et JPY sans conversion explicitée.
- Conversion manuelle avec taux explicite et instantané immuable ; source de taux automatique facultative si disponible et permise, sans dépendance bloquante pour créer une dépense.
- Conversion de remboursement interdevises : enregistrer les deux montants, deux devises, taux utilisé, date et participants ; éviter une conversion fictive qui effacerait une dette dans la mauvaise devise.
- Tableau de bord global converti dans la devise choisie uniquement avec des taux traçables et une mention « valeur indicative » lorsqu'il s'agit d'un taux de référence.

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

Le formulaire propose une icône lors du choix d'une catégorie, affiche l'icône sur l'historique et le détail, et permet de créer des catégories personnalisées (nom, icône de la liste autorisée, couleur). Le code d'icône, et non du HTML arbitraire, est stocké en base. Prévoir catégories globales et personnalisations par groupe.

## 10. Écrans V1

1. **Connexion / inscription / mot de passe oublié**.
2. **Mes groupes** : liste, soldes par devise, groupe personnel ou partagé, invitation, archivage.
3. **Détail d'un groupe** : membres, filtres, opérations regroupées par date, devise, solde, bouton d'ajout.
4. **Création / édition** : formulaire rapide, catégories illustrées, pièces jointes.
5. **Éditeur de partage** : cinq modes, mémorisation personnelle par groupe, validations visuelles.
6. **Détail d'une dépense** : paiement, parts, historique, commentaires et justificatifs.
7. **Amis / participants** : dettes entre personnes, regroupement par devise et groupe.
8. **Activité** : ajouts, modifications, suppressions et règlements.
9. **Statistiques** : ce mois, année, total, période, groupe, catégorie, part payée/attribuée, avance et solde après règlements.
10. **Compte / préférences** : nom, langue, devises, sécurité, déconnexion et export.
11. **Import Splitwise** : sélection de fichier, mapping, aperçu, erreurs et rapprochement final.

Navigation fixe adaptée aux petits écrans (Groupes, Amis, Statistiques/Activité, Compte), grand bouton « Ajouter une dépense ». Sur desktop : navigation latérale et tables/graphiques plus larges. Accessibilité, clavier, focus, contraste, français initialement ; anglais et japonais prévus.

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

- Normalisation locale dans une structure versionnée `OurFinanceImportV1` : utilisateurs, groupes, devises, dépenses, versements, catégories, pièces disponibles, provenance et limitations.
- Import avec mapping explicite des comptes (dont les membres qui n'ont pas encore de compte OurFinance), groupes et devises.
- Chaque transaction importée possède un identifiant/fingerprint de provenance pour éviter les doublons sur réimport.
- CSV Splitwise peut représenter des impacts nets sans détailler exactement les `paid_share` et `owed_share` : ne pas inventer les données manquantes. Préserver le montant d'origine, les impacts et un statut « répartition historique non entièrement déterminable », ou demander confirmation.
- Comparer **par groupe, personne et devise** les soldes avant/après import ; signaler les différences, permettre d'annuler le batch.
- Import initial réversible et export final JSON/CSV complet depuis OurFinance.
- Données privées : l'extension ne transmet rien automatiquement à un tiers ; fichier local remis volontairement à l'application lors de l'import.

## 13. Code et responsabilités

```text
src/app/
  core/
    auth/
    guards/
    firebase/
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
      statistics-card/
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
- UI Tailwind ; classes utilitaires et variantes partagées, CSS global minimal.
- `SplitEngine` pur, indépendant des services et de la base, avec tests exhaustifs.
- Services ciblés : `AuthService`, `GroupService`, `ExpenseService`, `SplitPreferenceService`, `BalanceService`, `CurrencyService`, `CategoryService`, `StatisticsService`, `AttachmentService`, `SplitwiseImportService`.
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
- Import idempotent, doublons, annulation du batch, données partielles, plusieurs devises, comparaison des soldes.
- E2E : création du compte, invitation, dépense, remboursement, photo, statistiques, export et navigation PWA ; au minimum Chrome mobile/desktop, vérification Safari/iOS.
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
| **M1 — fondation** | Angular/Tailwind/PWA, Firebase Hosting, Firestore Emulator, CI GitHub, Worker, environnements séparés | Site vide installable, PR validées, preview isolée |
| **M2 — comptes/groupes** | Google/email, récupération native, profil, groupes libres, invitations par lien, Security Rules | Groupe personnel, groupe à 2 et groupe à 3 ; aucune fuite inter-groupes |
| **M3 — dépenses** | Catégories et icônes, toutes devises ISO, paiements/parts, cinq répartitions, mémorisation personnelle par groupe | Dépenses et historiques exacts ; split réutilisé sans imposer 60/40 |
| **M4 — finances** | Remboursements, multi-devises, conversions explicites, statistiques par période/groupe/personne | Soldes traçables au montant près, périodes cohérentes |
| **M5 — import/photos** | Reçus Cloudinary privés, export natif OurFinance, import Splitwise CSV/JSON, extension d'aide aux exports, dédoublonnage | Migration rapprochée, fichiers privés, erreurs explicitement signalées |
| **M6 — production** | E2E, audit Firestore Rules/Worker/IAM, sauvegarde/restauration, performances, responsive, Android/iOS, déploiement | Deux groupes réels et un groupe témoin indépendants, validation utilisateur |

### Definition of Done V1

- [ ] Une personne peut créer un compte et plusieurs groupes, seule ou avec d'autres utilisateurs.
- [ ] Les autres groupes sont strictement invisibles sans appartenance autorisée.
- [ ] Les invitations **par lien partageable** et la récupération de mot de passe Firebase fonctionnent avec des adresses externes au projet.
- [ ] Le suivi d'un groupe à un seul membre fonctionne.
- [ ] Une première dépense ne reçoit aucune répartition personnelle préenregistrée.
- [ ] Une dépense suivante du même utilisateur/groupe propose sa dernière répartition, modifiable parmi les cinq modes.
- [ ] Deux personnes dans le même groupe ont des préférences de partage indépendantes.
- [ ] Les montants et les parts sont exacts pour toutes les devises ISO actives, avec tests sur 0, 2 et 3 décimales.
- [ ] Chaque catégorie pertinente a une icône visible et les catégories personnalisées fonctionnent.
- [ ] Les statistiques payées/dûes/soldes couvrent mois, année, total et plage libre.
- [ ] Photos Cloudinary privées (`authenticated`) visibles seulement aux membres autorisés, avec signature/stream protégé et exportables avec leur dépense.
- [ ] CSV Splitwise importé avec historique, anomalies et rapprochement des soldes.
- [ ] PWA installable, responsive et sans traitement silencieux de données privées en dehors du groupe.
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
3. **Splitwise :** disposer d'un échantillon CSV non sensible (et éventuellement JSON de sauvegarde) pour vérifier le degré de fidélité de l'import ; confirmer la portée de l'extension après revue des conditions du service.
4. **Accès GitHub :** envisager de rendre `OurFinance` privé si des exemples ou fixtures de données personnelles doivent être conservés ; éviter tout jeu de données réel dans un dépôt public.
5. **Domaine :** garder le domaine Firebase gratuit au démarrage ; sous-domaine `carnould.com` facultatif, via BookMyName, après la mise en production.

