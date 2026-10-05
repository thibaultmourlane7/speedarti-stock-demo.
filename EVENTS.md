# Événements Stock — contrat 1.0

## Enveloppe commune

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt-...",
  "eventType": "stock.movement.created",
  "source": "stock",
  "target": "notifications",
  "companyId": "company-...",
  "occurredAt": "ISO-8601",
  "correlationId": null,
  "idempotencyKey": "company:event:id",
  "payload": {},
  "metadata": {}
}
```

La forme est volontairement compatible avec l'enveloppe observée dans Équipe & Planning.

## Entrants préparés

- `team_planning.material.availability.requested`
- `team_planning.stock_exit.draft.requested`
- `chiffrage.stock.availability.requested`
- `chiffrage.stock.reservation.requested`
- `chiffrage.stock.reservation.release.requested`
- `chantier.stock.exit.requested`
- `chantier.stock.return.requested`
- `material.offcut.created`
- `material.offcut.consume.requested`
- `commandes.delivery.confirmed`
- `factures_fournisseurs.stock_entry.draft.requested`
- `angel.stock.action.draft.requested`

## Sortants préparés

- `stock.availability.response`
- `stock.exit.draft.ready`
- `stock.movement.created`
- `stock.reservation.created`
- `stock.reservation.released`
- `stock.low_level.detected`
- `stock.out_of_stock.detected`
- `stock.inventory.difference_detected`
- `stock.purchase_requirement.created`
- `stock.offcut.available`
- `stock.offcut.consumed`
- `stock.pilotage.kpi.updated`

## Validation humaine

Les événements qui décrivent une **proposition** d'écriture ne sont jamais assimilés à une écriture réelle.

Exemple :

```text
team_planning.stock_exit.draft.requested
→ stock.exit.draft.ready
→ validation humaine
→ mouvement EXIT
```

Même règle pour Ángel, facture fournisseur/OCR futur et vision future.
