# Sprint D — Réservations, besoins d'achat et connecteurs fonctionnels

Statut : développé dans le dépôt de démonstration autonome, sans raccordement production.

## Périmètre livré

- réservation visible de stock pour un chantier ;
- séparation physique / réservé / disponible conservée ;
- libération manuelle d'une réservation ;
- chantier obligatoire pour une réservation créée depuis l'interface ;
- motif de réservation tracé ;
- bouton `Réapprovisionner` sur les articles ;
- création d'un **besoin d'achat brouillon** ;
- aucun ordre fournisseur créé dans Stock ;
- liste des besoins préparés pour le futur module Commandes / Achats ;
- compteur de réservations actives ;
- compteur de besoins d'achat brouillons ;
- pont d'intégration local pour Équipe & Planning et Chiffrage ;
- demandes de disponibilité réellement calculées par le moteur Stock ;
- demandes de sortie Équipe & Planning préparées en brouillon ;
- demandes de réservation Chiffrage préparées en brouillon ;
- aucune écriture automatique provenant d'un connecteur ;
- aucune connexion au vrai SpeedArti ou à Supabase production.

## Règle source de vérité

### Réservation

```text
stock physique = quantité réellement possédée
stock réservé = quantité affectée à un besoin
stock disponible = physique - réservé
```

Une réservation n'est pas une sortie.

### Réapprovisionnement

Le Stock peut dire :

> il faut préparer l'achat de X unités de l'article Y.

Mais il ne devient jamais le moteur de commandes.

```text
Stock
→ besoin d'achat brouillon
→ futur connecteur Commandes / Achats
→ validation humaine
→ commande fournisseur
```

Le Sprint D n'envoie aucune commande réelle.

## Équipe & Planning

Le pont local sait traiter :

- `team_planning.material.availability.requested`
- `team_planning.stock_exit.draft.requested`

La disponibilité est calculée à partir du vrai moteur de la démo.

Une demande de sortie retourne un brouillon avec `validationRequired: true`.

**Aucun mouvement EXIT n'est créé automatiquement.**

## Chiffrage

Le pont local sait traiter :

- `chiffrage.stock.availability.requested`
- `chiffrage.stock.reservation.requested`
- `chiffrage.stock.reservation.release.requested`

Une demande de réservation provenant du Chiffrage reste un brouillon.

Le Stock répond notamment avec :

- stock physique ;
- stock réservé ;
- stock disponible ;
- possibilité ou non de réserver ;
- validation humaine requise.

## Persistance démo

Le stockage local passe au schéma interne v2.

La migration accepte les anciennes données v1 et ajoute simplement :

- `purchaseRequirements: []`

Les articles, emplacements, mouvements, réservations et chutes déjà présents sont conservés.

## Hors Sprint D

- vraie connexion Équipe & Planning ;
- vraie connexion Chiffrage ;
- vraie connexion Commandes / Achats ;
- validation automatique d'un brouillon externe ;
- consommation automatique d'une réservation ;
- fournisseur connecté ;
- caméra / OCR / vision ;
- Supabase production ;
- modification du vrai code SpeedArti.

L'intégration production restera du ressort d'Anne-Sophie.
