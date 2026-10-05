# Cartographie connecteurs Stock

Tous les connecteurs sont **contrats uniquement** au Sprint A.

| Module | Direction | Source de vérité | Rôle Stock |
|---|---|---|---|
| Catalogue / Produits | bidirectionnel | Catalogue identité ; Stock quantités | identité produit, unité, référence |
| Chantiers | bidirectionnel | Chantier identité ; Stock matière | sorties, retours, consommation |
| Chiffrage | bidirectionnel | Chiffrage besoins ; Stock dispo | disponibilité, réservation |
| Commandes / Achats | bidirectionnel | Commandes | besoins achat, réception validée |
| Factures fournisseurs | entrant | Facture pour document | proposer une entrée, jamais auto |
| Équipe & Planning | bidirectionnel | Planning pour demandes ; Stock dispo | dispo matériel, sortie brouillon |
| Notifications | sortant | Stock événement ; Notifications diffusion | seuils, ruptures, écarts |
| Ángel | bidirectionnel | Stock données | lecture + brouillons validés |
| Comptabilité | sortant | Comptabilité pour règles de valorisation | mouvements/coûts matière |
| Calepinage | bidirectionnel | CALPI géométrie ; Stock disponibilité | chutes |
| Agencement & Découpe | bidirectionnel | Découpe géométrie ; Stock statut | chutes panneau |
| Configurateurs | bidirectionnel | Configurateur besoin ; Stock dispo | besoin matière |
| Pilotage | sortant | Stock | KPI lecture seule |
| Fournisseurs futurs | entrant | ERP/API fournisseur | disponibilité distincte du Stock artisan |

## Équipe & Planning — compatibilité constatée

Le dépôt actuel prévoit déjà :

- source de vérité `Stock SpeedArti` ;
- `team_planning.material.availability.requested` ;
- `team_planning.stock_exit.draft.requested` ;
- `stock.availability.response` ;
- sortie de stock après validation ;
- outbox/idempotence ;
- interdiction de créer un second Stock.

Le Sprint A conserve ces noms.

## Optimiseur panneaux / Agencement & Découpe

Les chutes conservées devront être exportables vers le Stock avec :

- référence matière ;
- fournisseur ;
- décor ;
- épaisseur ;
- dimensions ;
- sens du fil ;
- origine projet ;
- emplacement ;
- géométrie exacte si complexe.

Le prochain calcul pourra ensuite demander au Stock les chutes compatibles avant d'ouvrir un panneau neuf.

## Calepinage

Le dépôt CALPI gère déjà :

- identifiant stable de chute ;
- géométrie exacte ;
- `cells` ;
- `contours` ;
- `areaMm2` ;
- filiation ;
- états `available/used/lost` ;
- rotation optionnelle.

Ces informations sont conservées dans le contrat Stock.

## Configurateur Terrasse / Idea Bois

Le configurateur possède déjà un export SpeedArti de quantités matière.

L'intégration ERP Idea Bois prévoit :

- catalogue ;
- prix ;
- disponibilité par dépôt ;
- conditionnement ;
- devis ;
- commande.

**Attention :** la disponibilité ERP Idea Bois reste un stock fournisseur. Elle n'est pas une quantité physique possédée par l'artisan.

## ANC

Aucun raccordement Stock direct justifié à ce stade.

Ne pas inventer de connexion. Si un futur dossier ANC produit un besoin matière, le chemin normal sera via Chiffrage/Chantier.

## Pilotage

Lecture uniquement :

- ruptures ;
- stock faible ;
- anomalies ;
- besoins de réapprovisionnement ;
- valeur éventuelle transmise selon règles comptables validées.

Pilotage ne peut pas créer un mouvement Stock.


## Sprint D — pont fonctionnel local

Le fichier `src/stock/integrations/stock-integration-service.ts` exécute désormais les contrats suivants **contre le moteur Stock de la démo**, sans contacter aucun service réel :

- `team_planning.material.availability.requested` → `stock.availability.response` ;
- `team_planning.stock_exit.draft.requested` → `stock.exit.draft.ready` ;
- `chiffrage.stock.availability.requested` → `stock.availability.response` ;
- `chiffrage.stock.reservation.requested` → `stock.reservation.draft.ready` ;
- `chiffrage.stock.reservation.release.requested` → `stock.reservation_release.draft.ready`.

Les demandes de disponibilité sont réellement calculées à partir des mouvements et réservations de la démo.

Les demandes de sortie, réservation et libération provenant d'un autre module restent des **brouillons soumis à validation humaine**. Elles ne mutent pas le Stock.

Le bouton `Réapprovisionner` crée uniquement un `StockPurchaseRequirement` au statut `DRAFT`. Il ne crée pas de commande fournisseur et ne contourne pas le futur module Commandes / Achats.


## Sprint F — Stocks fournisseurs

Le sous-système fournisseur est maintenant séparé du Stock artisan dans `src/stock/suppliers/`.

Contrat principal : `SupplierStockAdapter`.

Un adaptateur fournisseur peut fournir :

- identité fournisseur ;
- référence fournisseur ;
- correspondance éventuelle avec un `productId` SpeedArti ;
- quantité disponible fournisseur ;
- unité ;
- prix HT éventuel ;
- statut de disponibilité ;
- date de dernière synchronisation ;
- dépôt fournisseur.

Le service calcule la fraîcheur de la donnée avant toute action.

Les adaptateurs actuels sont exclusivement de démonstration :

- `IdeaBoisDemoAdapter`
- `GenericSupplierDemoAdapter`

Une donnée fournisseur ne crée jamais de mouvement Stock.

Les actions `Demander un devis` et `Préparer commande` produisent uniquement des brouillons avec `validationRequired: true`.

Un futur adaptateur ERP/API remplacera l'adaptateur démo sans modifier le moteur de mouvements Stock.
