# M2 — essai QR/lien sur ourfinance-test

Statut : **à exécuter sur un SHA API+UI figé** ; ne pas attribuer un résultat ancien à un SHA modifié. Réserver/libérer ourfinance-test et ourfinance-api-dev dans l'issue #30. Aucun déploiement production.

## Préparation

1. Déployer le Worker du SHA exact de la PR UI empilée sur l'API, uniquement sur `ourfinance-api-dev`, et servir le build UI exact sur Hosting TEST ou un build local raccordé à TEST. Vérifier CI verte, `typecheck`, build, tests Worker/unitaires et Rules. Avant activation : `/health` 200 et les routes QR 503.
2. Créer un groupe et des comptes **entièrement fictifs** : propriétaire, invité avec email vérifié, compte tiers, membre à révoquer. Laisser la création d'un QR ouvert disponible pour un compte non encore membre. Utiliser uniquement un groupe et aucun reçu réel.
3. Activer temporairement `ENABLE_QR_INVITATION_POC=true` et `QR_INVITATION_POC_GROUP_ID=<id du groupe fictif>` sur le Worker TEST. Ne transmettre ni jeton d'invitation, ID token Firebase, mot de passe ou lien actif dans le chat, les issues, les logs ou les captures.

## Contrôles API

- Création propriétaire ciblée : 201 ; URL `/join#invite=…` en HTTPS, fragment contenant **seulement** un jeton opaque de 43 caractères. Document groupe avec hash, email cible et expiration ~24 h ; index serveur associé ; aucune valeur brute en Firestore. Création par membre/tiers/révoqué refusée.
- `POST /qr-invitations/preview` avec ID token invité : 200, nom/devise/expiration seulement ; comparer les documents avant/après pour confirmer aucune écriture. Sans Auth ou avec un compte ciblé incorrect : refus. Vérifier qu'un autre groupe que le groupe POC n'est pas accessible.
- Acceptation explicite : 200 ; membre créé avec rôle `member`, membership utilisateur et invitation `accepted`, index supprimé. Rejeu/refus tiers après consommation ; aucune seconde adhésion. Vérifier la lecture du groupe par le nouvel invité et le refus du tiers.
- Nouvelle invitation puis révocation propriétaire : 204, index supprimé, preview/accept ensuite refusées. Membre ordinaire/tiers/révoqué refusés pour la révocation. Si réalisable, simuler expiration et deux acceptations concurrentes ; une seule adhésion doit être créée.
- GET liste propriétaire : statut/date/cible sans token/hash ; membre/tiers refusés. Vérifier `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CORS et absence de secret dans la requête HTTP initiale du lien.

## Contrôles UI/UX

- Propriétaire : QR créé localement, copié/partagé, texte « une personne », expiration et révocation ; aucune requête vers un service QR tiers. Tester FR/EN/JA et 320/390/768/1280 px, clavier/focus, absence de débordement. Vérifier la scannabilité avec caméra native si un appareil est disponible.
- Invité déconnecté : ouvrir le lien, constater la suppression immédiate du fragment puis le message générique sans nom de groupe ; connexion email ou Google, et reprise de l'invitation. Nouveau compte non vérifié : renvoi/rafraîchissement de la vérification. Mot de passe oublié : retour à l'invitation sur le même appareil ; sur un autre appareil, rouvrir le lien ou rescanner.
- Invité connecté : aperçu après Auth, bouton explicite « Rejoindre », annulation sans consommation, changement de compte, puis acceptation et sélection du groupe. Cas déjà membre, compte ciblé différent, invitation expirée/révoquée/utilisée, hors ligne/Worker indisponible : état clair, aucune annonce de succès erronée.
- Pour toute preuve visuelle publiée, utiliser un QR **inactif** ou masquer intégralement le QR et le lien actifs. Un QR actif contient le jeton secret. Les captures/vidéos de validation restent hors Git.

## Nettoyage et compte rendu

Supprimer les invitations et index de lookup résiduels, groupe et sous-collections, comptes fictifs, puis retirer les deux variables POC. Vérifier `/health` 200 et routes QR 503 ; libérer explicitement TEST. Dans les PR #112/#114, consigner SHA exacts, codes HTTP, nombres de documents, cas réellement exécutés, captures/vidéo sûres et limites (caméra iOS/Android, reset inter-appareils, concurrence, quotas) sans aucun identifiant sensible.
