# M6 — surveillance des quotas Free

Ce protocole concerne d'abord `ourfinance-test` et `ourfinance-api-dev`. Il ne prouve pas que les consommations actuelles sont sous les seuils : les compteurs du projet doivent être lus et datés par une personne ayant accès aux consoles. Ne jamais publier IP, jeton, nom de reçu, montant ou donnée Splitwise dans les relevés.

| Fournisseur | Mesure à relever sur TEST | Source officielle |
| --- | --- | --- |
| Firestore Spark | Plan et édition de la base, lectures/écritures/suppressions de la période, stockage et quotas affichés. Vérifier la période de remise à zéro dans la console plutôt que supposer une fenêtre commune aux autres services. | [Usage et limites](https://firebase.google.com/docs/firestore/quotas), [surveiller l'activité](https://firebase.google.com/docs/firestore/monitor-usage) |
| Cloudflare Workers Free | Requêtes du seul `ourfinance-api-dev`, invocations en erreur, dépassements CPU et proximité de la limite quotidienne du compte. La limite applicative 120 requêtes/60 s par IP ne remplace pas le quota global du plan. | [Limites Workers](https://developers.cloudflare.com/workers/platform/limits/), [métriques et analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) |
| Cloudinary Free | Crédits consommés sur la fenêtre glissante affichée, stockage, bande passante, transformations et éventuels avertissements de la Console. Un HTTP 420/429 ne suffit pas à identifier seul le quota épuisé. | [Suivre les crédits](https://cloudinary.com/documentation/developer_onboarding_faq_track_credits), [méthode Admin API `usage`](https://cloudinary.com/documentation/admin_api) |

## Relevé et réaction

1. Avant un essai TEST important et après son nettoyage, relever date/heure, plan, fenêtre, compteur, limite et pourcentage pour les trois services. Consigner seulement ces agrégats dans [#159](https://github.com/ranouf/OurFinance/issues/159) et le lien de réservation dans [#30](https://github.com/ranouf/OurFinance/issues/30). Une API de lecture peut être utilisée si son droit minimal et son coût sont vérifiés ; sinon utiliser la Console.
2. Proposer un avertissement à **70 %** et une intervention à **90 %** de chaque limite observée. Ce sont des seuils opérationnels à valider sur les compteurs réels, pas des quotas fournisseurs. À 70 %, inspecter la tendance et les fixtures ; à 90 %, suspendre les essais générateurs de trafic, nettoyer les données fictives et vérifier la fenêtre de remise à zéro avant de reprendre.
3. Distinguer `429 rate_limited` (limite par IP du Worker, `Retry-After: 60`) de `503 provider_quota_exceeded` (Firestore/Cloudinary en amont) et des erreurs de plateforme Cloudflare avant exécution du Worker. Ne pas journaliser l'IP ou la réponse brute du fournisseur pour diagnostiquer. Le test réel du premier cas est dans [#30](https://github.com/ranouf/OurFinance/issues/30#issuecomment-6968108757) ; il ne prouve pas les quotas quotidiens.
4. Vérifier dans chaque console s'il existe une alerte compatible avec le plan Free et faire un essai contrôlé de sa réception sans générer une charge coûteuse. Si l'alerte n'est pas disponible ou testable, noter cette limite et désigner un contrôle manuel daté. Un tableau de bord consultable seul ne constitue pas une alerte.

Le [relevé TEST du 18 novembre](https://github.com/ranouf/OurFinance/issues/159#issuecomment-6969817136) donne 2 217 lectures, 488 écritures et 257 suppressions Firestore, ainsi que 2 102 requêtes du seul Worker TEST sur 24 h glissantes ; ces fenêtres ne sont pas les compteurs quotidiens officiels. La [matrice 70/90 %](https://github.com/ranouf/OurFinance/issues/159#issuecomment-6970099335) désigne `ranouf` et un contrôle manuel avant/après essai puis quotidien en campagne. Elle reste une proposition : aucune politique d’alerte ni réception n’a été prouvée. La lecture des politiques Cloudflare et de l’usage Cloudinary a renvoyé 403 avec les droits disponibles ; limites et consommation Cloudinary restent à relever avec une identité autorisée. Le [second relevé TEST](https://github.com/ranouf/OurFinance/issues/159#issuecomment-6972183683) a observé 2 013 requêtes Worker et 0 erreur sur une autre fenêtre glissante de 24 h ; les lectures de politiques Cloudflare et d'usage Cloudinary ont de nouveau répondu 403. Ces chiffres ne remplacent pas un compteur quotidien officiel. Le chemin d’alerte/réception reste ouvert dans #159. Toute politique de production doit être réévaluée avec le plan et les compteurs de l'environnement cible ; aucune promotion de plan payant ni publication production n'est prévue par ce document.

## Relevé chiffré reproductible

Le 27 novembre 2026, les [quotas officiels Firestore](https://firebase.google.com/docs/firestore/quotas) indiquent un reset quotidien vers minuit, heure du Pacifique, et les [limites Workers Free](https://developers.cloudflare.com/workers/platform/limits/) indiquent **100 000 requêtes par compte et jour UTC**. Le [tableau de bord Cloudinary](https://cloudinary.com/documentation/developer_onboarding_faq_track_credits) exprime les crédits sur **30 jours glissants**. Ces trois périodes ne se remplacent pas. Les [alertes Cloudinary](https://cloudinary.com/documentation/programmable_media_asset_usage_data) annoncent un courriel vers environ 90 % de l'allocation, mais leur réception n'a pas été provoquée sur TEST.

Créer un JSON local hors dépôt avec les seuls agrégats suivants et la date UTC du relevé, puis lancer `node tools/quota-monitor/check.mjs chemin/vers/releve.json`. Les champs non mesurés peuvent être omis : ils seront marqués `missing` et la commande retournera 2, jamais un faux résultat vert. Les compteurs quotidiens proviennent des consoles sur **leurs fenêtres propres**, et `cloudflareAccountRequests` doit couvrir le compte entier, pas seulement le Worker TEST.

```json
{
  "recordedAt": "2026-11-27T12:00:00Z",
  "firestoreReads": 2217,
  "firestoreWrites": 488,
  "firestoreDeletes": 257,
  "firestoreStorageBytes": 0,
  "firestoreEgressBytes": 0,
  "cloudflareAccountRequests": 2102,
  "cloudinaryCredits": 0
}
```

Ces nombres sont **un exemple de format, pas un relevé complet validé** ; les zéros ne doivent pas être repris sans lecture de la console. La commande retourne 0 si toutes les métriques sont présentes et sous 90 %, 1 si au moins une atteint 90 %, et 2 si une mesure manque ou est invalide. `warning` commence à 70 %, `intervention` à 90 %. À 90 %, arrêter les essais de charge et uploads fictifs, retirer les routes temporaires, nettoyer les fixtures et reçus orphelins, attendre la fenêtre propre au fournisseur, relever à nouveau, puis seulement reprendre. Une réponse `429 rate_limited` commande d'attendre `Retry-After` ; un `503 provider_quota_exceeded` impose de consulter le fournisseur concerné, sans rejouer aveuglément une restauration incertaine.

Le 27 novembre 2026, la session Google de ce poste ne peut plus renouveler son jeton (`401` Monitoring), et la session Cloudflare locale obtient `401`. Aucun compteur TEST actuel n'est donc déduit de ce script ; #159 reste ouvert tant qu'un relevé daté et un chemin de notification ne sont pas prouvés. Le contrôle quotidien en campagne est attribué au propriétaire du projet, avec relevé avant/après chaque essai générateur de trafic. Ne jamais copier un jeton, une IP, un nom de reçu ou un montant dans ce JSON ni dans un commentaire GitHub.
