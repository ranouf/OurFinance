# Revue des PR

Ce guide s'applique à chaque PR et à chaque nouveau commit de sa branche.

## Preuves visuelles des PR `[UI]`

- La description du PR contient des captures **réelles de l'application exécutée** sur ordinateur et sur mobile, ainsi qu'une courte vidéo du parcours modifié. Les données montrées sont entièrement fictives. Ajouter les médias ou leurs liens directement dans la description, avec le SHA et l'environnement observés.
- Comparer les captures aux références approuvées et indiquer les écarts résiduels. Une maquette ou une illustration ne remplace jamais une capture de l'interface réelle.
- Les captures et vidéos de validation ne sont jamais ajoutées au dépôt, à l'historique Git ou aux artefacts de compilation. Les conserver hors dépôt et les publier uniquement comme pièces jointes ou liens dans la description du PR. Vérifier que ces liens sont accessibles avant la revue.
- Si les médias requis manquent, garder le PR en brouillon et ne pas le fusionner.

## Interface Angular et composants partagés

- Réutiliser les composants génériques de `src/app/shared/components` avant de créer une variante. Un nouveau composant générique doit présenter ses états utiles dans `/ui/components` : normal, focus, désactivé, chargement, succès et erreur selon son rôle. Vérifier la galerie sur ordinateur et mobile.
- Garder les appels réseau, la persistance et les règles métier dans des services ou utilitaires dédiés. Les composants présentent l’état et transmettent les actions. Placer le balisage et les styles visibles dans des fichiers de template et de style séparés ; ne pas mettre de code d’interface dans `component.ts`.
- Chaque champ possède un libellé explicite et un focus visible au clavier comme à la sélection. Vérifier le contraste du focus sur les variantes claires, sombres et invalides. Aucun contrôle interactif ne doit perdre son indicateur de focus.
- Une erreur de saisie indique le problème en texte, sans s’appuyer sur la couleur seule. Le contrôle invalide porte `aria-invalid`, référence son message par `aria-describedby`, conserve la valeur saisie et permet la correction. Les erreurs de soumission sont annoncées avec `role="alert"` ou un mécanisme équivalent ; le premier champ à corriger reçoit le focus lorsque cela aide le parcours.
- Vérifier les états vide, attente, succès, échec et désactivé des formulaires modifiés. Préserver les traductions FR/EN/JA, les noms accessibles, le parcours clavier et la mise en page à 320, 390 et 1280 px.

## Revue à chaque commit et push

1. Après **chaque commit**, faire réaliser une revue assistée par IA du diff et du PR selon le présent guide, avec le SHA exact. Après **chaque push**, refaire cette revue sur le HEAD distant, même si une revue locale a déjà eu lieu.
2. Vérifier notamment le comportement, la sécurité, les données privées, les traductions, les tests, la validation visuelle et les preuves requises pour `[UI]`. Publier les constats actionnables comme commentaires de revue liés aux lignes concernées.
3. Corriger tous les commentaires actionnables, exécuter les contrôles pertinents, puis marquer les fils corrigés comme **résolus**. Un commentaire n'est résolu qu'après vérification du correctif ; documenter explicitement tout désaccord ou limite restante.
4. Tout nouveau commit ou push relance la revue. Avant fusion squash, vérifier que le HEAD courant a une revue sans commentaire actionnable ouvert, que tous les fils corrigés sont résolus et que le workflow « PR validation » est vert sur ce même SHA.
