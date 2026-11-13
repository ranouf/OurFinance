# OurFinance — Plan technique V1

Statut : **plan de réalisation**, sans implémentation applicative à ce stade.  
Dernière mise à jour : 13 novembre 2026.  
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
| Frontend | Angular 22, TypeScript, standalone, Signals | Préférence du projet ; maintenabilité |
| UI | Tailwind CSS 4 et Lucide | Peu de CSS, icônes cohérentes |
| PWA | `@angular/pwa`, manifeste, service worker | Installation Android/iOS, cache applicatif |
| Hébergement statique | Cloudflare Pages | Déploiements GitHub et previews gratuits sous quotas |
| Auth | Supabase Auth | Google, email/mot de passe, récupération |
| Données | Supabase PostgreSQL | Relations, transactions SQL, agrégations comptables |
| Sécurité | PostgreSQL Row Level Security (RLS) | Isolation par groupes |
| Fichiers | Supabase Storage, bucket privé | Reçus visibles par les membres autorisés |
| Email sortant | SMTP externe, domaine `carnould.com` | Flux de confirmation/réinitialisation pour de vrais utilisateurs |
| CI/CD | GitHub Actions + Cloudflare Pages | Tests, migrations et déploiement |
| Extension d'import | Chrome Manifest V3, TypeScript | Export initié par l'utilisateur sur Splitwise Web |

**Pourquoi conserver Supabase ?** Le modèle multi-groupes/participants, les répartitions et les statistiques sont naturellement relationnels. **Risque majeur :** la mise en pause du projet gratuit en cas de faible activité, notamment quand les dépenses ne sont saisies que toutes les deux ou trois semaines. La faisabilité d'une réactivation sécurisée doit être validée avant de verrouiller le fournisseur. Si son ergonomie n'est pas satisfaisante, comparer sérieusement Firebase Spark (qui n'a pas cette pause) avec un fournisseur distinct pour les pièces jointes.

### Quotas gratuits et sauvegardes

- Supabase Free : 500 Mo de base de données, 1 Go de fichiers et quotas de transfert/requêtes ; le service peut évoluer.
- Cloudflare Pages Free : quotas de builds et de ressources. Le domaine Cloudflare fourni est gratuit ; un sous-domaine de `carnould.com` est envisageable.
- Les quotas ne garantissent pas une capacité réellement illimitée. Prévoir un écran de santé/quotas et une procédure de migration.
- Pas de sauvegarde PostgreSQL automatique exploitable comme service de restauration garanti dans l'offre Free : prévoir export périodique, export utilisateur JSON/CSV et sauvegardes des pièces jointes ; documenter la procédure de restauration.

## 3. Gestion de la pause Supabase

Selon la documentation Supabase de septembre 2026, la décision de pause dépend d'une **activité insuffisante sur les sept derniers jours**, pas d'un chronomètre exact sept jours après la dernière dépense. De simples visites sans requêtes ne garantissent pas le maintien actif. Des e-mails d'avertissement et de confirmation sont envoyés au propriétaire. Une application utilisée une fois toutes les deux ou trois semaines a une probabilité réelle d'être régulièrement mise en pause.

### Réactivation manuelle

Depuis le tableau de bord Supabase : sélectionner le projet puis **Resume project**. La documentation récente indique une fenêtre normale de restauration pouvant aller jusqu'à un an après la pause ; ne pas s'appuyer sur cette fenêtre pour remplacer les sauvegardes.

### Réactivation par code : preuve de concept obligatoire en M0

L'API de gestion documente `POST /v1/projects/{ref}/restore`, nécessitant un **Personal Access Token (PAT) d'administration** à portée limitée (`project_admin_write`).

1. Le frontend Cloudflare Pages reste accessible, même si Supabase est suspendu.
2. Un diagnostic constate l'indisponibilité (notamment le statut `540 project paused`).
3. Une fonction serveur Cloudflare Pages/Worker dédiée peut, après contrôles anti-abus et de débit, vérifier l'état du projet puis demander sa restauration via l'API de gestion.
4. Le navigateur affiche « Réactivation en cours » et attend un état sain avant de réessayer l'authentification.
5. Le PAT reste **exclusivement** dans les secrets côté serveur, jamais dans le code Angular, les logs ou les variables exposées au navigateur.

**Attention :** ce flux est une possibilité technique à tester, pas une garantie de reprise instantanée. Il faut démontrer une reprise réelle d'un projet en pause, vérifier le temps de démarrage et protéger la fonction publique. Éviter de compter sur un simple ping artificiel pour contourner durablement la politique d'inactivité.

**Décision de sortie M0 :** conserver Supabase si la reprise est suffisamment fiable et simple ; sinon réévaluer Firebase avant de créer le schéma de production.

## 4. Authentification et emails

### Parcours

- Inscription par Google OAuth ou email/mot de passe.
- Confirmation de l'adresse email, connexion, déconnexion.
- Mot de passe oublié : lien sécurisé par email et écran de renouvellement.
- Association sûre de plusieurs méthodes de connexion au même compte, sans doublons involontaires.
- Profil : nom d'affichage, avatar, langue, préférences, devise de référence et fuseau horaire.
- Les utilisateurs sont indépendants de leurs groupes : création, invitation, retrait et changement de groupe actif.

### SMTP avec `carnould.com`

Option privilégiée : **Resend ou Brevo en formule gratuite** comme SMTP transactionnel de Supabase, avec un expéditeur du type `no-reply@carnould.com`. La gestion DNS de BookMyName peut servir à ajouter les enregistrements exigés par le fournisseur (SPF, DKIM, éventuellement DMARC) sans déplacer le domaine. Confirmer les quotas et la procédure de validation du domaine au moment de l'installation.

Option de secours : un compte Gmail avec vérification en deux étapes et mot de passe d'application peut servir de SMTP à faible volume, mais il n'est pas recommandé de dépendre du Gmail personnel pour les emails d'une application ouverte à d'autres groupes ; restrictions, délivrabilité et gestion des secrets sont moins adaptées.

Le SMTP par défaut de Supabase ne suffit **pas** pour la production : il limite les destinataires aux adresses autorisées de l'équipe et le débit est fortement restreint. Aucun mot de passe SMTP ni secret OAuth dans GitHub ou Angular : secrets chiffrés dans le fournisseur concerné.

## 5. Groupes, participants et autorisations

- Un utilisateur crée un groupe avec nom, icône/couleur, devise proposée et description facultative.
- Il peut inviter des utilisateurs existants ou nouveaux par email/lien à usage unique, avec expiration et vérification de l'identité invitée.
- Rôles par groupe : `owner` et `member` pour la V1, avec possibilité d'étendre les permissions.
- Un utilisateur peut appartenir à plusieurs groupes et voir ses soldes par groupe ou par relation.
- Une personne peut suivre seule son groupe « Duplex » ; le moteur produit des dépenses et statistiques mais aucune dette entre membres.
- Le retrait d'un membre révoque son accès futur, tout en préservant l'intégrité de l'historique comptable. Sa dette historique doit être traitée explicitement avant suppression définitive éventuelle.
- Aucune table `households`, aucune `household_id`, aucune configuration de couple imposée.

### Isolation

Chaque ligne métier est liée à un `group_id` autorisé. Les politiques RLS filtrent en lecture et en écriture selon `auth.uid()` et une appartenance active au groupe. Les références croisées entre groupes sont interdites par contraintes SQL et validations serveur. Tester systématiquement les accès interdits d'un autre groupe et les invitations frauduleuses.

## 6. Schéma relationnel V1

| Table | Champs principaux / rôle |
|---|---|
| `profiles` | `id` lié à Auth, nom, langue, avatar, devise de référence |
| `groups` | `id`, `owner_id`, nom, devise proposée ISO, icône/couleur, archivage |
| `group_members` | `(group_id,user_id)` unique, rôle, statut, date d'adhésion |
| `group_invitations` | `group_id`, email invité, hash du jeton, expiration, statut |
| `user_group_preferences` | `(group_id,user_id)` unique, dernière méthode et paramètres de partage, préférences du formulaire |
| `categories` | catégories système et personnalisées, libellé, `icon_key`, couleur, portée de groupe ou globale |
| `expenses` | `id`, `group_id`, description, catégorie, date comptable, devise, montant, notes, audit |
| `expense_payments` | `expense_id`, `user_id`, montant réellement payé |
| `expense_allocations` | `expense_id`, `user_id`, montant attribué à chacun, méthode et contexte de calcul |
| `settlements` | rembourseur, bénéficiaire, groupe, montant/devise/date ; conversion explicite si besoin |
| `expense_attachments` | chemin privé, format, taille, propriétaire, dépense associée |
| `expense_comments` | auteur, dépense, texte, dates |
| `activity_events` | actions immuables (ajout, modification, suppression logique, remboursement) |
| `exchange_rate_snapshots` | devise source/cible, taux décimal, date, origine, éventuel taux réel de banque |
| `import_batches` | fichier/source, auteur, état, compteurs, date |
| `imported_records` | clé de provenance externe, transaction liée, hash anti-doublon, anomalies |

### Invariants comptables

- Pour une dépense dans une devise, `sum(expense_payments) = amount` et `sum(expense_allocations) = amount` exactement.
- Tous les utilisateurs payeurs/bénéficiaires sont des membres valides du groupe à la date appropriée.
- Les montants sont stockés en unités mineures **entières** (`bigint`), jamais en `float` JavaScript pour les calculs comptables ; les taux de change sont en `numeric` précis.
- L'exposant ISO propre à la devise est respecté (JPY : 0 décimale ; CAD/EUR : 2 ; certaines devises : 3).
- Toute mutation complexe utilise une transaction SQL avec contrôle de l'identité (`rpc`, fonction Postgres avec droits minimaux).
- Les règles d'arrondi sont déterministes et documentées ; aucune unité mineure ne disparaît.
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

## 11. Photos de reçus

Google Photos Picker permet une **sélection** de photos existantes, mais ses URL de contenu expirent généralement après 60 minutes et requièrent une autorisation OAuth ; ce n'est pas un hébergeur fiable de `<img>` permanent pour les membres d'un groupe.

V1 : sélectionner depuis la galerie ou le fichier de l'appareil, compresser dans le navigateur (WebP/JPEG, orientation EXIF correcte, cible de quelques centaines de Ko), charger dans un **bucket Supabase privé** sous `group-id/expense-id/attachment-id`, puis afficher via accès contrôlé ou URL signée temporaire. Prévoir plusieurs reçus par dépense et suppression logique. Une intégration Google Photos Picker pourra fournir le fichier d'origine, qui sera copié une seule fois vers le stockage privé ; **ne jamais stocker le lien temporaire Google comme lien permanent**.

V2 facultative : Google Drive partagé comme fournisseur de fichiers externe via un adaptateur de stockage, après validation UX et permissions OAuth.

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
    supabase/
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
supabase/
  migrations/
  tests/
  seed.sql
tools/
  splitwise-exporter/
.github/workflows/
  pr-validation.yml
  database-deploy.yml
```

- Composants Angular standalone et Signals ; Reactive Forms typés ; RxJS pour les flux asynchrones lorsque nécessaire.
- UI Tailwind ; classes utilitaires et variantes partagées, CSS global minimal.
- `SplitEngine` pur, indépendant des services et de la base, avec tests exhaustifs.
- Services ciblés : `AuthService`, `GroupService`, `ExpenseService`, `SplitPreferenceService`, `BalanceService`, `CurrencyService`, `CategoryService`, `StatisticsService`, `AttachmentService`, `SplitwiseImportService`.
- Types Supabase générés ; accès SQL sécurisé par RLS et RPC transactionnelles (`create_expense`, `update_expense`, `create_settlement`, `accept_group_invite`, etc.).
- Fonctions `SECURITY DEFINER` seulement si nécessaire, avec `search_path` fixe, permissions minimales et tests d'abus.
- Aucune `service_role` ni PAT Supabase dans Angular ou l'extension Chrome.

## 14. Tests, sécurité et CI/CD

### Tests obligatoires

- Split égalitaire / pourcentage / montant / parts / ajustements ; 1, 2, 3+ participants ; multi-payeurs ; 0/2/3 décimales ; arrondis et conservation des montants.
- Préférence `(user,group)` : première dépense sans configuration, réutilisation, modification, isolation entre utilisateurs/groupes, changement de membres, non-rétroactivité.
- Sécurité : lecture/écriture inter-groupes refusées, absence de fuite via vues/RPC ou Storage, invitations non réutilisables, membre retiré sans accès.
- Transactions atomiques et concurrence, historiques, suppressions logiques.
- Import idempotent, doublons, annulation du batch, données partielles, plusieurs devises, comparaison des soldes.
- E2E : création du compte, invitation, dépense, remboursement, photo, statistiques, export et navigation PWA ; au minimum Chrome mobile/desktop, vérification Safari/iOS.
- Extension : tests Jest/Playwright sur des fixtures autorisées, packaging Chrome Manifest V3 et permission minimale.
- Objectif de couverture : au moins 80 % global, et couverture renforcée pour le moteur monétaire et les règles de sécurité (scénarios critiques exhaustifs).

### Pipeline

1. PR : formatage, lint, typecheck, build Angular, tests unitaires, tests SQL avec Supabase local, tests RLS, E2E critiques, validation d'extension lorsqu'elle change.
2. Preview Cloudflare Pages reliée à `staging`, jamais à la base de production.
3. Merge `main` : migration SQL vérifiée et appliquée dans l'environnement cible, déploiement Cloudflare, smoke tests.
4. Les modifications de schéma sensibles exigent relecture, sauvegarde et migration réversible lorsque possible.
5. Secrets dans GitHub/Cloudflare/Supabase uniquement ; protections de branche et checks obligatoires avant merge.

## 15. Jalons et livrables

| Jalons | Travaux | Critère de fin |
|---|---|---|
| **M0 — faisabilité** | POC reprise Supabase suspendu, SMTP sur `carnould.com`, flux de stockage privé et compatibilité PWA ; évaluation de l'extension/exports officiels | Fournisseurs confirmés et risques tranchés |
| **M1 — fondation** | Angular/Tailwind/PWA, Supabase local, CI, Cloudflare, architecture de base | Site vide installable, PR validées, preview isolée |
| **M2 — comptes/groupes** | Google/email, récupération, profil, groupes libres, invitations, RLS | Groupe personnel, groupe à 2 et groupe à 3 ; aucune fuite inter-groupes |
| **M3 — dépenses** | Catégories et icônes, toutes devises ISO, paiements/parts, cinq répartitions, mémorisation personnelle par groupe | Dépenses et historiques exacts ; split réutilisé sans imposer 60/40 |
| **M4 — finances** | Remboursements, multi-devises, conversions explicites, statistiques par période/groupe/personne | Soldes traçables au montant près, périodes cohérentes |
| **M5 — import/photos** | Reçus privés, export natif OurFinance, import Splitwise CSV/JSON, extension d'aide aux exports, dédoublonnage | Migration rapprochée, erreurs explicitement signalées |
| **M6 — production** | E2E, audits RLS, sauvegarde/restauration, performances, responsive, Android/iOS, déploiement | Deux groupes réels et un groupe témoin indépendants, validation utilisateur |

### Definition of Done V1

- [ ] Une personne peut créer un compte et plusieurs groupes, seule ou avec d'autres utilisateurs.
- [ ] Les autres groupes sont strictement invisibles sans appartenance autorisée.
- [ ] Les invitations et la récupération de mot de passe fonctionnent avec des adresses externes au projet.
- [ ] Le suivi d'un groupe à un seul membre fonctionne.
- [ ] Une première dépense ne reçoit aucune répartition personnelle préenregistrée.
- [ ] Une dépense suivante du même utilisateur/groupe propose sa dernière répartition, modifiable parmi les cinq modes.
- [ ] Deux personnes dans le même groupe ont des préférences de partage indépendantes.
- [ ] Les montants et les parts sont exacts pour toutes les devises ISO actives, avec tests sur 0, 2 et 3 décimales.
- [ ] Chaque catégorie pertinente a une icône visible et les catégories personnalisées fonctionnent.
- [ ] Les statistiques payées/dûes/soldes couvrent mois, année, total et plage libre.
- [ ] Photos privées visibles aux membres autorisés et exportables avec leur dépense.
- [ ] CSV Splitwise importé avec historique, anomalies et rapprochement des soldes.
- [ ] PWA installable, responsive et sans traitement silencieux de données privées en dehors du groupe.
- [ ] Pipeline PR et déploiement GitHub validés ; sauvegardes documentées.
- [ ] L'expérience de reprise après pause Supabase est démontrée ou un fournisseur alternatif a été retenu.

## 16. Références documentaires

- Supabase — [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) et [Management API Restore](https://supabase.com/docs/reference/api/v1-restore-a-project).
- Supabase — [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage privé](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Environnements](https://supabase.com/docs/guides/deployment/managing-environments).
- Google — [Mots de passe d'application](https://support.google.com/accounts/answer/185833/sign-in-with-app-passwords).
- BookMyName — [FAQ services/DNS/SMTP](https://en.faqs.bookmyname.com/enfaqs/services).
- ISO — [Codes de devises ISO 4217](https://www.iso.org/iso-4217-currency-codes.html).
- Splitwise — [Export de données](https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data) et [conditions API](https://dev.splitwise.com/).
- Google Photos — [Picker : media items](https://developers.google.com/photos/picker/guides/media-items).
- Cloudflare — [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## 17. Décisions à valider avant M1

1. **M0 :** le prototype de reprise Supabase en cas de pause est-il satisfaisant ? Si non, arbitrer Firebase avant de créer la base réelle.
2. **SMTP :** valider un expéditeur `carnould.com` via DNS BookMyName et une formule gratuite (Resend/Brevo). Ne jamais transmettre ou publier les identifiants personnels Gmail/SMTP.
3. **Splitwise :** disposer d'un échantillon CSV non sensible (et éventuellement JSON de sauvegarde) pour vérifier le degré de fidélité de l'import ; confirmer la portée de l'extension après revue des conditions du service.
4. **Accès GitHub :** envisager de rendre `OurFinance` privé si des exemples ou fixtures de données personnelles doivent être conservés ; éviter tout jeu de données réel dans un dépôt public.

