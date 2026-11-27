# UX V2 — PR 3 : groupes

Statut : maquettes desktop et mobile validées par le propriétaire le 27 novembre 2026 ; intégration en cours. Base : `docs/UX_SPECIFICATION_V2.md`, `docs/INVITATIONS_QR.md` et les références Everyday Pop V2. La page `/groups` existante conserve ses services et permissions ; ce PR réorganise ses parcours.

## Hiérarchie proposée

**Liste → groupe actif → détail → action.** La page ouvre sur la liste de groupes ; sélectionner une carte change le groupe global et affiche son détail. La création est un parcours distinct. Les panneaux de paramètres et d'administration ne précèdent pas la consultation des membres et des comptes.

```text
Ordinateur (1280 px)                      Mobile (390 px) — état liste
┌───────┬──────────────────────────────┐  ┌─────────────────────────┐
│ Menu  │ Mes groupes   [+ Créer]      │  │ En-tête / Mes groupes    │
│       │ ┌─────────┐ ┌──────────────┐ │  │ [Groupe A · CAD]         │
│       │ │ Cartes  │ │ Aperçu actif │ │  │ [Groupe B · EUR]         │
│       │ │ groupes │ │ Solde/devise │ │  │ [+ Créer un groupe]      │
│       │ │         │ │ Onglets      │ │  └─────────────────────────┘
│       │ │         │ │ Aperçu       │ │  Mobile — après sélection
│       │ │         │ │ Membres      │ │  ┌─────────────────────────┐
│       │ │         │ │ Catégories   │ │  │ ← Retour aux groupes    │
│       │ │         │ │ Paramètres   │ │  │ Détail du groupe choisi │
└───────┴─────────┴─┴──────────────┘ │  │ Aperçu / Membres /      │
                                         │ Catégories / Paramètres │
                                         └─────────────────────────┘
```

Sur ordinateur, les cartes restent visibles pendant la consultation du détail. Sur mobile, la liste et le détail sont deux vues successives de la même route, avec un vrai retour, sans panneau latéral hors écran. Les onglets peuvent défiler horizontalement au clavier et au toucher, avec le panneau actif annoncé ; aucun onglet tronqué sans indice de défilement.

## Liste et sélection

- Carte : icône ou illustration du groupe, nom, nombre de membres, devise, solde **personnel** avec libellé et signe, état actif. Un groupe personnel est présenté comme tel ; aucune dette fictive.
- La sélection d'un **groupe actif** synchronise la navigation globale et persiste comme dans le PR 1. Les groupes de devises différentes ne sont jamais additionnés. Les groupes archivés figurent dans une section distincte et ouvrent leur historique en lecture seule, sans devenir groupe actif global. **Au chargement d'une ancienne sélection mémorisée** ou juste après archivage du groupe courant, si celui-ci est devenu archivé, choisir un autre groupe actif accessible ; s'il n'en existe aucun, revenir à l'état sans groupe et désactiver les actions de dépense et d'invitation.
- Erreur de chargement : état explicite et Réessayer. Zéro groupe : illustration, Créer un groupe ou Rejoindre par lien. Chargement : squelette sans faux montant.
- Création : nom et devise obligatoire, icône/couleur/description facultatives, explication du verrouillage de devise après première opération. Le formulaire n'impose aucune répartition initiale. Après succès, ouvrir le nouveau groupe et proposer la première dépense ou une invitation.

## Détail en quatre sections

| Section | Contenu et actions |
|---|---|
| **Aperçu** | Devise, membres, solde personnel, dettes/créances lisibles, lien vers dépenses et équilibrage. Une devise claire même si le solde est nul. |
| **Membres** | Membres actifs et rôles affichés, invitation unique QR/lien/partage, statut, expiration et révocation. Le propriétaire peut révoquer un membre non propriétaire après confirmation. Le même CTA ouvre le QR et la copie du lien. |
| **Catégories** | Catalogue système en lecture seule ; catégories personnalisées modifiables par tout membre actif, avec icône/couleur. Archive et réactivation ; catégories historiques conservées. |
| **Paramètres** | Nom, description, icône/couleur et devise modifiables selon les droits déjà disponibles. Verrouillage de devise expliqué. Le propriétaire peut archiver après confirmation. Le groupe archivé reste visible en lecture seule dans la liste, avec accès à l'export de son historique. |

Le contrat actuel n'expose ni transfert de propriété, ni départ volontaire d'un membre, ni suppression définitive, ni réactivation d'un **groupe** archivé. Ne pas afficher ces actions ; la révocation par le propriétaire est le seul retrait de membre actuellement disponible. La réactivation des **catégories** archivées, elle, reste prévue. Les droits sont contrôlés côté service/Worker et reflétés dans l'interface. Une action indisponible explique sa raison sans donner l'impression d'un bouton cassé. Après une modification, les cartes et l'en-tête se mettent à jour sans rechargement manuel.

## Invitation QR

Le propriétaire voit un CTA « Inviter des membres ». Il choisit une invitation ouverte ou ciblée ; **les deux types sont à usage unique pour un nouvel adhérent**. La modale desktop ou la page mobile affiche sur fond blanc le QR lisible, sa durée, Copier le lien, Partager si disponible et Révoquer. « Remplacer l'invitation » crée un nouveau lien puis révoque l'ancien ; tant que la révocation n'est pas confirmée, l'interface annonce explicitement que l'ancien reste actif et permet de réessayer. Pour plusieurs personnes, créer une invitation distincte par personne. Un lien brut ne figure jamais dans une capture publique. La fermeture rend le focus au déclencheur. La simple consultation ne consomme pas le jeton ; l'acceptation appartient au PR 2.

## Vérifications après validation de la maquette

- Parcours local sur émulateurs : zéro groupe, groupe personnel, groupe partagé, deux devises, création, sélection persistante, affichage des dettes, édition et verrouillage de devise, droits propriétaire/membre/révoqué, catégories, invitations et actions destructrices.
- Playwright aux largeurs 320, 390, 768 et 1280 px ; clavier, focus, nom accessible des onglets, absence de débordement, FR/EN/JA. Captures réelles 1280 × 800 et 390 × 844, plus vidéo courte, dans la description du PR uniquement et jamais dans le dépôt.
- Revue du diff après chaque commit/push, tests de règles et services pertinents, workflow PR Validation vert au SHA fusionné. Validation visuelle du propriétaire avant squash merge.
