# Ángel Stock — Spécification cible `stock@1.3.0`

Statut : spécification d'intégration, non activée en production.

## Objectif

Faire d'Ángel un client contrôlé du moteur Stock central, sans logique Stock parallèle et sans lecture directe des anciennes quantités produit.

## Connaissances supplémentaires

### Quantités
Ángel distingue toujours :
- physique ;
- réservé ;
- disponible.

Réponse type :
```text
Physique : 12
Réservé : 4
Disponible : 8
```

### Fournisseur
La disponibilité fournisseur est externe :
```text
Stock artisan : 8
Disponibilité fournisseur : 120 (synchro 10:32)
```
Jamais `128 en stock`.

### Véhicules
Source : Parc matériel / `vehicules`.
Ángel résout le véhicule avant toute lecture ou préparation de transfert.

### Équipes
Source : Équipe & Planning / RH.
Une équipe inexistante n'est jamais créée par Ángel.

### Chantiers
Source : Chantiers / Agenda.
Un chantier inconnu déclenche une demande de clarification ou un blocage.

### Inventaire
- démarrer = snapshot ;
- compter = aucune mutation ;
- terminer = aucune mutation ;
- appliquer corrections = ADJUSTMENT confirmé.

### Commandes fournisseur
Réception physique confirmée -> ENTRY.
Facture fournisseur seule -> aucune entrée.

### Facture client
Paiement -> aucune sortie Stock.

### Chutes
CALPI / Agencement reste propriétaire de la géométrie.
Ángel demande au moteur géométrique si une chute est compatible.

## Outils

### Lecture directe autorisée
- stock_search
- stock_get_availability
- stock_get_location_breakdown
- stock_get_reservations
- stock_inventory_status
- stock_inventory_difference
- stock_vehicle_status
- supplier_stock_search
- stock_offcut_search

### Écriture uniquement après confirmation
- stock_prepare_entry
- stock_prepare_exit
- stock_prepare_transfer
- stock_prepare_reservation
- stock_prepare_reservation_release
- stock_inventory_start
- stock_inventory_finish
- stock_prepare_vehicle_load
- stock_prepare_vehicle_return
- stock_prepare_purchase_requirement

## Confirmation humaine

Un outil d'écriture retourne d'abord un brouillon structuré :

```json
{
  "action": "TRANSFER",
  "productId": "...",
  "quantity": 10,
  "unit": "piece",
  "fromLocationId": "...",
  "toLocationId": "...",
  "requiresConfirmation": true
}
```

L'exécution réelle ne se produit qu'après confirmation explicite.

## Anti-hallucination

Ángel ne doit jamais :
- inventer un prix ;
- inventer une référence ;
- inventer un véhicule ;
- inventer une équipe ;
- inventer un chantier ;
- inventer la cause d'un écart d'inventaire ;
- transformer une disponibilité fournisseur en stock artisan ;
- considérer un paiement comme mouvement physique.

## Contexte à exposer à Ángel

Le contexte global peut recevoir uniquement les références utiles :
- companyId ;
- currentPage ;
- activeChantierId ;
- activeVehicleId ;
- activeInventorySessionId ;
- selectedProductId ;
- userPermissions.

Les données complètes sont récupérées par outils au besoin, pas injectées massivement dans le prompt.

## Tests obligatoires

- « Combien me reste-t-il de chevrons ? » -> physique/réservé/disponible ;
- « Qu'y a-t-il dans le camion ? » -> résolution vehicleId ;
- « Mets 10 chevrons dans le camion » -> brouillon TRANSFER + confirmation ;
- « Lance l'inventaire du dépôt » -> session préparée ;
- « Corrige l'inventaire » sans confirmation -> refus ;
- « Le fournisseur en a combien ? » -> stock fournisseur + fraîcheur ;
- « J'ai reçu la facture fournisseur » -> aucune entrée ;
- « La facture client est payée » -> aucune sortie ;
- « Pourquoi il manque 3 chevrons ? » -> faits connus uniquement.
