# UX V2 — PR 2 : connexion et invitation reçue

Statut : inventaire et wireframe proposés, sans modification des parcours en production. Références : `docs/UX_SPECIFICATION_V2.md`, `docs/INVITATIONS_QR.md`, maquettes Everyday Pop V2 de connexion mobile et V1 desktop.

## Écrans desktop et mobile

```text
Desktop (1280 px)                          Mobile (390 px)
┌────────────────┬─────────────────┐       ┌─────────────────────┐
│ terrasse       │ marque          │       │ marque              │
│ illustrée      │ Bienvenue       │       │ scène complète café │
│ sans texte     │ courriel        │       │ Bienvenue           │
│ localisé       │ mot de passe 👁  │       │ courriel            │
│                │ Se connecter    │       │ mot de passe 👁      │
│                │ Google          │       │ Se connecter        │
│                │ Créer un compte │       │ Google / Inscription│
└────────────────┴─────────────────┘       └─────────────────────┘

Invitation reçue, avant connexion : « Vous avez reçu une invitation » sans nom du groupe ; choix Se connecter / Créer un compte / Pas maintenant. Après authentification et courriel vérifié : nom du groupe, devise, compte utilisé, date d'expiration et usage unique ; Rejoindre / Pas maintenant / Changer de compte. Aucun groupe rejoint sur un simple scan ou un simple affichage.
```

- Sur mobile, garder la **scène complète** de la référence V2 (amis, couple à la rose et tables), avec un recadrage qui n'ampute pas les personnages. Vérifier sur rendu réel que le premier champ reste repérable à 390 px et que le formulaire demeure utilisable à 320 px, y compris quand le clavier apparaît. L'invitation peut employer une scène plus courte pour garder son CTA visible.
- L'intention d'invitation survit au passage connexion → inscription → vérification du courriel → réinitialisation → connexion **dans l'onglet initial**, sans jeton dans une URL de réinitialisation. Si l'email de vérification ou de récupération s'ouvre dans un nouvel onglet, même sur le même appareil, proposer de revenir à l'onglet initial ou de rouvrir le lien d'invitation. La même action est proposée sur un autre appareil ; aucune reprise inter-onglets ou interappareils n'est promise sans nouveau lien.
- À l'ouverture de `/join#invite=…`, un **script de capture local placé comme premier élément exécutable dans `index.html`**, chargé par `<script src="/invite-capture.js"></script>` sans `async` ni `defer`, avant le bundle Angular, tout outil de collecte d’erreurs et tout autre script, lit le fragment et appelle **synchroniquement** `history.replaceState` pour le retirer. Il valide ensuite la syntaxe et conserve le jeton valide dans `sessionStorage` de cet onglet ; `App` ne lit plus le fragment, seulement cet état. Aucun script tiers, appel Auth/Worker/Firestore/télémétrie, redirection ou capture ne précède ce script. Le téléchargement statique initial ne transporte pas le fragment HTTP, mais la barre d'adresse l'affiche brièvement avant l'exécution du script : cette fenêtre d'exposition est explicitement limitée, sans promesse de disparition avant le premier rendu du navigateur. Le jeton ne figure ni dans les URL de retour Firebase ni dans les événements de télémétrie. « Pas maintenant » avant ou après connexion est un refus : il efface `sessionStorage` et l'état Angular ; reprendre exige de rouvrir le lien. L'acceptation réussie et les erreurs définitives (jeton mal formé, expiré, révoqué ou déjà utilisé) effacent aussi les deux états ; une erreur réseau récupérable les conserve. Vérifier cet ordre sur chargement direct et rechargement de `/join`.
- Tant que le jeton est dans `sessionStorage`, `/join` n'exécute que le code de l'application et les dépendances Firebase nécessaires à Auth ; aucun script analytique, widget ou bibliothèque distante supplémentaire n'est chargé. Vérifier la politique CSP Hosting et les dépendances exécutées sur cette route. `sessionStorage` reste lisible par tout script du même contexte : les contrôles contre l'injection de script et la durée de vie limitée du jeton sont donc obligatoires, sans prétendre que ce stockage est isolé d'une XSS.
- La prévisualisation du nom et de la devise est demandée au Worker **après** vérification du jeton Firebase et du courriel. Pour une invitation ciblée, le Worker vérifie que l'adresse vérifiée correspond à la cible avant de renvoyer les détails du groupe ; un autre compte ne reçoit qu'un refus générique et « Changer de compte ». Pour une invitation ouverte, tout compte vérifié porteur du lien peut voir l'aperçu, sans être membre avant la confirmation. L'interface n'infère jamais le nom du groupe depuis le lien.
- Un nouveau fragment `#invite=…` remplace toujours l'invitation mémorisée : s'il est mal formé, effacer l'ancien jeton de `sessionStorage` et l'état Angular après retrait du fragment, puis afficher un lien invalide. En l'absence de fragment, `/join` reprend le jeton **mémorisé dans cet onglet**, y compris après rechargement ou navigation interne ; seul le Worker peut établir sa validité métier. Sans jeton, afficher l'état d'invitation absente. Ne pas essayer de distinguer « rechargement » de « nouvelle visite » : seule une action explicite de refus, une acceptation ou une erreur définitive efface l'invitation conservée.
- Le même traitement de fragment est réutilisé pour `hashchange` et la navigation Angular vers `/join` **sans rechargement** ; il retire le nouveau fragment immédiatement, remplace ou efface `sessionStorage`, puis synchronise le signal `pendingInvite` avant de demander une prévisualisation. La capture au démarrage reste dans le script précoce ; le handler de navigation traite uniquement les liens ouverts après le démarrage. Tester deux liens successifs dans un seul onglet et un second lien mal formé.
- Le changement de compte garde l'invitation dans la session du navigateur. Le refus la supprime de cette session sans consommer le lien côté serveur.
- La restauration de session présente un état de chargement neutre ; elle ne montre pas brièvement le formulaire de connexion à un utilisateur déjà connecté.

## États et prochaine action

| État | Interface |
|---|---|
| Courriel ou mot de passe invalide | Message près du champ concerné, `aria-describedby`, focus sur le premier champ invalide, saisie conservée. |
| Identifiants refusés | Message non révélateur, nouvelle tentative ; aucun indice exploitable sur l'existence d'un compte. |
| Envoi de récupération | Confirmation neutre, instruction pour revenir, adresse saisie conservée. |
| Courriel non vérifié | Explication, renvoi du lien selon quota, actualisation du statut, invitation conservée. |
| Invitation expirée/révoquée/utilisée | Message distinct quand le serveur le permet sans révéler de donnée privée ; demander un nouveau lien, retour aux groupes ou à l'accueil. |
| Mauvais compte | Après vérification du courriel et refus du Worker, afficher le compte courant et Changer de compte, sans dévoiler l'adresse cible. Avant vérification, montrer l'étape de vérification et garder Changer de compte accessible, sans prétendre connaître la cause du refus. |
| Déjà membre | Ouvrir le groupe ; ne pas créer un doublon ni consommer inutilement une invitation. |
| Réseau indisponible | Saisie et invitation conservées, Réessayer, aucune confirmation de succès sans retour serveur. |
| Double clic et concurrence | Action bloquée pendant l'appel ; la transaction Worker décide d'une adhésion unique. |

## État du code à préserver et ajuster après validation

- `LoginPage` couvre déjà connexion email, inscription, récupération, Google, visibilité du mot de passe, validation de champs et vérification de courriel. Préserver ses services Auth et traductions FR/EN/JA.
- `InviteAcceptanceCard` affiche la prévisualisation après authentification, expiration, compte acceptant et états d'erreur. Préserver l'appel Worker et la confirmation explicite.
- `App` mémorise le jeton temporaire dans `sessionStorage` et route `/join`. Vérifier la protection au changement de compte et la suppression du fragment URL, sans jamais loguer ou afficher ce jeton dans les captures.
- La connexion est aujourd'hui une carte large avec image de 72 unités CSS sur mobile ; comparer sa hauteur réelle à la maquette V2. Le texte d'erreur global ne doit pas remplacer une erreur associée à un champ.
- Le texte de l'invitation avant authentification doit rester générique. Après acceptation, le groupe devient actif et son aperçu s'ouvre.

## Contrôles de la PR

Wireframes et maquettes desktop/mobile validés avant code ; puis tests login, inscription, récupération, Google, changement de compte, invitation valide et refus, expiration/rejeu, courriel non vérifié, hors ligne, focus et lecteur d'écran. Captures réelles Playwright 1280 × 800 / 390 × 844, contrôles 320 / 768, FR/EN/JA. Aucun jeton dans les traces, images, liens publics ou PR. Les captures et vidéos restent hors dépôt.
