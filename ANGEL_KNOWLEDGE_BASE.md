# Base de connaissances Ángel — Stock

## Règle transversale SpeedArti

Le Stock ne crée **aucune seconde base Ángel**.

Il fournit un **pack global `stock@1.0.0`** destiné à enrichir la Base de connaissances Ángel centrale.

Chaque future évolution Stock doit enrichir ce pack.

## Priorité des sources

1. données Stock réelles autorisées ;
2. identité Produit/Catalogue réelle ;
3. données Chantier/Équipe & Planning réelles ;
4. connaissances Stock validées et versionnées ;
5. connecteurs externes autorisés ;
6. raisonnement IA.

L'IA ne remplace jamais une donnée réelle.

## Intentions initiales

- `rechercher_produit`
- `connaitre_stock`
- `connaitre_disponibilite`
- `rechercher_emplacement`
- `rechercher_stock_faible`
- `rechercher_ruptures`
- `rechercher_chantier`
- `preparer_entree`
- `preparer_sortie`
- `preparer_transfert`
- `preparer_ajustement`
- `reserver`
- `liberer_reservation`
- `rechercher_chute`

## Vocabulaire initial

Le vocabulaire sert au **routage et à la recherche**, jamais à imposer une référence.

Exemples :

- BA13, placo, plaque de plâtre ;
- chevron, liteau, volige, lambourde, tasseau, panne ;
- OSB, MDF, contreplaqué ;
- vis, cheville ;
- tuile, ardoise ;
- isolant, laine de verre, laine de roche ;
- sac, boîte, rouleau, palette ;
- dépôt, atelier, camion, fourgon, chantier.

## Dimensions

Expressions à comprendre :

- `80x70`
- `80 × 70`
- `80 par 70`
- `80/70`
- `80 mm par 70 mm`

Règle absolue :

**ne jamais supposer que `8x7` signifie `80x70 mm`.**

Si l'unité ou l'échelle est ambiguë, Ángel demande confirmation.

## Exemples

### Lecture

> Combien il me reste de BA13 ?

Ángel recherche les références correspondant à la demande et répond à partir du Stock réel autorisé.

### Sortie

> Sors 8 chevrons 80 par 70 pour Dupont.

Ángel :

1. structure la demande ;
2. recherche les références réelles ;
3. recherche le chantier ;
4. vérifie la disponibilité ;
5. prépare un brouillon ;
6. demande confirmation ;
7. le moteur Stock applique après validation.

### Réception

> J'ai reçu 20 sacs de colle.

Si plusieurs références existent, demander laquelle.

Aucune entrée n'est validée simplement parce qu'une phrase contient une quantité.

### Fournisseur futur

> Idea Bois a du chevron 80x70 ?

Cette question interrogera la **disponibilité fournisseur**, distincte du Stock artisan.

## Permissions

Ángel respecte les mêmes droits que l'utilisateur.

Un utilisateur sans `stock.adjust` ne peut pas contourner ce droit en demandant l'ajustement à Ángel.

## Caméra/OCR futur

Les détections vision/OCR seront des **propositions**, jamais une source d'écriture automatique.

```text
vision/OCR
→ proposition structurée
→ correspondance produit réelle
→ confirmation
→ StockEngine
```
