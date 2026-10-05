# Sprint F — Stocks fournisseurs connectés : socle

Statut : première tranche développée dans le dépôt autonome. **Aucune connexion ERP/API réelle.**

## Objectif

Permettre à SpeedArti de rechercher une disponibilité chez plusieurs fournisseurs sans jamais confondre :

- le **stock possédé par l'artisan** ;
- la **disponibilité annoncée par un fournisseur**.

## Règle absolue

Une quantité fournisseur n'augmente jamais le stock de l'artisan.

```text
Fournisseur : 180 pièces disponibles
≠
Artisan : +180 pièces en stock
```

Le stock artisan ne peut évoluer qu'après une réception physique validée par le circuit Stock / Commandes.

## Contrat générique fournisseur

Chaque disponibilité expose notamment :

- `supplierId`
- `supplierName`
- `supplierProductId`
- `supplierReference`
- `productId` SpeedArti éventuel
- `designation`
- `availableQuantity`
- `unit`
- `priceHt` éventuel
- `stockStatus`
- `lastSyncAt`
- dépôt fournisseur éventuel
- source et indicateur de démonstration

Statuts supportés :

- `AVAILABLE`
- `LOW_STOCK`
- `OUT_OF_STOCK`
- `ON_ORDER`
- `UNKNOWN`

Fraîcheur calculée :

- `FRESH`
- `STALE`
- `UNKNOWN`

Une donnée trop ancienne bloque la préparation d'une action.

## Multi-fournisseur

Plusieurs fournisseurs et plusieurs références fournisseur peuvent pointer vers le même `productId` SpeedArti.

Le système ne choisit pas automatiquement un fournisseur « meilleur ».

L'interface affiche les disponibilités et laisse la décision à l'utilisateur.

## Recherche fournisseur

Nouvel onglet **Stocks fournisseurs** dans la démo.

Recherche par :

- désignation ;
- référence fournisseur ;
- nom fournisseur ;
- dépôt fournisseur.

L'écran affiche séparément :

- fournisseur ;
- statut ;
- quantité disponible ;
- unité ;
- prix HT si réellement fourni ;
- dépôt ;
- date/fraîcheur de synchronisation.

## Idea Bois

Un premier adaptateur **Idea Bois — démo** est fourni pour valider le contrat.

**Toutes les données affichées par cet adaptateur sont fictives.**

Elles ne représentent pas :

- le catalogue réel Idea Bois ;
- ses prix réels ;
- ses stocks réels ;
- ses dépôts réels.

Le futur raccordement ERP devra remplacer l'adaptateur démo sans modifier le moteur Stock.

## Demande de devis et commande

Deux actions sont préparées :

### Demander un devis

Produit un `SupplierActionDraft` :

```text
type = QUOTE_REQUEST
targetModule = supplier_quote
validationRequired = true
```

Aucun email ou appel fournisseur n'est envoyé dans cette démo.

### Préparer commande

Produit un brouillon :

```text
type = ORDER_REQUEST
targetModule = commandes
validationRequired = true
```

Le Stock ne devient jamais le moteur Commandes / Achats.

## Cas de sécurité

Le Sprint F couvre :

- donnée fraîche ;
- donnée périmée ;
- date de synchronisation inconnue ;
- fournisseur indisponible ;
- rupture ;
- sur commande ;
- référence inconnue ;
- plusieurs fournisseurs pour un même produit.

## Hors de cette première tranche

Restent à faire :

- vrai connecteur ERP/API ;
- synchronisation authentifiée ;
- mapping catalogue SpeedArti réel ;
- récupération de prix réels ;
- action devis réellement envoyée ;
- commande réellement transmise au module Commandes / Achats ;
- recherche fournisseur via Ángel ;
- gestion avancée des priorités fournisseur ;
- monitoring des erreurs de synchronisation en production.

Ces raccordements réels resteront à intégrer ultérieurement dans SpeedArti par Anne-Sophie.


## Ángel fournisseur

La tranche est complétée par `AngelSupplierSearchService`.

Ángel :

- interroge `SupplierStockService` ;
- ne lit aucune table fournisseur directement ;
- restitue fournisseur, référence, disponibilité, statut et fraîcheur ;
- conserve les données inconnues comme inconnues ;
- ne fusionne jamais cette disponibilité avec le stock artisan ;
- ne recommande pas automatiquement un fournisseur.

La démo publique contient un bloc permettant de tester cette recherche avec Ángel.

## État du Sprint F

Le périmètre fonctionnel prévu dans la démo est terminé.

Le passage à un **vrai stock fournisseur connecté** nécessite ensuite, fournisseur par fournisseur, la documentation et les accès de son ERP/API. Cette étape ne peut pas être simulée comme si elle était réelle.
