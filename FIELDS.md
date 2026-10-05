# Champs métier — Stock Sprint A

## StockItem

| Champ | Type | Unité | Obligatoire | Source future | Rôle |
|---|---|---|---|---|---|
| `id` | string | — | oui | Stock | Identifiant Stock |
| `companyId` | string | — | oui | SpeedArti | Isolation entreprise |
| `productId` | string/null | — | non démo / oui intégration | Catalogue | Pont produit |
| `name` | string | — | oui | Catalogue / démo | Libellé affiché |
| `family` | string | — | oui | Catalogue / Stock | Famille |
| `internalReference` | string/null | — | non | Catalogue | Référence interne |
| `unit` | enum | explicite | oui | Catalogue | Unité métier |
| `minimumQuantity` | number/null | unité article | non | Stock | Seuil |
| `mainLocationId` | string/null | — | non | Stock | Emplacement principal |
| `supplierId` | string/null | — | non | Catalogue | Fournisseur principal |
| `supplierReference` | string/null | — | non | Catalogue | Référence fournisseur |
| `purchasePriceHt` | number/null | EUR HT | non | Catalogue/Achats | Donnée de coût, pas règle comptable |
| `barcode` | string/null | — | non | Catalogue | Code-barres |
| `photoUrl` | string/null | — | non | Documents/Catalogue | Photo |
| `notes` | string/null | — | non | Stock | Note libre |
| `active` | boolean | — | oui | Stock | Actif/inactif |

**Interdit :** ajouter `currentQuantity` comme seconde source de vérité indépendante.

## StockLocation

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | Identifiant |
| `companyId` | string | Isolation entreprise |
| `name` | string | Nom utilisateur |
| `type` | `depot/atelier/vehicule/chantier/autre` | Type |
| `chantierId` | string/null | Pont chantier si emplacement chantier |
| `vehicleId` | string/null | Pont véhicule |
| `active` | boolean | Actif |

## StockMovement

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | Identifiant mouvement |
| `companyId` | string | Isolation |
| `productId` | string | Article |
| `quantity` | number | Quantité ; signée uniquement pour `ADJUSTMENT` |
| `unit` | enum | Unité explicite |
| `movementType` | enum | `ENTRY/EXIT/TRANSFER/ADJUSTMENT/LOSS/BREAKAGE/SITE_RETURN` |
| `locationFromId` | string/null | Origine |
| `locationToId` | string/null | Destination |
| `chantierId` | string/null | Chantier |
| `userId` | string/null | Acteur |
| `sourceModule` | string | Module d'origine |
| `sourceId` | string/null | Entité source |
| `sourceEventId` | string/null | Idempotence |
| `reason` | string/null | Motif |
| `createdAt` | ISO date | Audit |

## StockReservation

Une réservation ne diminue pas le stock physique.

| Champ | Rôle |
|---|---|
| `quantity` | quantité réservée |
| `status` | `ACTIVE/RELEASED/CONSUMED` |
| `locationId` | emplacement ciblé éventuel |
| `chantierId` | chantier éventuel |
| `sourceModule/sourceId/sourceEventId` | traçabilité |

## StockOffcut

| Champ | Unité | Rôle |
|---|---|---|
| `lengthMm` | mm | boîte englobante |
| `widthMm` | mm | boîte englobante |
| `areaMm2` | mm² | aire réelle |
| `shapeType` | — | rectangle/orthogonal |
| `cells` | mm | géométrie exacte en cellules |
| `contours` | mm | contours exacts |
| `thicknessMm` | mm | épaisseur |
| `grainDirection` | — | fil/décor |
| `parentOffcutId` | — | filiation |
| `sourceProjectId` | — | origine projet |
| `locationId` | — | emplacement |
| `status` | — | available/used/lost |

Pour une chute complexe, la compatibilité de réemploi doit utiliser la géométrie exacte et non seulement `lengthMm × widthMm`.


## Unité secondaire / conditionnement

Le Stock garde **une seule quantité source de vérité** dans l'unité principale de l'article.

La quantité secondaire est calculée à partir de `StockItem.secondary`.

### Modes

#### `length`

Exemple : chevron de 4 m.

```text
unité principale : piece
secondary.mode : length
secondary.secondaryUnit : ml
secondary.lengthMm : 4000
30 pièces = 120 ml
```

#### `area`

Exemple : plaque 2,50 × 1,25 m.

```text
unité principale : piece
lengthMm : 2500
widthMm : 1250
20 pièces = 62,5 m²
```

#### `volume`

Utilise longueur, largeur et épaisseur explicites en millimètres pour produire des m³.

#### `manual`

Pour un conditionnement fabricant ou fournisseur :

```text
1 boîte = 200 pièces
1 sac = 25 kg
1 rouleau = 25 ml
```

Champs :

- `secondaryUnit`
- `quantityPerPrimaryUnit`

### Mouvements saisis dans l'unité secondaire

L'utilisateur peut saisir une entrée, sortie, perte, casse, retour, transfert ou réservation dans l'unité secondaire.

Le service convertit cette quantité dans l'unité principale **avant** d'appeler le moteur.

Exemple :

```text
stock = 4 boîtes
1 boîte = 200 vis
sortie = 30 vis

mouvement enregistré = 0,15 boîte
stock restant = 3,85 boîtes
affichage = 3 boîtes complètes + 170 vis
total secondaire = 770 vis
```

Il n'existe donc jamais deux quantités indépendantes susceptibles de se désynchroniser.
