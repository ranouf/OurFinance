# Composants partagés

La galerie `/ui/components` montre les composants d’interface réutilisables avec des données fictives. Son `GalleryLayout` fournit une colonne de navigation par composant, avec une mise en page adaptée au mobile. Elle suit les couleurs et espacements Everyday Pop et se vérifie sur ordinateur et mobile.

| Composant | Usage | États montrés |
| --- | --- | --- |
| `app-ui-button` | Actions de formulaire | principal, secondaire, danger, désactivé, chargement |
| `app-ui-field` | Libellé, aide et erreur d’un contrôle natif | texte, courriel invalide, sélection, texte multiligne, focus |
| `app-field` et `app-control-errors` | Libellé et erreurs reliées à un contrôle de formulaire | texte d’aide, courriel invalide, focus |
| `app-input` | Saisies réutilisables avec liaison aux formulaires | texte, nombre, courriel, téléphone, mot de passe, recherche, URL, date, heure |
| `app-select`, `app-textarea`, `app-radio-group` | Sélection et texte multiligne | sélection de devise, description, choix de répartition |
| `app-checkbox`, `app-toggle` | Choix binaires accessibles | activé, désactivé, focus |
| `app-calendar` | Sélection d’une date dans un mois | navigation par mois, date sélectionnée, dates limites |
| `app-ui-alert` | Retour de statut ou d’erreur | information, succès, erreur |
| `app-ui-badge` | État ou montant résumé | neutre, positif, négatif |
| `app-invite-qr-code` | Lien d’invitation représenté par un QR | exemple fictif, copie et partage |
| `app-shell` | Navigation des pages connectées | réservé au `SecuredLayout`, sans seconde colonne dans la galerie |

Les routes de connexion, de l’application connectée et de la galerie utilisent respectivement `AuthenticationLayout`, `SecuredLayout` et `GalleryLayout`. Chaque page est rangée dans son parcours et possède son propre fichier HTML.

Le contrôle projeté dans `app-ui-field` garde son `id` identique à `controlId`. Lorsqu’une erreur est fournie, il porte `aria-invalid="true"` et `aria-describedby="<id>-error"`. Pour une aide sans erreur, `aria-describedby` cible `<id>-hint`. Le composant fournit un focus visible et annonce l’erreur en texte.

Les champs natifs restent utilisables avec les formulaires existants ; les composants de présentation ne contiennent pas de logique de persistance.

Les nouveaux contrôles de formulaire exposent `ControlValueAccessor` et peuvent être liés à un `FormControl`. La galerie démontre leur valeur, leur état invalide et leurs interactions avec des données fictives.
