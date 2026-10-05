# Architecture — Stock Sprint A

## Règle absolue

Le moteur métier ne dépend ni de React, ni de Supabase, ni d'un dépôt SpeedArti réel.

```text
UI future
  ↓
StockService / StockEngine
  ↓
StockRepository
  ↓
Adaptateur local / futur adaptateur SpeedArti
```

## Entités

- `StockItem` : rattachement métier à un produit, unité, seuil et métadonnées Stock.
- `StockLocation` : dépôt, atelier, véhicule, chantier ou autre.
- `StockMovement` : vérité historique de toute variation physique.
- `StockReservation` : quantité réservée sans sortie physique.
- `InventorySession` : comptage et écart d'inventaire.
- `StockOffcut` : chute réutilisable avec géométrie exacte.
- `StockAlert` : signal métier, diffusé plus tard par le Centre de notifications.

## Quantités

```text
physicalQuantity = somme des effets des mouvements
reservedQuantity = somme des réservations ACTIVE
availableQuantity = physicalQuantity - reservedQuantity
```

Un transfert modifie les quantités par emplacement mais ne modifie pas le stock total entreprise.

## Idempotence

Toute action provenant d'un autre module peut porter `sourceEventId`.

Un `sourceEventId` déjà traité est refusé avec `DUPLICATE_EVENT`.

Cette règle évite une double sortie lors d'une répétition réseau.

## Connecteurs

Le moteur ne connaît pas les implémentations réelles des autres modules.

Il connaît uniquement leurs contrats.

Les adaptateurs réels seront ajoutés plus tard dans `src/stock/adapters/speedarti/`.

## Équipe & Planning

Le code GitHub observé utilise déjà :

- `team_planning.material.availability.requested`
- `team_planning.stock_exit.draft.requested`
- réponse `stock.availability.response`
- enveloppe versionnée avec `schemaVersion`, `eventId`, `eventType`, `source`, `target`, `companyId`, `occurredAt`, `correlationId`, `idempotencyKey`, `payload`, `metadata`.

Le Stock Sprint A reprend cette forme d'enveloppe afin d'éviter une traduction inutile lors de l'intégration.

## Chutes

Une chute complexe n'est jamais réduite à son rectangle englobant pour décider d'un réemploi.

Le modèle conserve :

- `shapeType`
- `cells`
- `contours`
- `areaMm2`
- `lengthMm`
- `widthMm`
- `parentOffcutId`
- `grainDirection`
- `status`

`lengthMm` et `widthMm` restent des dimensions de boîte englobante pour compatibilité.

## Ángel

Ángel est une couche d'interprétation et de préparation.

Il n'est jamais la source de vérité.

```text
phrase artisan
↓
intention structurée
↓
recherche dans les données réelles
↓
proposition
↓
validation humaine si écriture
↓
StockEngine
```

## Caméra / OCR futur

Réserve d'architecture uniquement :

```text
photo
→ détection / quantité estimée
→ code-barres ou OCR
→ identification réelle
→ proposition
→ confirmation
→ StockEngine
```

Aucune dépendance caméra, OCR ou vision n'est incluse dans le Sprint A.
