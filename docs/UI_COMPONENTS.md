# Composants partagés

La galerie `/ui/components` montre les composants d’interface réutilisables avec des données fictives. Son `GalleryLayout` fournit une colonne de navigation par composant, avec une mise en page adaptée au mobile. Elle suit les couleurs et espacements Everyday Pop et se vérifie sur ordinateur et mobile.

| Composant | Usage | États montrés |
| --- | --- | --- |
| `app-ui-button` | Actions de formulaire | principal, secondaire, danger, désactivé, chargement |
| `app-ui-field` | Libellé, aide et erreur d’un contrôle natif | texte, courriel invalide, sélection, texte multiligne, focus |
| `app-ui-alert` | Retour de statut ou d’erreur | information, succès, erreur |
| `app-ui-badge` | État ou montant résumé | neutre, positif, négatif |
| `app-invite-qr-code` | Lien d’invitation représenté par un QR | exemple fictif, copie et partage |
| `app-shell` | Navigation des pages connectées | réservé au `SecuredLayout`, sans seconde colonne dans la galerie |

Les routes de connexion, de l’application connectée et de la galerie utilisent respectivement `AuthenticationLayout`, `SecuredLayout` et `GalleryLayout`. Chaque page est rangée dans son parcours et possède son propre fichier HTML.

Le contrôle projeté dans `app-ui-field` garde son `id` identique à `controlId`. Lorsqu’une erreur est fournie, il porte `aria-invalid="true"` et `aria-describedby="<id>-error"`. Pour une aide sans erreur, `aria-describedby` cible `<id>-hint`. Le composant fournit un focus visible et annonce l’erreur en texte.

Les champs natifs restent utilisables avec les formulaires existants ; les composants de présentation ne contiennent pas de logique de persistance.
