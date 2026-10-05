# Sprint E — Finalisation V1, alertes et robustesse

Statut : développé dans le dépôt autonome, sans connexion production.

## Complément demandé avant Sprint E

Le modèle article gère désormais un **conditionnement / une unité secondaire calculée**.

Exemples pris en charge :

- 30 chevrons de 4 m → 30 pièces et 120 ml ;
- 4 boîtes de 200 vis → 4 boîtes et 800 vis ;
- 20 plaques de 2,50 × 1,25 m → 20 plaques et 62,5 m² ;
- 8 sacs de 25 kg → 8 sacs et 200 kg ;
- 3 rouleaux de 25 m → 3 rouleaux et 75 ml.

Une sortie peut aussi être saisie dans l'unité secondaire.

Exemple :

```text
4 boîtes × 200 vis = 800 vis
sortie : 30 vis
reste : 770 vis
affichage : 3 boîtes complètes + 170 vis
```

La quantité principale reste la seule source de vérité. La quantité secondaire est calculée.

## Sprint E livré

### Centre d'alertes

Nouvel onglet **Alertes** :

- rupture ;
- stock faible ;
- derniers écarts d'inventaire corrigés.

Les alertes sont calculées à partir du moteur Stock et de l'historique réel de la démo.

### Jeu de démonstration BTP

Bouton **Charger des exemples BTP** visible uniquement quand le stock est vide.

Les exemples couvrent :

- bois à la pièce + ml ;
- vis en boîte + nombre de vis ;
- panneaux à la pièce + m² ;
- sacs + kg ;
- rouleaux + ml ;
- stock faible ;
- rupture ;
- plusieurs emplacements.

Ces données sont des fixtures de démonstration et ne sont jamais des règles métier codées dans le moteur.

### Non-régression

Le lot ajoute des scénarios combinés couvrant :

- unité secondaire ;
- transfert ;
- réservation ;
- libération ;
- sortie ;
- besoin d'achat ;
- alertes ;
- inventaire ;
- données de démonstration.

### Responsive / tactile

Le socle conserve :

- boutons de minimum 44 px pour les actions principales ;
- cartes empilées sur smartphone ;
- formulaires en une colonne sur petits écrans ;
- actions Stock utilisables sans hover ;
- onglets horizontalement défilables ;
- alertes et conditionnements lisibles sur mobile.

## Toujours hors production

Aucun accès en écriture au vrai SpeedArti, GSTAI ou Supabase production.

Les connecteurs réels restent à intégrer ultérieurement par Anne-Sophie.
