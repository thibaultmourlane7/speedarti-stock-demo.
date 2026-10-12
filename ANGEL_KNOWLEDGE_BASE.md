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


## Stocks fournisseurs — Sprint F

Le pack Ángel Stock passe à **`stock@1.1.0`**.

Nouvelle intention :

- `rechercher_stock_fournisseur`

### Règle d'accès

Ángel ne lit jamais directement les tables d'un ERP ou d'un fournisseur.

```text
Question utilisateur
→ Ángel
→ AngelSupplierSearchService
→ SupplierStockService
→ adaptateurs fournisseur autorisés
→ réponse structurée
```

La réponse peut contenir uniquement les données réellement retournées :

- fournisseur ;
- référence fournisseur ;
- désignation ;
- disponibilité ;
- unité ;
- statut ;
- dépôt éventuel ;
- fraîcheur ;
- date de dernière synchronisation.

Si une donnée manque, Ángel indique qu'elle est inconnue.

Si aucune référence ne correspond, Ángel répond qu'aucune disponibilité n'a été trouvée. Il n'invente ni référence, ni quantité.

### Séparation du stock artisan

Une réponse fournisseur ne doit jamais être formulée comme du stock possédé par l'artisan.

Exemple correct :

> Idea Bois — démo indique 180 pièces disponibles, donnée fraîche. Cette disponibilité appartient au fournisseur.

Exemple interdit :

> Tu as 180 pièces en stock.

### Choix fournisseur

Si plusieurs fournisseurs correspondent, Ángel peut les présenter mais ne choisit pas automatiquement « le meilleur » sans règle commerciale validée.

### Actions

La recherche Ángel reste une lecture.

Une demande de devis ou de commande utilise ensuite les brouillons dédiés, avec validation humaine obligatoire.


## Sprint G.2 — inventaire, véhicules et destinations

Le pack Ángel Stock passe à **`stock@1.2.0`**.

### Sources de vérité

Ángel doit respecter cette hiérarchie :

| Donnée | Source de vérité |
|---|---|
| Véhicules / engins | Parc matériel / Paramètres SpeedArti |
| Équipes | Équipe & Planning |
| Chantiers / interventions | Agenda / Chantier |
| Identité produit | Catalogue |
| Quantités / emplacements / mouvements | Stock |
| Diffusion des alertes | Notifications |
| KPI | Pilotage en lecture |

Ángel ne recrée aucune de ces entités dans Stock.

### Nouvelles intentions

- `stock_vehicle_status`
- `stock_vehicle_load`
- `stock_vehicle_return`
- `stock_inventory_create`
- `stock_inventory_status`
- `stock_inventory_difference`
- `stock_inventory_finish`
- `stock_material_destination`

### Véhicules

> Qu'est-ce qu'il y a dans le camion couvreur ?

Ángel doit :

1. résoudre le véhicule via Parc matériel ;
2. récupérer son `vehicleId` ;
3. lire l'emplacement Stock lié à ce `vehicleId` ;
4. restituer uniquement les quantités réellement connues.

> Mets 10 chevrons dans le camion couvreur.

Ángel prépare un seul mouvement :

```text
Dépôt principal
→ véhicule reçu de Parc matériel
10 chevrons
TRANSFER
```

Puis demande confirmation humaine.

Ángel ne crée jamais un véhicule manquant.

### Inventaire

> Lance l'inventaire du dépôt.

Ángel peut préparer une session d'inventaire datée.

Le lancement fige le stock théorique à l'instant de création de la session.

Le comptage physique :

- est sauvegardé article par article ;
- ne modifie jamais le Stock pendant la saisie ;
- peut être repris plus tard.

`Terminer l'inventaire` ne crée toujours aucun mouvement.

Seule l'action humaine **Appliquer les corrections** produit les `ADJUSTMENT`.

> Pourquoi j'ai trois chevrons d'écart ?

Ángel peut citer :

- quantité théorique figée ;
- quantité comptée ;
- écart ;
- mouvements connus autour de la période.

Si la cause n'est pas démontrable, Ángel doit répondre qu'elle est inconnue.

### Destination d'une sortie

La destination et le type de mouvement sont distincts.

- véhicule → `TRANSFER` vers un véhicule Parc matériel ;
- chantier → sortie liée à un chantier réellement reçu ;
- équipe → sortie liée à une équipe réellement reçue d'Équipe & Planning ;
- casse → `BREAKAGE` ;
- perte → `LOSS` ;
- retour → `SITE_RETURN` ou transfert selon l'emplacement physique réel.

### QR / code-barres

Le QR n'est pas un deuxième workflow.

```text
QR / code-barres / Ángel / bouton interface
→ mêmes opérations métier Stock
→ mêmes contrôles
→ même historique
```

Un code scanné peut identifier le contexte ou préparer l'action, mais il ne contourne jamais la validation humaine.
