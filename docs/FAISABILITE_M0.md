# M0 — état de faisabilité

Le POC de bout en bout n'est pas démontré. Le dépôt ne fournit aucun projet Firebase Spark, compte Cloudflare Worker Free ou compte Cloudinary Free de test. Il serait incorrect de déclarer les coûts, les règles d'accès ou le stockage privé validés.

## Protocole de validation externe

1. Créer trois comptes de test sans données réelles : A et B membres d'un groupe, C extérieur.
2. Configurer un projet Firebase d'essai Spark (Auth et Firestore), un Worker Free et Cloudinary Free avec secrets serveur, sans clé de service dans le navigateur ni dans Git.
3. Vérifier cryptographiquement le jeton Firebase dans le Worker, puis lire l'appartenance courante au groupe. Rejeter C et un membre révoqué.
4. Créer une dépense test avec paiements et allocations équilibrés dans une transaction ; rejeter les sommes incohérentes et les références inter-groupes.
5. Charger une image synthétique en mode Cloudinary `authenticated`. Vérifier qu'une URL publique ne la révèle pas, que A et B peuvent y accéder et que C ne le peut pas. Révoquer B puis retester.
6. Relever les limites et la consommation réelles des trois offres Free. Vérifier sans carte bancaire. Supprimer l'image et les comptes d'essai après mesure.
7. Tester l'export CSV officiel Splitwise avec une fixture synthétique. Toute extension doit rester limitée aux exports exposés et initiés par l'utilisateur.

## Blocages externes

- Identifiants des trois projets de test, origines autorisées et secrets configurés hors dépôt.
- Validation de la disponibilité de l'accès privé Cloudinary `authenticated` sur le compte Free concret.
- Fixture CSV/JSON non sensible pour mesurer la fidélité de l'import.

Ces étapes nécessitent la configuration des fournisseurs. Elles n'empêchent pas le développement local des composants, des règles, du moteur de calcul et de leurs tests.
