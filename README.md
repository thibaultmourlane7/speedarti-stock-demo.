# SpeedArti — Stock V1 — Sprint A

Démonstration autonome des **fondations du futur module Stock SpeedArti**.

## Statut

- Sprint A : fondations techniques.
- Aucun raccordement production.
- Aucun accès Supabase SpeedArti.
- Aucun appel réseau vers GSTAI / SpeedArti.
- Le vrai code SpeedArti reste **strictement en lecture seule**.
- L'intégration production sera réalisée ultérieurement par Anne-Sophie.

## Objectif Sprint A

Préparer un socle stable avant l'interface V1 :

- source de vérité unique ;
- mouvements comme historique métier ;
- réservations distinctes du stock physique ;
- emplacements ;
- contrats de connecteurs ;
- compatibilité Équipe & Planning ;
- chutes exactes pour Calepinage / Agencement & Découpe ;
- pack global de connaissances Ángel ;
- idempotence ;
- garde-fous anti-hallucination ;
- tests métier.

## Règles de source de vérité

### Catalogue / Produits

Le Catalogue SpeedArti reste propriétaire de l'identité du produit lors de l'intégration réelle :

- désignation ;
- référence ;
- unité ;
- fournisseur ;
- référence fournisseur ;
- prix ;
- code-barres.

### Stock

Le moteur Stock reste propriétaire de :

- quantités physiques ;
- emplacements ;
- mouvements ;
- réservations ;
- inventaires ;
- statut des chutes.

La quantité physique **n'est pas stockée dans `StockItem`** dans cette démo : elle est dérivée des mouvements.

## Lancer les contrôles locaux

```bash
npm run check
```

## Structure

```text
src/
  stock/
    domain/
    core/
    repositories/
    integrations/
    adapters/
      mock/
      speedarti/
    angele/
    tests/
```

## Connecteurs

Les contrats sont prévus pour :

- Catalogue / Produits ;
- Chantiers ;
- Chiffrage ;
- Commandes / Achats ;
- Factures fournisseurs ;
- Équipe & Planning ;
- Centre de notifications ;
- Ángel ;
- Comptabilité ;
- Calepinage ;
- Agencement & Découpe / Optimiseur panneaux ;
- Configurateurs ;
- Pilotage ;
- future disponibilité fournisseurs.

Tous restent désactivés / simulés au Sprint A.

## Important

Le futur stock fournisseur n'est **jamais additionné** au stock possédé par l'artisan.

La future caméra / vision / OCR est seulement réservée dans l'architecture. Elle n'est pas développée ici.


## État fonctionnel actuel

La démo couvre maintenant :

- articles, familles, références et emplacements ;
- entrées, sorties, transferts, pertes, casse et retours chantier ;
- inventaire et ajustements tracés ;
- réservations chantier ;
- besoins d'achat brouillons ;
- conditionnements et unités secondaires calculées ;
- alertes stock faible / rupture / écarts d'inventaire ;
- jeu de démonstration BTP ;
- ponts locaux de contrats Équipe & Planning / Chiffrage ;
- persistance navigateur pour la démo.

Exemples de double lecture d'un même stock :

- 30 chevrons de 4 m = 120 ml ;
- 4 boîtes de 200 vis = 800 vis ;
- 3,85 boîtes de 200 vis = 3 boîtes complètes + 170 vis = 770 vis.

Il n'existe toujours qu'une seule quantité source de vérité ; les équivalences sont calculées.
