# Sprint B — Stock fonctionnel simple

Statut : développé dans le dépôt de démonstration, sans raccordement production.

## Périmètre livré

- interface mobile-first ;
- création d'article ;
- familles et unités explicites ;
- création automatique du `Dépôt principal` ;
- création d'emplacements supplémentaires ;
- quantité initiale via un vrai mouvement `ENTRY` ;
- entrée de stock ;
- sortie de stock ;
- blocage d'une sortie supérieure au disponible ;
- affichage des stocks faibles et ruptures ;
- recherche partielle par désignation, référence, famille, référence fournisseur et code-barres ;
- historique des mouvements ;
- persistance locale `localStorage` derrière `StockRepository` ;
- aucun accès à Supabase ou au vrai SpeedArti.

## Hors Sprint B

Les éléments suivants restent volontairement pour les étapes suivantes :

- transfert exposé dans l'interface ;
- inventaire manuel ;
- ajustement UI ;
- réservations UI ;
- raccordements réels SpeedArti ;
- stock fournisseur ;
- caméra, OCR, codes-barres et comptage vision ;
- analyses avancées.

Le moteur Sprint A conserve déjà les fondations nécessaires à plusieurs de ces fonctions.

## Règle d'intégration

Anne-Sophie remplacera ultérieurement `LocalStorageStockRepository` et les adaptateurs simulés par les services réels SpeedArti.

Le moteur métier ne doit pas être réécrit pour cette opération.
