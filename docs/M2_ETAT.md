# M2 — comptes et groupes : état

Le SDK Auth fournit inscription email/mot de passe, vérification de l'email, connexion Google, réinitialisation et déconnexion. Le service reste non branché à l'interface tant que le projet Firebase de test n'est pas fourni. Aucun parcours de connexion n'est annoncé comme opérationnel.

Les Firestore Rules autorisent les lectures d'un groupe uniquement si le membre courant a le statut `active`, y compris les sous-collections. Les écritures métier et d'invitation sont refusées au client. Une route Worker avec vérification cryptographique du jeton, validation et transaction atomique reste nécessaire pour créer un groupe, accepter une invitation à usage unique, retirer un membre et écrire les opérations financières. Les règles seules ne suffisent pas à réaliser ces parcours.

Validation à réaliser avec Emulator Suite : lectures et écritures inter-groupes, membre révoqué, collection group, préférences personnelles, création de groupe et invitations. Les tests seront intégrés avec une version sécurisée des routes Worker ; le critère de fin M2 reste ouvert.

Une suite Emulator Suite est ajoutée, mais son exécution locale est bloquée par le téléchargement du binaire Firestore Emulator (`cloud-firestore-emulator-v1.22.0.jar`) dans cet environnement. La CI peut la lancer sur un runner ayant accès au téléchargement ; le résultat n'est pas présumé.
