# Plan de tests — état Sprint C

Commande :

```bash
npm run check
```

## Contrats Sprint A

- enveloppe compatible Équipe & Planning ;
- garde-fou Ángel `8x7` ;
- pack Ángel et validation humaine ;
- permissions côté métier ;
- connecteurs production désactivés.

## Moteur Stock

- entrée puis sortie ;
- stock négatif interdit ;
- transfert conserve le total entreprise ;
- réservation distincte du stock physique ;
- idempotence ;
- unité incompatible refusée ;
- libération de réservation ;
- ajustement négatif impossible s'il crée un stock négatif ;
- seuil faible et rupture.

## Sprint B applicatif

- `Dépôt principal` créé une seule fois ;
- création d'article avec quantité initiale = mouvement `ENTRY` ;
- entrée et sortie passent par le moteur métier ;
- sortie supérieure au disponible refusée ;
- recherche partielle insensible à la casse et aux accents.

## Sprint C

- transfert entre deux emplacements ;
- le transfert conserve le total entreprise ;
- quantité physique par emplacement ;
- perte et casse diminuent le stock ;
- retour chantier augmente le stock de destination ;
- inventaire compare théorique et compté ;
- écart d'inventaire génère un mouvement `ADJUSTMENT` ;
- aucun mouvement si l'écart est nul ;
- correction refusée si elle rend le stock disponible négatif face à une réservation ;
- inventaire par emplacement ;
- historique origine / destination / motif / chantier ;
- compilation navigateur de l'interface Sprint C.

Le résultat de référence est celui du dernier workflow GitHub Actions associé au commit Sprint C.


## Sprint D

- réservation diminue le disponible sans diminuer le physique ;
- libération de réservation restitue le disponible ;
- réservation supérieure au disponible refusée ;
- chantier obligatoire pour une réservation créée depuis l'interface ;
- motif de réservation conservé ;
- besoin d'achat brouillon sans mouvement Stock ;
- quantité de réapprovisionnement nulle refusée ;
- disponibilité Équipe & Planning calculée depuis le moteur réel de la démo ;
- sortie demandée par Équipe & Planning reste un brouillon sans mouvement ;
- réservation demandée par Chiffrage reste un brouillon sans réservation automatique ;
- migration du stockage local v1 vers v2 sans perte des données existantes ;
- compilation navigateur des nouveaux écrans réservations / achats.

Le résultat de référence est celui du dernier workflow GitHub Actions du Sprint D.


## Conditionnements / unités secondaires

- 30 chevrons de 4 m = 120 ml ;
- 4 boîtes de 200 vis = 800 pièces ;
- 20 plaques de 2,50 × 1,25 m = 62,5 m² ;
- 8 sacs de 25 kg = 200 kg ;
- sortie de 30 vis sur 4 boîtes de 200 = 770 vis restantes ;
- unité secondaire identique à l'unité principale refusée ;
- les mouvements saisis en unité secondaire sont convertis avant le moteur.

## Sprint E

- chargement du jeu de démonstration uniquement sur stock vide ;
- démo BTP avec plusieurs conditionnements ;
- détection stock faible ;
- détection rupture ;
- conservation des écarts d'inventaire corrigés dans l'onglet Alertes ;
- scénario non-régression combinant unité secondaire, transfert, réservation, libération, sortie et besoin d'achat ;
- compilation navigateur avec l'onglet Alertes et le chargement de démo ;
- responsive conservé via les règles mobile/tablette du CSS.

Résultat de référence actuel : **44 tests réussis sur 44**.


## Sprint F — Stocks fournisseurs

- séparation disponibilité fournisseur / stock artisan ;
- recherche par désignation et référence ;
- recherche multi-fournisseur ;
- plusieurs références fournisseur pour un même produit SpeedArti ;
- statuts disponible, faible, rupture, sur commande et inconnu ;
- fraîcheur de synchronisation ;
- donnée périmée détectée ;
- fournisseur indisponible ignoré sans bloquer les autres ;
- brouillon devis soumis à validation ;
- brouillon commande destiné à Commandes / Achats ;
- aucune mutation du stock artisan lors d'une recherche fournisseur.
