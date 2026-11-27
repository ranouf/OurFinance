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
- L'intention d'invitation survit au passage connexion → inscription → vérification du courriel → réinitialisation → connexion, sans jeton dans une URL de réinitialisation. Si l'utilisateur ouvre l'email sur un autre appareil, proposer de rouvrir le lien d'invitation ; ne pas promettre une reprise interappareils.
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
| Mauvais compte | Afficher le compte courant et Changer de compte, sans dévoiler l'adresse cible de l'invitation. |
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
