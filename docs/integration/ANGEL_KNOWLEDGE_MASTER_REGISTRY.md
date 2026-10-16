# Ángel — Registre maître des connaissances modules

## Principe

Ángel reste un assistant global unique.

Chaque module apporte un pack de connaissances versionné. Aucun module ne crée une IA parallèle ou une seconde base runtime.

## Registre actuel / prévu

| Domaine | Pack actuel / cible | Statut |
|---|---|---|
| Stock | `stock@1.2.0` -> cible `stock@1.3.0` | très avancé |
| Équipe & Planning | pack global module | avancé |
| ANC | base métier V3 | avancé |
| Plaquiste | pack JSON métier | avancé |
| Couvreur | pack JSON métier | avancé |
| Plombier | base métier JS | avancé |
| Maçon | base métier JS | présente |
| IDEA Bois Terrasse | `IB-TERR-ANGEL-KB-1.2.0` | avancé |
| Électricien | pack central à formaliser | à faire avant prod |
| Aménagement extérieur | pack à formaliser | à faire avant prod |
| CALPI | pack à formaliser | à faire avant prod |
| Agencement & Découpe | pack à formaliser | à faire avant prod |

## Routage cible

```text
Question utilisateur
      ↓
Ángel global
      ↓
détection intention / contexte
      ↓
chargement des packs strictement nécessaires
      ↓
outil métier / moteur source de vérité
      ↓
réponse / brouillon
      ↓
confirmation humaine si écriture
```

## Règles absolues

1. Les calculs métier restent dans les moteurs.
2. Les prix réels viennent du Catalogue / fournisseur / saisie validée.
3. Les quantités viennent du Stock.
4. Les véhicules viennent du Parc matériel.
5. Les équipes viennent d'Équipe & Planning.
6. Les chantiers viennent du module Chantiers.
7. Les chutes géométriques viennent de CALPI / Agencement.
8. Les connaissances expliquent ; elles ne remplacent pas les données réelles.
9. Toute donnée critique manquante reste inconnue / à confirmer.
10. Toute écriture sensible exige confirmation humaine.

## Stock — enrichissements cible 1.3.0

Ángel doit distinguer :
- physique ;
- réservé ;
- disponible ;
- fournisseur ;
- emplacement ;
- véhicule ;
- chantier ;
- équipe ;
- inventaire ;
- chute ;
- besoin d'achat.

Il doit savoir qu'un stock fournisseur n'est jamais du stock artisan.

Il doit toujours donner la fraîcheur de la donnée fournisseur lorsqu'elle est connue.

Il doit considérer :
- comptage inventaire ≠ correction ;
- facture payée ≠ sortie physique ;
- facture fournisseur reçue ≠ réception physique ;
- QR ≠ second moteur Stock.

## Outils Stock cibles

Lecture :
- `stock_search`
- `stock_get_availability`
- `stock_get_location_breakdown`
- `stock_get_reservations`
- `stock_inventory_status`
- `stock_inventory_difference`
- `stock_vehicle_status`
- `supplier_stock_search`
- `stock_offcut_search`

Préparation / mutation avec validation :
- `stock_prepare_entry`
- `stock_prepare_exit`
- `stock_prepare_transfer`
- `stock_prepare_reservation`
- `stock_prepare_reservation_release`
- `stock_inventory_start`
- `stock_inventory_finish`
- `stock_prepare_vehicle_load`
- `stock_prepare_vehicle_return`
- `stock_prepare_purchase_requirement`

## Intégration runtime

La production devra :
- enregistrer les packs dans un registre central ;
- router dynamiquement ;
- ne charger que le contexte utile ;
- brancher les outils sur les services métier réels ;
- supprimer les anciennes lectures directes de `products.quantite_stock` pour le Stock.
