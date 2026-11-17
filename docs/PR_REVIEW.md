# Revue des PR

Ce guide s'applique à chaque PR et à chaque nouveau commit de sa branche.

## Preuves visuelles des PR `[UI]`

- La description du PR contient des captures **réelles de l'application exécutée** sur ordinateur et sur mobile, ainsi qu'une courte vidéo du parcours modifié. Les données montrées sont entièrement fictives. Ajouter les médias ou leurs liens directement dans la description, avec le SHA et l'environnement observés.
- Comparer les captures aux références approuvées et indiquer les écarts résiduels. Une maquette ou une illustration ne remplace jamais une capture de l'interface réelle.
- Les captures et vidéos de validation ne sont jamais ajoutées au dépôt, à l'historique Git ou aux artefacts de compilation. Les conserver hors dépôt et les publier uniquement comme pièces jointes ou liens dans la description du PR. Vérifier que ces liens sont accessibles avant la revue.
- Si les médias requis manquent, garder le PR en brouillon et ne pas le fusionner.

## Revue à chaque commit et push

1. Après **chaque commit**, faire réaliser une revue assistée par IA du diff et du PR selon le présent guide, avec le SHA exact. Après **chaque push**, refaire cette revue sur le HEAD distant, même si une revue locale a déjà eu lieu.
2. Vérifier notamment le comportement, la sécurité, les données privées, les traductions, les tests, la validation visuelle et les preuves requises pour `[UI]`. Publier les constats actionnables comme commentaires de revue liés aux lignes concernées.
3. Corriger tous les commentaires actionnables, exécuter les contrôles pertinents, puis marquer les fils corrigés comme **résolus**. Un commentaire n'est résolu qu'après vérification du correctif ; documenter explicitement tout désaccord ou limite restante.
4. Tout nouveau commit ou push relance la revue. Avant fusion squash, vérifier que le HEAD courant a une revue sans commentaire actionnable ouvert, que tous les fils corrigés sont résolus et que le workflow « PR validation » est vert sur ce même SHA.
