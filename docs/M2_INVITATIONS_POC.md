# M2 — Invitations à usage unique : protocole de test

Les routes Worker `POST /groups/{groupId}/invitations` et `POST /groups/{groupId}/invitations/{invitationId}/accept` sont **désactivées par défaut**. Leur activation exige `ENABLE_INVITATION_POC=true` et `INVITATION_POC_GROUP_ID` égal à un seul groupe entièrement fictif. Le Worker et le projet Firebase de test sont les seules cibles autorisées pour ce POC.

L'auteur doit avoir un jeton Firebase valide, une adresse vérifiée et le rôle `owner` actif dans le groupe. Le corps de création accepte `{ "targetEmail": "..." }` ou `{}`. La réponse 201 donne un `invitationId`, un jeton opaque de 256 bits et une expiration à 72 heures. **Ne jamais placer le jeton dans une URL, un journal, un PR ou un fichier suivi.** Seul son SHA-256 est enregistré dans Firestore. Le lien utilisateur à partager et son interface restent à concevoir ; l'essai utilise le jeton dans le corps JSON de l'acceptation.

Le destinataire doit aussi être connecté avec un courriel confirmé. La route d'acceptation prend `{ "token": "..." }` et répond 204 après avoir changé le statut de l'invitation et créé ensemble le membre actif et sa référence personnelle de groupe. Elle doit refuser un autre courriel, un jeton faux ou expiré, une seconde acceptation et un compte déjà révoqué.

## Essai réel depuis la session locale

1. Déployer le commit de la PR uniquement sur `ourfinance-api-dev` et confirmer `GET /health = 200`. Créer un groupe fictif actif, un propriétaire fictif vérifié et deux destinataires fictifs vérifiés. Garder le jeton et les ID tokens uniquement dans les outils locaux sécurisés.
2. Activer temporairement les deux variables POC pour ce seul groupe. Créer une invitation liée au courriel du premier destinataire ; vérifier 201, expiration et présence du hash, sans jeton en clair dans Firestore.
3. Vérifier que le propriétaire révoqué, un membre ordinaire et un tiers ne peuvent créer d'invitation. Vérifier qu'un autre courriel et un faux jeton ne peuvent accepter l'invitation.
4. Accepter avec le premier destinataire : attendre 204 et vérifier le membre, la référence personnelle et le statut `accepted`. Rejouer exactement la même invitation : attendre 403. Tester une invitation expirée, puis un ancien membre révoqué.
5. Vérifier les lectures Firestore par membre actif, tiers et membre révoqué. Nettoyer **toutes** les invitations, membres, références personnelles, groupe et comptes fictifs ; contrôler l'absence de résidus. Retirer `ENABLE_INVITATION_POC` et `INVITATION_POC_GROUP_ID`.

Les tests unitaires simulent les lectures et écritures Firestore. Ils ne prouvent pas encore les conflits de transaction, les quotas ou le comportement réel du runtime Cloudflare. La route doit rester désactivée après l'essai et les PR en brouillon jusqu'aux contrôles requis.
