# M6 — protocole d'essai intégré V1 sur TEST

Statut : **à exécuter sur un SHA intégré publié**. Les essais des PR sources ne valident pas automatiquement leur assemblage. Ce protocole complète les essais ciblés de M6_TEST_RESTAURATION_REEL.md et M6_E2E_SMOKE.md.

## Préparation

1. Réserver exclusivement la pile ourfinance-test Hosting/Firestore et ourfinance-api-dev dans l'issue #30. Indiquer le SHA complet du commit intégré, le PR et les routes nécessaires. Aucun déploiement concurrent.
2. Vérifier le diff, les secrets, les médias privés et les artefacts ; confirmer CI verte, typechecks Angular/Worker, build, tests Node/Worker/Rules et règles/index du SHA déployé.
3. Déployer seulement ce SHA sur TEST. Avant activation, vérifier /health 200 et routes POC 503. Activer temporairement les seules routes requises pour un groupe fictif selon leurs protocoles. Ne jamais écrire de token, mot de passe ou secret dans une issue ou PR.
4. Préparer des comptes fictifs : propriétaire, membre actif, tiers. Révoquer ensuite le second membre avec son jeton encore valide. Utiliser seulement des noms, montants, groupes et reçus synthétiques.

## Parcours et résultats attendus

| Domaine | Contrôle |
|---|---|
| M1/M2 | Connexion email, modes inscription/récupération sans envoyer de courriel réel, création d'un groupe CAD sans partage par défaut, états zéro groupe et groupes de 1/2/3 membres. Invitation QR/lien sur le protocole `M2_TEST_INVITATIONS_QR_REEL.md` : aperçu authentifié sans écriture, confirmation explicite, usage unique, révocation et refus du tiers. Masquer tout QR et lien actif dans les preuves. |
| Devise | CAD accepté pour dépense, remboursement et import dans CAD ; JPY refusé sans écriture ni activité. Verrou après première opération même supprimée. Un groupe JPY séparé n'est jamais additionné au CAD. |
| M3 | Cinq modes totalisant exactement 101 unités mineures sur une fixture adaptée, préférence auteur/groupe restaurée après rechargement, historique paginé et recherche au-delà de la première page, filtres catégorie/participant. Édition/suppression auteur actif acceptée ; autre membre/tiers/révoqué refusés. |
| Reçus | PNG fictif uploadé ; propriétaire et membre actif 200, tiers/révoqué 403, URL Cloudinary non signée 401. Après suppression logique de la dépense, reçu non lisible et asset nettoyé. |
| M4 | Remboursement dans la devise du groupe ; distinguer payé, part attribuée, écart des paiements et solde après règlement. Dropdown Jours/Mois/Années : bornes inclusives, Annuler sans effet et Appliquer. Graphiques catégories/membres/temps cohérents en FR/EN/JA. |
| M5 | Import CSV synthétique avec provenance et devise incompatible : aperçu, mapping, rapprochement, doublons et annulation depuis le panneau. L'import d'une sauvegarde JSON Splitwise arbitraire n'a pas de schéma vérifié et reste ouvert. Export CSV/JSON/ZIP V1, puis sauvegarde ZIP V2 avec reçu et préférences. Manifeste et hachages vérifiés ; archive altérée et client_partial refusés. |
| M6 | Preview propriétaire 200 sans changement Firestore, membre/révoqué/tiers 403. Nom exact requis avant remplacement du groupe d'origine ; après restauration 200, vérifier auteurs, montants, commentaires, préférences et reçu privé, puis les refus révoqué/tiers. |
| UX/PWA | Examiner Connexion, Groupes, Dépenses, Soldes, Statistiques et Export/Restauration à 320/390/768/1280 px en FR/EN/JA. Contrôler focus clavier, libellés, navigation basse, absence de débordement, états vide/chargement/erreur, marque et illustrations Everyday Pop, manifeste, icônes et taille du bundle. Vérifier sur Hosting TEST `Referrer-Policy: no-referrer` et `X-Content-Type-Options: nosniff`, y compris sur `/join`. |

## Nettoyage et compte rendu

- Supprimer assets Cloudinary, documents et sous-collections Firestore, comptes fictifs et archives locales. Vérifier zéro fixture résiduelle.
- Retirer les variables POC, recontrôler /health 200, routes POC 503 et libérer explicitement TEST dans l'issue #30.
- Dans le PR d'intégration : SHA exact, codes HTTP, totaux comptables, langues/largeurs examinées, captures et vidéo de l'application avec données fictives, limites réellement non testées. Aucun média de validation dans Git. Ne pas attribuer un essai à un SHA modifié ensuite.
- Les pannes réelles Cloudinary/Firestore, l'interruption/reprise, une archive >20 Mo, Safari/iOS et les quotas restent à valider distinctement avant toute production. Une fusion squash de la consolidation compatible est autorisée après CI et essai intégré ; elle ne déclenche aucun déploiement production.
