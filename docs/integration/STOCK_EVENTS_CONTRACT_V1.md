# Stock — Contrat d'événements V1

## 1. Enveloppe commune

Tous les événements inter-modules critiques doivent partager une enveloppe de ce type :

```ts
interface SpeedArtiIntegrationEvent<T> {
  schemaVersion: "1.0";
  eventId: string;
  idempotencyKey: string;
  companyId: string;
  source: string;
  target: string;
  eventType: string;
  occurredAt: string;
  correlationId?: string | null;
  payload: T;
  metadata?: Record<string, unknown>;
}
```

## 2. Règles

- `eventId` unique.
- `idempotencyKey` stable pour la même action métier.
- `companyId` obligatoire.
- Aucune entité critique créée à partir d'un nom libre.
- Les événements ne remplacent pas les validations métier synchrones.
- Les écritures Stock restent transactionnelles côté serveur.
- Un événement déjà traité ne produit pas de second mouvement.

## 3. Exemples

### Réception commande

```json
{
  "eventType": "commandes.delivery.confirmed",
  "payload": {
    "orderId": "uuid",
    "lines": [
      {
        "lineId": "uuid-ou-index-stable",
        "productId": "uuid",
        "quantity": 20,
        "unit": "piece",
        "locationId": "uuid-depot"
      }
    ]
  }
}
```

Idempotence recommandée :
`order:{orderId}:delivery:{lineId}`.

### Véhicule

```json
{
  "eventType": "parc_materiel.vehicle.updated",
  "payload": {
    "vehicleId": "uuid",
    "name": "Camion couvreur",
    "registration": "AA-123-BB",
    "active": true
  }
}
```

### Disponibilité Chiffrage

```json
{
  "eventType": "chiffrage.stock.availability.requested",
  "payload": {
    "requestId": "uuid",
    "lines": [
      {
        "productId": "uuid",
        "quantity": 12,
        "unit": "piece"
      }
    ]
  }
}
```

Réponse :
`stock.availability.response`.

### Inventaire

```json
{
  "eventType": "stock.inventory.session.completed",
  "payload": {
    "sessionId": "uuid",
    "locationId": "uuid",
    "startedAt": "ISO",
    "completedAt": "ISO",
    "differenceCount": 3
  }
}
```

Aucune correction n'est incluse dans cet événement. La correction est une action distincte et confirmée.

## 4. Commandes vs événements

Commande synchrone :
- vérifier disponibilité ;
- appliquer entrée/sortie/transfert ;
- valider inventaire ;
- réserver.

Événement :
- informer les autres modules ;
- mettre à jour un contexte secondaire ;
- publier un KPI ;
- déclencher une notification.

Ne jamais dépendre d'un simple événement front pour garantir une mutation Stock critique.
