# OurFinance

Application Angular PWA de suivi et partage de dépenses. La fondation M1 affiche pour l'instant un écran d'attente ; aucune donnée financière n'est enregistrée.

## Développement local

```sh
npm ci
npm start
npm run typecheck
npm run build
```

Le build de production génère `dist/ourfinance/browser`. Le manifeste et le service worker sont activés pour ce build. Firebase Emulator Suite nécessite le CLI Firebase et Java ; `firebase.json` contient les ports locaux. Les règles Firestore M1 refusent tout accès par défaut.

## Environnements externes

Aucun projet Firebase, Cloudflare ou Cloudinary n'est configuré dans le dépôt. Créer des projets de test isolés avant toute preview ; ne jamais connecter une preview à la production. Les identifiants web publics Firebase peuvent être injectés par une configuration d'environnement future. Garder les secrets Worker et comptes de service hors Git et du navigateur. Aucun workflow de déploiement n'est activé tant que l'environnement de test n'est pas fourni et validé.

Voir [M0](docs/FAISABILITE_M0.md) et le [plan technique](docs/PLAN_TECHNIQUE_V1.md).
