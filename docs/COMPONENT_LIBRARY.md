# Bibliothèque de composants Everyday Pop

La galerie Angular est accessible à `/ui/components` avec `npm start`. Elle est chargée à la demande et n'est pas exposée dans le build de production. Elle utilise uniquement des exemples fictifs et ne requiert pas de connexion. Un sélecteur FR/EN/JA dans son menu permet de vérifier chaque langue.

Les composants réutilisables sont dans `src/app/shared/components/`. La galerie présente les fondations visuelles, boutons, badges, chips, alertes, toasts, cartes, champs et contrôles de formulaire, ainsi que les patrons de navigation, listes, tableau, pagination, dialogue, accordéon, états vides et chargement. Les compositions métier montrées en fin de galerie sont des exemples ; elles ne sont pas utilisées par les pages existantes dans cette PR.

Les composants présentent les données et émettent des événements. Les appels Firebase et Worker, les règles d'accès et les calculs métier restent hors de cette bibliothèque. Les contrôles de formulaire utilisent `ControlValueAccessor` ; un champ invalide doit avoir un libellé et lier son erreur par `aria-describedby`.

Le sélecteur générique `UiPeriodRange` expose `range` (`start`, `end` inclusifs au format ISO et `unit`) et `rangeChange`. Il s'ouvre sur l'unité déjà appliquée, ou sur **Jour** par défaut, et propose **Jour**, **Mois** et **Année**. Un seul choix définit une période unique ; un second choix définit une plage. Un mois ou une année s'étend à ses dates de début et de fin. Le panneau s'ouvre sous le champ, se repositionne lors du défilement et se ferme si son champ quitte la vue ; les bornes ont une couleur forte et les dates intermédiaires restent surlignées. `translationPrefix` permet à un hôte de fournir ses libellés via `ngx-translate` ; la galerie emploie `gallery.period`. Le composant reste indépendant des statistiques et n'est utilisé par aucune page métier dans cette PR.

## Vérification

- `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.
- Ouvrir `/ui/components` en FR, EN et JA ; vérifier le clavier, les états interactifs et les largeurs 320, 390 et 1280 px.
- Comparer aux références de `docs/ui-kit/README.md` et consigner tout écart visuel dans le PR avant une adoption par les pages.

Cette PR ne migre aucune page métier. Les pages pourront adopter les composants après validation visuelle de la bibliothèque.
